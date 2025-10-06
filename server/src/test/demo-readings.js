// demo_readings.js
const { randomInt } = require('crypto');

function generateReadings(count = 100) {
  const now = Date.now();
  return Array.from({ length: count }).map((_, i) => {
    const ts = new Date(now - i * 60 * 60 * 1000); // hourly gap backward
    return {
      deviceId: '663f2a3b5e8d2f0012abcd34',
      ts,
      hr: randomInt(60, 130), // realistic HR range
      spo2: randomInt(94, 100), // realistic SpO2 range
      flags: [],
    };
  });
}

// Example: bulk insert
async function seed() {
  const readings = generateReadings(100);
  await Reading.insertMany(readings);
  console.log('Inserted', readings.length, 'demo readings');
}
