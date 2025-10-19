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

// =================== IMU FILTERING ===================
float axOffset=0, ayOffset=0, azOffset=0;
float gxOffset=0, gyOffset=0, gzOffset=0;
const float alpha=0.8;
unsigned long lastRecalibMs=0;

void readFilteredIMU(float &ax_g,float &ay_g,float &az_g,float &gx_dps,float &gy_dps,float &gz_dps) {
  static float axPrev=0, ayPrev=0, azPrev=0, gxPrev=0, gyPrev=0, gzPrev=0;

  if (mpu.getIntDataReadyStatus()) {
    int16_t ax,ay,az,gx,gy,gz;
    mpu.getMotion6(&ax,&ay,&az,&gx,&gy,&gz);
    gx-=gyroXOffset; gy-=gyroYOffset; gz-=gyroZOffset;
    ax-=accelXOffset; ay-=accelYOffset; az-=accelZOffset;

    ax_g=(ax/ 16384.0) * 9.80665; ay_g=(ay/ 16384.0) * 9.80665; (az_g=az/ 16384.0) * 9.80665;
    gx_dps=gx/131.0; gy_dps=gy/131.0; gz_dps=gz/131.0;

    // Low-pass filter
    ax_g=alpha*axPrev+(1-alpha)*ax_g;
    ay_g=alpha*ayPrev+(1-alpha)*ay_g;
    az_g=alpha*azPrev+(1-alpha)*az_g;
    gx_dps=alpha*gxPrev+(1-alpha)*gx_dps;
    gy_dps=alpha*gyPrev+(1-alpha)*gy_dps;
    gz_dps=alpha*gzPrev+(1-alpha)*gz_dps;

    axPrev=ax_g; ayPrev=ay_g; azPrev=az_g;
    gxPrev=gx_dps; gyPrev=gy_dps; gzPrev=gz_dps;

    // Dynamic re-zero when still
    unsigned long now=millis();
    if(now-lastRecalibMs>5000){
      float magnitude=sqrt(ax_g*ax_g+ay_g*ay_g+az_g*az_g);
      if(fabs(magnitude-1.0)<0.05 && fabs(gx_dps)+fabs(gy_dps)+fabs(gz_dps)<1.0){
        axOffset=ax_g; ayOffset=ay_g; azOffset=az_g-1.0;
        gxOffset=gx_dps; gyOffset=gy_dps; gzOffset=gz_dps;
        Serial.println("Auto-recalibrated IMU");
      }
      lastRecalibMs=now;
    }

    ax_g-=axOffset; ay_g-=ayOffset; az_g-=azOffset;
    gx_dps-=gxOffset; gy_dps-=gyOffset; gz_dps-=gzOffset;
  }
}

// =================== MAX30105 FILTERING ===================
const int avgWindow=8;
uint32_t redAvgBuf[avgWindow], irAvgBuf[avgWindow];
int avgIdx=0;
bool fingerPresent=false;

uint32_t getFilteredSample(uint32_t *buf,int len){
  uint64_t sum=0; for(int i=0;i<len;i++) sum+=buf[i]; return sum/len;
}

void readFilteredSpO2HR(){
  static int idx=0;
  if(particleSensor.available()){
    uint32_t red=particleSensor.getRed();
    uint32_t ir =particleSensor.getIR();
    redAvgBuf[avgIdx]=red; irAvgBuf[avgIdx]=ir; avgIdx=(avgIdx+1)%avgWindow;
    particleSensor.nextSample();

    uint32_t redFiltered=getFilteredSample(redAvgBuf,avgWindow);
    uint32_t irFiltered =getFilteredSample(irAvgBuf,avgWindow);

    fingerPresent=irFiltered>50000; // finger detection

    if(idx<BUFFER_SIZE){
      redBuffer[idx]=redFiltered;
      irBuffer[idx]=irFiltered;
      idx++;
    }

    if(idx>=BUFFER_SIZE){
      if(fingerPresent){
        maxim_heart_rate_and_oxygen_saturation(irBuffer,BUFFER_SIZE,redBuffer,
          &spo2,&validSPO2,&heartRate,&validHeartRate);
      }else{
        validHeartRate=0; validSPO2=0;
      }
      idx=0;
    }
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
  doc["hr"]=validHeartRate?heartRate:-1;
  doc["spo2"]=validSPO2?spo2:-1;

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
  particleSensor.setPulseAmplitudeRed(0x3F);
  particleSensor.setPulseAmplitudeGreen(0);

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
    Serial.print("ACC[g]: ");
    Serial.printf("%.2f,%.2f,%.2f | ", ax_g, ay_g, az_g);
    Serial.print("GYR[dps]: ");
    Serial.printf("%.1f,%.1f,%.1f | ", gx_dps, gy_dps, gz_dps);
    if(validHeartRate) Serial.printf("HR: %d bpm | ", heartRate);
    else Serial.print("HR: -- | ");
    if(validSPO2) Serial.printf("SpO2: %d %%", spo2);
    else Serial.print("SpO2: --");
    Serial.println();
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

