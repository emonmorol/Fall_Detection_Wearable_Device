#include <Wire.h>
#include "MPU6050.h"
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Fall_detection_model_inferencing.h>

// networking & JSON ===
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>

#define NUMBER_OF_INPUTS 38

// ==== NORMALIZATION VALUES FROM scaler.json ====
const float kFeatMean[38] = {
		7.026606657382406, 2.3760939281143876, 0.8273102547051793,
		16.813911864207174, 7.127211433518363, 58.92720628641624,
		-1.4511561892910148, 2.224913333163428, -9.149362549752032,
		5.383565123221057, 2.5180061887626266, 12.679714083610413,
		-2.066430143704085, 2.5168373653507787, -8.405285412061515,
		5.096477300636087, 5.876650477066663, 40.2360426851085,
		-1.2037729784999145, 27.303392577334442, -75.99239664724092,
		66.50592974724557, 22.227110172217326, 1299.2030715995313,
		-0.7948566570901638, 18.533213697374897, -64.72984201395612,
		43.88239308673951, 12.632215891038362, 663.5242060762375,
		-0.05262682793744881, 23.65620661011521, -62.76562228792323,
		61.80901456275657, 18.96271444070097, 881.5559294023415,
		22.08752516653848, 2.4494002160232244
};

const float kFeatScale[38] = { 
		1.098797743148208, 1.6433188662098785, 7.575093233250726,
		8.60985485490989, 1.0570049035094722, 16.39252294249476,
		1.7924829070876378, 1.5528027684686505, 8.763835081453998,
		7.551812319814689, 1.351921798141402, 14.121176242054016,
		4.958331482041405, 2.2464774132424252, 7.237969239675448,
		11.2057202474994, 1.1729202055738261, 14.440840016685762,
		14.221806648888766, 18.708927519294736, 71.39988435526384,
		58.85904001365152, 15.68748115231375, 1465.0712466123055,
		6.5979721078446305, 16.609712196493916, 85.92531717370649,
		40.010779802409466, 9.797949623687815, 1146.8508796755975,
		10.243701402012604, 14.7311226481492, 51.97105013930504,
		46.763570520671635, 12.04304728122623, 948.4098037136254,
		12.604473950655725, 1.8834104699495877
};

const float kFallThreshold = 0.7f;

// VIBRATOR: Define the pin for the coin vibrator
const int VIBRATOR_PIN = 5;

// ------------ Wi-Fi & API CONFIG ------------
const char* WIFI_SSID     = "Omlan";
const char* WIFI_PASSWORD = "12345678";

// IMPORTANT: use your PC's LAN IP here (NOT localhost / 127.0.0.1)
const char* API_HOST = "10.196.229.59";
const int   API_PORT = 8080;
const char* API_PATH = "/api/readings";

const char* DEVICE_ID = "30EDA02709A8";           // choose an ID that matches your backend/device

// Thresholds (local + sent to server as flags)
const int HR_LOW   = 45;
const int HR_HIGH  = 140;
const int SPO2_LOW = 92;

// POST cadence
const uint32_t UPLOAD_INTERVAL_MS = 2000;
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

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org");

void extractFeatures(float ax[], float ay[], float az[], float gx[], float gy[], float gz[], int n, float out[38]) {
  auto stats=[](float* x,int n,float* o6){
    float sum=0,absSum=0,mn=x[0],mx=x[0],eng=0;
    for(int i=0;i<n;i++){float v=x[i];sum+=v;absSum+=fabs(v);mn=min(mn,v);mx=max(mx,v);eng+=v*v;}
    float mean=sum/n,stdv=0;for(int i=0;i<n;i++){float d=x[i]-mean;stdv+=d*d;}stdv=sqrt(stdv/n);
    o6[0]=mean;o6[1]=stdv;o6[2]=mn;o6[3]=mx;o6[4]=absSum/n;o6[5]=eng/n;
  };
  float tmp[6];int idx=0;
  stats(ax,n,tmp);for(int i=0;i<6;i++)out[idx++]=tmp[i];
  stats(ay,n,tmp);for(int i=0;i<6;i++)out[idx++]=tmp[i];
  stats(az,n,tmp);for(int i=0;i<6;i++)out[idx++]=tmp[i];
  stats(gx,n,tmp);for(int i=0;i<6;i++)out[idx++]=tmp[i];
  stats(gy,n,tmp);for(int i=0;i<6;i++)out[idx++]=tmp[i];
  stats(gz,n,tmp);for(int i=0;i<6;i++)out[idx++]=tmp[i];
  float raMax=0,sum=0,sum2=0;
  for(int i=0;i<n;i++){float ra=sqrt(ax[i]*ax[i]+ay[i]*ay[i]+az[i]*az[i]);
    raMax=max(raMax,ra);sum+=ra;sum2+=ra*ra;}
  float mean=sum/n,stdv=sqrt(sum2/n-mean*mean);
  out[idx++]=raMax; out[idx++]=stdv;
  for(int i=0;i<38;i++) out[i]=(out[i]-kFeatMean[i])/kFeatScale[i];
}

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

bool postReading(int hr, int spo2, bool hrLow, bool hrHigh, bool spo2Low) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[NET] WiFi not connected, skipping POST");
    return false;
  }
  timeClient.update();
  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;

  uint64_t epochMillis = ((uint64_t)timeClient.getEpochTime() * 1000) + (millis() % 1000);

  // Add the correct numeric timestamp to the JSON document
  doc["ts"] = epochMillis;

  doc["hr"] = hr;
  doc["spo2"] = spo2;
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

  // VIBRATOR: Set the vibrator pin as an output
  pinMode(VIBRATOR_PIN, OUTPUT);

  Wire.begin(16, 21);

  Serial.println("Initializing MPU6050...");
  mpu.initialize();
  if (!mpu.testConnection()) Serial.println("MPU6050 connection failed!");
  else Serial.println("MPU6050 connection successful!");

  Serial.println("Initializing MAX30102...");
  if (!particleSensor.begin(Wire, I2C_SPEED_STANDARD)) {
    Serial.println("MAX30102 not found. Check wiring/power.");
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
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Calibrating Sensors...");
  display.display();
  calibrateSensors();
  delay(200);

  
  timeClient.begin();

  // === ML model (EloquentTinyML) ===
  Serial.println("Loading fall detection model...");
  ei_impulse_init();
  Serial.println("Model ready (EdgeImpulse).");
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

  // === fall detection window ===
  static float axBuf[100],ayBuf[100],azBuf[100],gxBuf[100],gyBuf[100],gzBuf[100];
  static int idx=0;
  axBuf[idx]=ax_g; ayBuf[idx]=ay_g; azBuf[idx]=az_g;
  gxBuf[idx]=gx_dps; gyBuf[idx]=gy_dps; gzBuf[idx]=gz_dps; idx++;
  if (idx >= 100) {
    float feats[NUMBER_OF_INPUTS];
    extractFeatures(axBuf, ayBuf, azBuf, gxBuf, gyBuf, gzBuf, 100, feats);

    ei_impulse_result_t result;
    signal_t signal;
    numpy::signal_from_buffer(feats, NUMBER_OF_INPUTS, &signal);

    EI_IMPULSE_ERROR res = ei_run_classifier(&signal, &result, false);
    if (res != EI_IMPULSE_OK) {
      Serial.printf("ERR: Classifier failed (%d)\n", res);
      idx = 0;
      return;
    }

    float fall_prob = result.classification[1].value;
    Serial.printf("Probability of fall: %.3f\n", fall_prob);

    if (fall_prob >= kFallThreshold) {
      Serial.println(">>> FALL DETECTED <<<");
      display.clearDisplay();
      display.setTextSize(2);
      display.setCursor(15, 25);
      display.print("FALL!");
      display.display();
      digitalWrite(VIBRATOR_PIN, HIGH);
      delay(1500);
      digitalWrite(VIBRATOR_PIN, LOW);
    }

    idx = 0;
  }



  // === HR / SpO2 ===
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

  // --- NEW: derive flags and POST every 2s ---
  bool hrLow   = validHeartRate && (heartRate < HR_LOW);
  bool hrHigh  = validHeartRate && (heartRate > HR_HIGH);
  bool spo2Low = validSPO2      && (spo2      < SPO2_LOW);

  // VIBRATOR: Check if any reading is out of the threshold and vibrate
  if (hrLow || hrHigh || spo2Low) {
    digitalWrite(VIBRATOR_PIN, HIGH); // Turn vibrator ON
    delay(1000);
    digitalWrite(VIBRATOR_PIN, LOW);
  }

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
  delay(100);
}