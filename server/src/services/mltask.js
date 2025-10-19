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
  try {
    const res = await fetch('http://localhost:5001/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Ensure we send 38-length array
      body: JSON.stringify({ input: Array.from(inputArray) }),
      // optionally: timeout with AbortController in your env
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Flask ${res.status}: ${err}`);
    }

    const result = await res.json();
    if (
      !result?.fallProb ||
      !Array.isArray(result.fallProb) ||
      !Array.isArray(result.fallProb[0])
    ) {
      console.log('Bad response shape from Flask');
      throw new Error('Bad response shape from Flask');
    }
    return { fallProb: result.fallProb };
  } catch (e) {
    console.error('predictFall error:', e.message);
    // Fallback: safe default (no fall)
    return { fallProb: [[0.999, 0.001]] };
  }
}
