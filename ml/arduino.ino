#include <Wire.h>
#include "MPU6050.h"
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

// =================== CONFIG ===================
const char* WIFI_SSID = "Morol_Brothers";
const char* WIFI_PASSWORD = "Asdfqwer1234;";
const char* API_HOST = "192.168.0.112";
const int   API_PORT = 8080;
const char* API_PATH = "/api/readings";
const char* DEVICE_ID = "30EDA02709A8";

#define VIBRATOR_PIN 5
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define BUFFER_SIZE 100

const int HR_LOW = 45;
const int HR_HIGH = 140;
const int SPO2_LOW = 92;

const unsigned long IMU_INTERVAL = 20;     // 50 Hz
const unsigned long DISPLAY_INTERVAL = 100; // 10 Hz
const unsigned long POST_INTERVAL = 2000;  // 1 Hz

// =================== OBJECTS ===================
MPU6050 mpu;
MAX30105 particleSensor;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org");

// =================== GLOBALS ===================
int16_t gyroXOffset, gyroYOffset, gyroZOffset;
int16_t accelXOffset, accelYOffset, accelZOffset;
int32_t spo2, heartRate;
int8_t validSPO2, validHeartRate;

uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];

struct ImuSample { float ax, ay, az, gx, gy, gz; };
ImuSample imuBatch[50];
int imuIndex = 0;

unsigned long lastImuMs = 0, lastDisplayMs = 0, lastPostMs = 0;

// =================== IMU CALIBRATION ===================
void calibrateSensors() {
  long sumGX=0,sumGY=0,sumGZ=0,sumAX=0,sumAY=0,sumAZ=0;
  int samples=500;
  for(int i=0;i<samples;i++){
    int16_t ax,ay,az,gx,gy,gz;
    mpu.getMotion6(&ax,&ay,&az,&gx,&gy,&gz);
    sumGX+=gx;sumGY+=gy;sumGZ+=gz;
    sumAX+=ax;sumAY+=ay;sumAZ+=az;
    delay(3);
  }
  gyroXOffset=sumGX/samples; gyroYOffset=sumGY/samples; gyroZOffset=sumGZ/samples;
  accelXOffset=sumAX/samples; accelYOffset=sumAY/samples; accelZOffset=sumAZ/samples-16384;
  Serial.println("MPU calibration complete.");
}


// =================== IMU Filtering ===================
float axOffset=0, ayOffset=0, azOffset=0;
float gxOffset=0, gyOffset=0, gzOffset=0;
const float alpha=0.85;  // LPF strength (0.7–0.9 typical)
unsigned long lastRecalibMs=0;

void readFilteredIMU(float &ax_g,float &ay_g,float &az_g,
                     float &gx_dps,float &gy_dps,float &gz_dps) {
  static float axPrev=0, ayPrev=0, azPrev=0, gxPrev=0, gyPrev=0, gzPrev=0;
  static float axSmooth=0, aySmooth=0, azSmooth=0, gxSmooth=0, gySmooth=0, gzSmooth=0;

  if (!mpu.getIntDataReadyStatus()) return;

  int16_t ax,ay,az,gx,gy,gz;
  mpu.getMotion6(&ax,&ay,&az,&gx,&gy,&gz);

  gx -= gyroXOffset; gy -= gyroYOffset; gz -= gyroZOffset;
  ax -= accelXOffset; ay -= accelYOffset; az -= accelZOffset;

  // Convert to physical units
  ax_g = (ax / 16384.0) * 9.80665;
  ay_g = (ay / 16384.0) * 9.80665;
  az_g = (az / 16384.0) * 9.80665;
  gx_dps = gx / 131.0;
  gy_dps = gy / 131.0;
  gz_dps = gz / 131.0;

  // ---- Stage 1: Low-pass filter (EMA)
  axSmooth = alpha * axSmooth + (1 - alpha) * ax_g;
  aySmooth = alpha * aySmooth + (1 - alpha) * ay_g;
  azSmooth = alpha * azSmooth + (1 - alpha) * az_g;
  gxSmooth = alpha * gxSmooth + (1 - alpha) * gx_dps;
  gySmooth = alpha * gySmooth + (1 - alpha) * gy_dps;
  gzSmooth = alpha * gzSmooth + (1 - alpha) * gz_dps;

  // ---- Stage 2: Noise deadband
  const float ACC_DEADBAND = 0.08;  // m/s²
  const float GYRO_DEADBAND = 0.5;  // deg/s
  if (fabs(axSmooth - axPrev) < ACC_DEADBAND) axSmooth = axPrev;
  if (fabs(aySmooth - ayPrev) < ACC_DEADBAND) aySmooth = ayPrev;
  if (fabs(azSmooth - azPrev) < ACC_DEADBAND) azSmooth = azPrev;
  if (fabs(gxSmooth - gxPrev) < GYRO_DEADBAND) gxSmooth = gxPrev;
  if (fabs(gySmooth - gyPrev) < GYRO_DEADBAND) gySmooth = gyPrev;
  if (fabs(gzSmooth - gzPrev) < GYRO_DEADBAND) gzSmooth = gzPrev;

  axPrev=axSmooth; ayPrev=aySmooth; azPrev=azSmooth;
  gxPrev=gxSmooth; gyPrev=gySmooth; gzPrev=gzSmooth;

  // ---- Stage 3: Auto bias correction when stable
  unsigned long now = millis();
  if (now - lastRecalibMs > 5000) {
    float accelMag = sqrt(axSmooth*axSmooth + aySmooth*aySmooth + azSmooth*azSmooth);
    float gyroMag  = fabs(gxSmooth) + fabs(gySmooth) + fabs(gzSmooth);
    if (fabs(accelMag - 9.81) < 0.05 && gyroMag < 1.0) {
      axOffset=axSmooth; ayOffset=aySmooth; azOffset=azSmooth-9.81;
      gxOffset=gxSmooth; gyOffset=gySmooth; gzOffset=gzSmooth;
      Serial.println("Auto-recalibrated IMU (stable)");
    }
    lastRecalibMs = now;
  }

  // ---- Stage 4: Apply offsets
  ax_g = axSmooth - axOffset;
  ay_g = aySmooth - ayOffset;
  az_g = azSmooth - azOffset;
  gx_dps = gxSmooth - gxOffset;
  gy_dps = gySmooth - gyOffset;
  gz_dps = gzSmooth - gzOffset;

  // ---- Stage 5: Clamp gravity magnitude to reduce drift
  float mag = sqrt(ax_g*ax_g + ay_g*ay_g + az_g*az_g);
  if (mag > 9.81*0.97 && mag < 9.81*1.03) {
    float scale = 9.81 / mag;
    ax_g *= scale; ay_g *= scale; az_g *= scale;
  }
}



// =================== HR/SPO2 Averaging ===================
const int HR_AVG_WINDOW = 8;
int hrBuffer[HR_AVG_WINDOW];
int spo2Buffer[HR_AVG_WINDOW];
int hrCount = 0, spo2Count = 0;
int hrIdx = 0, spo2Idx = 0;

float hrAvg = 0.0;
float spo2Avg = 0.0;

float computeAvg(int *buf, int count) {
  if (count == 0) return -1;
  long sum = 0;
  for (int i = 0; i < count; i++) sum += buf[i];
  return (float)sum / count;
}

void addToAverageBuffers(int hr, int spo2, bool validHR, bool validSpO2) {
  if (validHR && hr > 30 && hr < 200) {  // sanity bounds
    hrBuffer[hrIdx] = hr;
    hrIdx = (hrIdx + 1) % HR_AVG_WINDOW;
    if (hrCount < HR_AVG_WINDOW) hrCount++;
    hrAvg = computeAvg(hrBuffer, hrCount);
  }

  if (validSpO2 && spo2 > 70 && spo2 <= 100) {
    spo2Buffer[spo2Idx] = spo2;
    spo2Idx = (spo2Idx + 1) % HR_AVG_WINDOW;
    if (spo2Count < HR_AVG_WINDOW) spo2Count++;
    spo2Avg = computeAvg(spo2Buffer, spo2Count);
  }
}





// =================== MAX30105 FILTERING ===================
const int avgWindow = 8;
uint32_t redAvgBuf[avgWindow], irAvgBuf[avgWindow];
int avgIdx = 0;

// NOTE: We removed fingerPresent logic since this is a watch-style device.

uint32_t getFilteredSample(uint32_t *buf, int len) {
  uint64_t sum = 0;
  for (int i = 0; i < len; i++) sum += buf[i];
  return (uint32_t)(sum / len);
}

void readFilteredSpO2HR() {
  static int idx = 0;

  if (particleSensor.available()) {
    // Read current FIFO sample
    uint32_t red = particleSensor.getRed();
    uint32_t ir  = particleSensor.getIR();

    // Rolling average to reduce high-frequency noise
    redAvgBuf[avgIdx] = red;
    irAvgBuf[avgIdx]  = ir;
    avgIdx = (avgIdx + 1) % avgWindow;

    particleSensor.nextSample();  // advance FIFO

    uint32_t redFiltered = getFilteredSample(redAvgBuf, avgWindow);
    uint32_t irFiltered  = getFilteredSample(irAvgBuf,  avgWindow);

    // Fill buffers for algorithm
    if (idx < BUFFER_SIZE) {
      redBuffer[idx] = redFiltered;
      irBuffer[idx]  = irFiltered;
      idx++;
    }

    // As soon as we have a full window, run the algorithm
    if (idx >= BUFFER_SIZE) {
      maxim_heart_rate_and_oxygen_saturation(
        irBuffer, BUFFER_SIZE, redBuffer,
        &spo2, &validSPO2, &heartRate, &validHeartRate
      );
      idx = 0;  // start a new window
    }
    addToAverageBuffers(heartRate, spo2, validHeartRate, validSPO2);
    // Small pacing so we don't hammer the FIFO too aggressively
    delay(5);
  }
}


// =================== POST JSON ===================
bool postReading(){
  if(WiFi.status()!=WL_CONNECTED) return false;

  StaticJsonDocument<2048> doc;
  doc["deviceId"]=DEVICE_ID;
  timeClient.update();
  uint64_t ts=((uint64_t)timeClient.getEpochTime()*1000)+(millis()%1000);
  doc["ts"]=ts;
  doc["hr"] = (hrCount > 0) ? (int)hrAvg : -1;
  doc["spo2"] = (spo2Count > 0) ? (int)spo2Avg : -1;

  JsonArray imu=doc.createNestedArray("imu");
  for(int i=0;i<imuIndex;i++){
    JsonObject s=imu.createNestedObject();
    s["ax"]=imuBatch[i].ax;
    s["ay"]=imuBatch[i].ay;
    s["az"]=imuBatch[i].az;
    s["gx"]=imuBatch[i].gx;
    s["gy"]=imuBatch[i].gy;
    s["gz"]=imuBatch[i].gz;
  }

  String payload; serializeJson(doc,payload);
  String url=String("http://")+API_HOST+":"+String(API_PORT)+API_PATH;

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type","application/json");
  http.POST(payload);
  http.end();
  imuIndex=0;
  return true;
}

// =================== SETUP ===================
void setup(){
  Serial.begin(115200);
  pinMode(VIBRATOR_PIN,OUTPUT);
  Wire.begin(16, 21);
  Wire.setClock(400000L);

  Serial.println("\n========== SYSTEM INITIALIZATION ==========");

  Serial.println("Initializing MPU6050...");
  mpu.initialize();
  if(!mpu.testConnection()) Serial.println("❌ MPU6050 connection failed!");
  else Serial.println("✅ MPU6050 connected.");
  calibrateSensors();

  Serial.println("Initializing MAX30105...");
  if(!particleSensor.begin(Wire,I2C_SPEED_FAST)) Serial.println("❌ MAX30105 not found!");
  else Serial.println("✅ MAX30105 ready.");
  particleSensor.setup();
// Drive both IR and RED LEDs — IR is essential for SpO2/HR calc.
  particleSensor.setPulseAmplitudeIR(0x7F);   // 0x7F–0xFF is a good starting range
  particleSensor.setPulseAmplitudeRed(0x7F);  // increase if your readings are low
  particleSensor.setPulseAmplitudeGreen(0);   // not used

  Serial.println("Initializing OLED display...");
  if(!display.begin(SSD1306_SWITCHCAPVCC,0x3C)){ 
    Serial.println("❌ OLED initialization failed!"); 
    while(1); 
  }
  display.clearDisplay(); 
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10,20); 
  display.println("System Init...");
  display.display();

  Serial.print("Connecting WiFi ");
  WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
  for(int i=0;i<40 && WiFi.status()!=WL_CONNECTED;i++){
    delay(250); Serial.print(".");
  }
  Serial.println();
  if(WiFi.status()==WL_CONNECTED){
    Serial.print("✅ WiFi connected. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("❌ WiFi connection failed.");
  }

  timeClient.begin();
  Serial.println("✅ NTP Client initialized.");

  Serial.println("========== SYSTEM READY ==========\n");
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(10,24);
  display.println("System Ready");
  display.display();
  delay(1000);
  display.clearDisplay();
}

// =================== MAIN LOOP ===================
void loop(){
  unsigned long now=millis();

  // ---- IMU ----
  if(now-lastImuMs>=IMU_INTERVAL){
    lastImuMs=now;
    float ax_g,ay_g,az_g,gx_dps,gy_dps,gz_dps;
    readFilteredIMU(ax_g,ay_g,az_g,gx_dps,gy_dps,gz_dps);
    if(imuIndex<50) imuBatch[imuIndex++]={ax_g,ay_g,az_g,gx_dps,gy_dps,gz_dps};

    // ---- OLED update ----
    if(now-lastDisplayMs>=DISPLAY_INTERVAL){
      lastDisplayMs=now;
      display.clearDisplay();

      // Title bar
      display.fillRect(0,0,128,12,SSD1306_WHITE);
      display.setTextColor(SSD1306_BLACK);
      display.setCursor(2,2); 
      display.print("Health Monitor");
      display.setTextColor(SSD1306_WHITE);

      // Accelerometer
      display.setCursor(2,16);
      display.print("ACC: ");
      display.print(ax_g,1);display.print(",");
      display.print(ay_g,1);display.print(",");
      display.print(az_g,1);

      // Gyroscope
      display.setCursor(2,26);
      display.print("GYR: ");
      display.print(gx_dps,0);display.print(",");
      display.print(gy_dps,0);display.print(",");
      display.print(gz_dps,0);

      // HR
      display.setCursor(2,38);
      display.print("HR: ");
      if(validHeartRate) display.print(heartRate);
      else display.print("--");
      display.print(" bpm");

      // SpO2
      display.setCursor(2,48);
      display.print("SpO2: ");
      if(validSPO2) display.print(spo2);
      else display.print("--");
      display.print(" %");

      display.display();
    }

    // ---- Serial Monitor live stream ----
    // HR
      display.setCursor(2,38);
      display.print("HR(avg): ");
      if (hrCount > 0) display.print((int)hrAvg);
      else display.print("--");
      display.print(" bpm");

      // SpO2
      display.setCursor(2,48);
      display.print("SpO2(avg): ");
      if (spo2Count > 0) display.print((int)spo2Avg);
      else display.print("--");
      display.print(" %");
  }

  // ---- MAX30105 ----
  readFilteredSpO2HR();

  // ---- Vibrate on abnormal ----
  bool alert=(validHeartRate&&(heartRate<HR_LOW||heartRate>HR_HIGH))||(validSPO2&&spo2<SPO2_LOW);
  if(alert){
    Serial.println("⚠️ ALERT: Abnormal HR/SpO2 detected! Vibrating...");
    digitalWrite(VIBRATOR_PIN,HIGH);
    delay(200);
    digitalWrite(VIBRATOR_PIN,LOW);
  }

  // ---- Post JSON every 1 s ----
  if(now-lastPostMs>=POST_INTERVAL){
    lastPostMs=now;
    Serial.print("📡 Sending data... ");
    bool success = postReading();
    if(success) {
      Serial.println("✅ Posted successfully.");
    } else {
      Serial.println("❌ Post failed (no WiFi or HTTP error).");
    }
  }
}

