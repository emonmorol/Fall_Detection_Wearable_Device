import fetch from 'node-fetch';

export function extractFeatures(imu) {
  const cols = ['ax', 'ay', 'az', 'gx', 'gy', 'gz'];
  const stats = (arr) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const std = Math.sqrt(arr.map((x) => (x - mean) ** 2).reduce((a, b) => a + b, 0) / arr.length);
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const absMean = arr.reduce((a, b) => a + Math.abs(b), 0) / arr.length;
    const eng = arr.map((x) => x ** 2).reduce((a, b) => a + b, 0) / arr.length;
    return [mean, std, min, max, absMean, eng];
  };

  const values = cols.reduce((acc, c) => {
    acc[c] = imu.map((p) => p[c]);
    return acc;
  }, {});

  let feats = [];
  cols.forEach((c) => feats.push(...stats(values[c])));
  const ra = values.ax.map((_, i) =>
    Math.sqrt(values.ax[i] ** 2 + values.ay[i] ** 2 + values.az[i] ** 2),
  );
  const raMean = ra.reduce((a, b) => a + b, 0) / ra.length;
  const raStd = Math.sqrt(ra.map((x) => (x - raMean) ** 2).reduce((a, b) => a + b, 0) / ra.length);
  feats.push(Math.max(...ra), raStd);
  return feats;
}

export async function predictFall(inputArray) {
  const res = await fetch('http://localhost:5001/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: inputArray }),
  });
  const result = await res.json();
  console.log('=======================response from predictfall====================');
  const { fallProb, label } = result;

  console.log('====================================================================');
  return { fallProb, label };
}
