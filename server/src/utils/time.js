export function parseRangeToMs(range, defaultMs = 24 * 60 * 60 * 1000) {
  // Accepts strings like '10d', '24h', '15m', '1w' (case-insensitive)
  if (typeof range !== 'string') return defaultMs;
  const m = range.trim().match(/^([0-9]+)\s*(m|h|d|w)$/i);
  if (!m) return defaultMs;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult = { m: 60e3, h: 3600e3, d: 86400e3, w: 604800e3 };
  return n * (mult[unit] || defaultMs);
}
