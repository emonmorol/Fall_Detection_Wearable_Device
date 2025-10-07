import Alert from '../models/Alert.js';
import { sendAlertEmail, sendFallEmail } from './alert-email.js';

const DEDUP_MS = Number(process.env.ALERT_COOLDOWN_MS || 120000);

function computeSeverity(rule, value) {
  if (rule === 'fall') return 'critical';
  if (rule === 'spo2Low') return value <= 88 ? 'critical' : 'high';
  if (rule === 'hrHigh') return value >= 150 ? 'high' : 'low';
  if (rule === 'hrLow') return value <= 45 ? 'high' : 'low';
  return 'high';
}

function buildMessage({ deviceId, rule, value, severity }) {
  const map = {
    fall: 'Fall detected',
    hrLow: `Low heart rate: ${value} bpm`,
    hrHigh: `High heart rate: ${value} bpm`,
    spo2Low: `Low SpO₂: ${value}%`,
    spo2High: `High SpO₂: ${value}%`,
    custom: `Alert value: ${value}`,
  };
  return `[${severity.toUpperCase()}] ${map[rule] || 'Alert'} for ${deviceId}`;
}

export async function fanoutAlert({
  deviceId,
  rule,
  value,
  ts = new Date().toISOString(),
  meta = {},
}) {
  const since = new Date(Date.now() - DEDUP_MS);
  const recent = await Alert.findOne({ deviceId, rule, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .lean();
  if (recent) return { ok: true, deduped: true, id: recent._id };

  const severity = computeSeverity(rule, value);
  const message = buildMessage({ deviceId, rule, value, severity });

  const alert = await Alert.create({
    deviceId,
    rule,
    value,
    severity,
    message,
    ts: new Date(ts),
    meta,
  });

  try {
    console.log('rule:', rule);
    if (rule === 'fall') {
      await sendFallEmail({
        deviceId,
        ts,
        severity,
        hr: meta.hr,
        spo2: meta.spo2,
        note: meta.note,
      });
    } else {
      await sendAlertEmail({
        deviceId,
        ts,
        rule,
        value,
        severity,
        hr: meta.hr,
        spo2: meta.spo2,
        note: meta.note,
      });
    }
    await Alert.updateOne(
      { _id: alert._id },
      { $set: { 'delivery.email.sent': true, 'delivery.email.sentAt': new Date() } },
    );
  } catch (e) {
    await Alert.updateOne(
      { _id: alert._id },
      { $set: { 'delivery.email.error': String(e?.message || e) } },
    );
    throw e;
  }

  return { ok: true, id: alert._id };
}
