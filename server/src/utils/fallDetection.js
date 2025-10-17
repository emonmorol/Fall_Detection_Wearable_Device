// Simple rule-based fall detector using accel + gyro
// Works best around 50 Hz sampling; adjust WINDOW if your rate differs.

const G = 9.81;

// ---- Tunables (start here to calibrate) ----
const SAMPLE_RATE_HZ = 50;
const WINDOW = Math.round(1.0 * SAMPLE_RATE_HZ); // ~1 s ring buffer
const POST_STILL_SAMPLES = Math.round(0.6 * SAMPLE_RATE_HZ);

const FREEFALL_ACC = 0.5 * G; // near-zero g
const IMPACT_ACC = 2.6 * G; // impact spike
const STILL_ACC_EPS = 0.9; // |mean_acc - 1g| < eps (in m/s^2)
const GYRO_SPIKE_DPS = 200; // impact angular rate spike (deg/s)
const GYRO_STILL_DPS = 20; // post-impact stillness (deg/s)

const ORIENT_DELTA_DEG = 45; // body orientation change (pitch/roll)
const IMPACT_NEIGHBOR = Math.round(0.2 * SAMPLE_RATE_HZ); // ±200ms window

// --------------------------------------------

function mag3(x, y, z) {
  return Math.sqrt(x * x + y * y + z * z);
}

// Pitch/roll from accelerometer (degrees)
function accelPitchRoll(ax, ay, az) {
  const pitch = Math.atan2(ay, Math.sqrt(ax * ax + az * az)) * (180 / Math.PI);
  const roll = Math.atan2(-ax, az) * (180 / Math.PI);
  return { pitch, roll };
}

// Per-device ring buffers
const state = new Map();
// state[deviceId] = {
//   acc: Float64Array, gyro: Float64Array, pitch: Float64Array, roll: Float64Array,
//   idx: number, filled: boolean
// }

function getState(deviceId) {
  if (!state.has(deviceId)) {
    state.set(deviceId, {
      acc: new Float64Array(WINDOW),
      gyro: new Float64Array(WINDOW),
      pitch: new Float64Array(WINDOW),
      roll: new Float64Array(WINDOW),
      idx: 0,
      filled: false,
    });
  }
  return state.get(deviceId);
}

/**
 * Update detector with one IMU sample.
 * gx,gy,gz are expected in deg/s. ax,ay,az in m/s^2.
 * Returns { fall:boolean, reason?:string, stats?:object }
 */
export function fallDetection(deviceId, ax, ay, az, gx, gy, gz) {
  const s = getState(deviceId);

  const accMag = mag3(ax, ay, az);
  const gyroMag = mag3(gx, gy, gz); // deg/s

  const { pitch, roll } = accelPitchRoll(ax, ay, az);

  const i = s.idx % WINDOW;
  s.acc[i] = accMag;
  s.gyro[i] = gyroMag;
  s.pitch[i] = pitch;
  s.roll[i] = roll;

  s.idx++;
  if (!s.filled && s.idx >= WINDOW) s.filled = true;
  if (!s.filled) return { fall: false, reason: 'warming_up' };

  // Turn buffers into chronological arrays starting at oldest sample
  const start = s.idx % WINDOW;
  const arr = (buf) => {
    const out = new Array(WINDOW);
    for (let k = 0; k < WINDOW; k++) {
      out[k] = buf[(start + k) % WINDOW];
    }
    return out;
  };

  const accArr = arr(s.acc);
  const gyroArr = arr(s.gyro);
  const pitchArr = arr(s.pitch);
  const rollArr = arr(s.roll);

  // 1) Find impact peak in this window
  let maxAcc = -Infinity,
    maxIdx = -1;
  for (let k = 0; k < WINDOW; k++) {
    if (accArr[k] > maxAcc) {
      maxAcc = accArr[k];
      maxIdx = k;
    }
  }
  if (maxAcc < IMPACT_ACC) {
    return { fall: false, reason: 'no_impact' };
  }

  // 2) Check for pre-impact free-fall (optional)
  const preStart = Math.max(0, maxIdx - IMPACT_NEIGHBOR);
  const preEnd = Math.max(0, maxIdx - 1);
  let preMinAcc = Infinity;
  for (let k = preStart; k <= preEnd; k++) preMinAcc = Math.min(preMinAcc, accArr[k]);
  const hasFreeFall = preMinAcc < FREEFALL_ACC;

  // 3) Gyro spike around impact (body angular jolt)
  const gStart = Math.max(0, maxIdx - IMPACT_NEIGHBOR);
  const gEnd = Math.min(WINDOW - 1, maxIdx + IMPACT_NEIGHBOR);
  let maxGyro = -Infinity;
  for (let k = gStart; k <= gEnd; k++) maxGyro = Math.max(maxGyro, gyroArr[k]);
  const hasGyroSpike = maxGyro > GYRO_SPIKE_DPS;

  // 4) Post-impact stillness (acc ~1g and low angular rate)
  const postStart = Math.min(WINDOW - 1, maxIdx + 1);
  const postEnd = Math.min(WINDOW - 1, maxIdx + POST_STILL_SAMPLES);
  let sumAcc = 0,
    sumGyro = 0,
    n = 0;
  for (let k = postStart; k <= postEnd; k++) {
    sumAcc += accArr[k];
    sumGyro += gyroArr[k];
    n++;
  }
  const meanAccPost = n ? sumAcc / n : Infinity;
  const meanGyroPost = n ? sumGyro / n : Infinity;
  const accIsStill = Math.abs(meanAccPost - G) < STILL_ACC_EPS;
  const gyroIsStill = meanGyroPost < GYRO_STILL_DPS;

  // 5) Orientation change (pre vs post)
  // Average pitch/roll in small windows before and after impact
  const preOrientStart = Math.max(0, maxIdx - Math.round(0.3 * SAMPLE_RATE_HZ));
  const preOrientEnd = Math.max(0, maxIdx - 1);
  const postOrientEnd = Math.min(WINDOW - 1, maxIdx + Math.round(0.3 * SAMPLE_RATE_HZ));
  const postOrientStart = Math.min(WINDOW - 1, maxIdx + 1);

  const avg = (buf, a, b) => {
    if (b < a) return 0;
    let ssum = 0,
      cnt = 0;
    for (let k = a; k <= b; k++) {
      ssum += buf[k];
      cnt++;
    }
    return cnt ? ssum / cnt : 0;
  };

  const prePitch = avg(pitchArr, preOrientStart, preOrientEnd);
  const preRoll = avg(rollArr, preOrientStart, preOrientEnd);
  const postPitch = avg(pitchArr, postOrientStart, postOrientEnd);
  const postRoll = avg(rollArr, postOrientStart, postOrientEnd);

  const deltaOrient = Math.max(Math.abs(postPitch - prePitch), Math.abs(postRoll - preRoll));
  const hasOrientChange = deltaOrient >= ORIENT_DELTA_DEG;

  // Decision: either strict (all conditions) or relaxed (no free-fall)
  const STRICT =
    hasGyroSpike &&
    accIsStill &&
    gyroIsStill &&
    hasOrientChange &&
    (hasFreeFall || maxAcc > IMPACT_ACC + 0.4 * G);

  if (STRICT) {
    return {
      fall: true,
      stats: {
        maxAcc,
        preMinAcc,
        hasFreeFall,
        maxGyro,
        meanAccPost,
        meanGyroPost,
        deltaOrient,
        impactIndex: maxIdx,
      },
    };
  }

  return {
    fall: false,
    reason: 'pattern_not_met',
    stats: {
      maxAcc,
      preMinAcc,
      hasFreeFall,
      maxGyro,
      meanAccPost,
      meanGyroPost,
      deltaOrient,
    },
  };
}
