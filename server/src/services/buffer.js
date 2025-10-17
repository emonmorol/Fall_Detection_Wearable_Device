const buffers = {}; // { deviceId: [ {ax,ay,az,gx,gy,gz}, ... ] }
export const WINDOW = 100; // 2s @ 50Hz

export function pushIMUData(deviceId, imuArray) {
  if (!buffers[deviceId]) buffers[deviceId] = [];
  buffers[deviceId].push(...imuArray);
  const over = buffers[deviceId].length - WINDOW;
  if (over > 0) buffers[deviceId].splice(0, over);
}

export function getLatestWindow(deviceId) {
  return buffers[deviceId] ? buffers[deviceId].slice(-WINDOW) : [];
}
