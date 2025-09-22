#include <Wire.h>
#include "MPU6050.h"
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// === NEW: networking & JSON ===
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ------------ Wi-Fi & API CONFIG ------------
const char* WIFI_SSID     = "MOROL_HOUSE";        // <-- change
const char* WIFI_PASSWORD = "Asdfqwer1234;";        // <-- change

// IMPORTANT: use your PC's LAN IP here (NOT localhost / 127.0.0.1)
const char* API_HOST = "192.168.0.110";          // <-- change to your PC IP
const int   API_PORT = 8080;
const char* API_PATH = "/api/readings";

const char* DEVICE_ID = "30EDA02709A8";               // choose an ID that matches your backend/device

// Thresholds (local + sent to server as flags)
const int HR_LOW   = 45;
const int HR_HIGH  = 140;
const int SPO2_LOW = 92;

// POST cadence
const uint32_t UPLOAD_INTERVAL_MS = 5000;
uint32_t lastUploadMs = 0;
// --------------------------------------------

MPU6050 mpu;
MAX30105 particleSensor;

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

#define BUFFER_SIZE 100
uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];

int32_t spo2;
int8_t validSPO2;
int32_t heartRate;
int8_t validHeartRate;
int32_t bufferLength;

// Gyro and Accel offsets
int16_t gyroXOffset = 0, gyroYOffset = 0, gyroZOffset = 0;
int16_t accelXOffset = 0, accelYOffset = 0, accelZOffset = 0;

void calibrateSensors() {
  long sumGX = 0, sumGY = 0, sumGZ = 0;
  long sumAX = 0, sumAY = 0, sumAZ = 0;
  int samples = 500;

  for (int i = 0; i < samples; i++) {
    int16_t ax, ay, az, gx, gy, gz;
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
    sumGX += gx; sumGY += gy; sumGZ += gz;
    sumAX += ax; sumAY += ay; sumAZ += az;
    delay(5);
  }

  gyroXOffset = sumGX / samples;
  gyroYOffset = sumGY / samples;
  gyroZOffset = sumGZ / samples;

  accelXOffset = sumAX / samples;
  accelYOffset = sumAY / samples;
  // For Z, subtract 1g (16384) since Z points up
  accelZOffset = sumAZ / samples - 16384;

  Serial.println("Sensor calibration done");
  Serial.print("Gyro offsets: "); Serial.print(gyroXOffset); Serial.print(", "); Serial.print(gyroYOffset); Serial.print(", "); Serial.println(gyroZOffset);
  Serial.print("Accel offsets: "); Serial.print(accelXOffset); Serial.print(", "); Serial.print(accelYOffset); Serial.print(", "); Serial.println(accelZOffset);
}

// === NEW: helper to POST one reading JSON ===
bool postReading(int hr, int spo2, bool hrLow, bool hrHigh, bool spo2Low) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[NET] WiFi not connected, skipping POST");
    return false;
  }

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;

  // For quick demo: a pseudo epoch (ms). Replace with NTP time if you enable it.
  uint64_t pseudoEpoch = 1700000000000ULL + (uint64_t)millis();
  doc["ts"] = pseudoEpoch;

  doc["hr"] = hr;       // use -1 if invalid
  doc["spo2"] = spo2;   // use -1 if invalid
  JsonObject flags = doc.createNestedObject("flags");
  flags["hrLow"] = hrLow;
  flags["hrHigh"] = hrHigh;
  flags["spo2Low"] = spo2Low;

  String payload;
  serializeJson(doc, payload);

  String url = String("http://") + API_HOST + ":" + String(API_PORT) + String(API_PATH);
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  int code = http.POST((uint8_t*)payload.c_str(), payload.length());
  String resp = http.getString();
  http.end();

  Serial.printf("[POST] %s -> %d\n", url.c_str(), code);
  if (resp.length()) Serial.printf("Resp: %s\n", resp.c_str());
  return (code == 200 || code == 201);
}

void setup() {
  Serial.begin(115200);

  // IMPORTANT: use the I2C pins you wired.
  // If you wired to ESP32-S3 defaults: SDA=8, SCL=9. Otherwise keep your pins.
  // Wire.begin(8, 9);
  Wire.begin(18, 20); // <-- your current code uses 18/20. Change to (8,9) if that matches your wiring.

  Serial.println("Initializing MPU6050...");
  mpu.initialize();
  if (!mpu.testConnection()) Serial.println("MPU6050 connection failed!");
  else Serial.println("MPU6050 connection successful!");

  Serial.println("Initializing MAX30102...");
  if (!particleSensor.begin(Wire, I2C_SPEED_STANDARD)) {
    Serial.println("MAX30102 not found. Check wiring/power.");
    while (1);
  }
  particleSensor.setup();
  particleSensor.setPulseAmplitudeRed(0x3F);
  particleSensor.setPulseAmplitudeGreen(0);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 allocation failed");
    while (1);
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("System Init...");
  display.display();
  delay(500);

  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Calibrating Sensors...");
  display.display();
  calibrateSensors();
  delay(200);

  // === NEW: Wi-Fi connect ===
  Serial.println("Connecting WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - t0) < 15000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi OK, IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi connect failed (will retry in loop).");
  }
}

void loop() {
  // --- IMU read (unused algorithmically for now) ---
  int16_t ax, ay, az, gx, gy, gz;
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

  gx -= gyroXOffset;
  gy -= gyroYOffset;
  gz -= gyroZOffset;

  ax -= accelXOffset;
  ay -= accelYOffset;
  az -= accelZOffset;

  float ax_g = ax / 16384.0;
  float ay_g = ay / 16384.0;
  float az_g = az / 16384.0;

  float gx_dps = gx / 131.0;
  float gy_dps = gy / 131.0;
  float gz_dps = gz / 131.0;

  // --- PPG window ---
  bufferLength = BUFFER_SIZE;
  for (int i = 0; i < bufferLength; i++) {
    while (!particleSensor.available()) particleSensor.check();
    redBuffer[i] = particleSensor.getRed();
    irBuffer[i]  = particleSensor.getIR();
    particleSensor.nextSample();
  }

  maxim_heart_rate_and_oxygen_saturation(
    irBuffer, bufferLength, redBuffer,
    &spo2, &validSPO2, &heartRate, &validHeartRate
  );

  // --- Serial diagnostics ---
  Serial.println("==================================");
  Serial.print("Accel(g): "); Serial.print(ax_g); Serial.print(", "); Serial.print(ay_g); Serial.print(", "); Serial.println(az_g);
  Serial.print("Gyro(°/s): "); Serial.print(gx_dps); Serial.print(", "); Serial.print(gy_dps); Serial.print(", "); Serial.println(gz_dps);
  Serial.print("HR: "); if (validHeartRate) Serial.print(heartRate); else Serial.print("Invalid");
  Serial.print(" bpm | SpO2: "); if (validSPO2) Serial.print(spo2); else Serial.print("Invalid"); Serial.println(" %");
  Serial.println("==================================");

  // --- OLED UI ---
  display.clearDisplay();
  display.fillRect(0, 0, 128, 12, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setCursor(2, 2);
  display.print("Health Monitor");
  display.setTextColor(SSD1306_WHITE);

  display.drawRect(0, 14, 62, 25, SSD1306_WHITE);
  display.setCursor(2, 16);
  display.setTextSize(1);
  display.print("HR:");
  display.setCursor(25, 16);
  display.setTextSize(2);
  if (validHeartRate) display.print(heartRate);
  else display.print("--");

  display.drawRect(66, 14, 62, 25, SSD1306_WHITE);
  display.setCursor(68, 16);
  display.setTextSize(1);
  display.print("SpO2");
  display.setCursor(68, 26);
  display.setTextSize(2);
  if (validSPO2) display.print(spo2);
  else display.print("--");
  display.setTextSize(1);
  display.print("%");

  display.drawRect(0, 42, 128, 22, SSD1306_WHITE);
  display.setCursor(2, 44);
  display.setTextSize(1);
  display.print("ACC:");
  display.print(ax_g,2); display.print(","); display.print(ay_g,2); display.print(","); display.println(az_g,2);

  display.setCursor(2, 54);
  display.print("GYR:");
  display.print(gx_dps,1); display.print(","); display.print(gy_dps,1); display.print(","); display.print(gz_dps,1);

  display.display();

  // --- NEW: derive flags and POST every 5s ---
  bool hrLow   = validHeartRate && (heartRate < HR_LOW);
  bool hrHigh  = validHeartRate && (heartRate > HR_HIGH);
  bool spo2Low = validSPO2     && (spo2      < SPO2_LOW);

  if (millis() - lastUploadMs >= UPLOAD_INTERVAL_MS) {
    lastUploadMs = millis();

    // Use -1 when invalid, so backend sees it as missing/invalid
    int hrToSend   = validHeartRate ? heartRate : -1;
    int spo2ToSend = validSPO2 ? spo2 : -1;

    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[NET] Reconnecting WiFi...");
      WiFi.reconnect();
    }
    bool ok = postReading(hrToSend, spo2ToSend, hrLow, hrHigh, spo2Low);
    if (!ok) Serial.println("[POST] Upload failed (will retry next cycle)");
  }

  // Keep your 1s cadence for OLED; timers above handle 5s uploads
  delay(1000);
}
