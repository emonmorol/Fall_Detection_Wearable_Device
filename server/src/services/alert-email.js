// Fall + generic physiologic alert emailer (ESM)
import { sendMail } from './email.js';

const lastSent = new Map();
const COOLDOWN_MS = Number(process.env.ALERT_COOLDOWN_MS || 120000);

function plainTextFall(a) {
  return [
    'FALL DETECTED',
    `Device: ${a.deviceId}`,
    `Time: ${new Date(a.ts).toISOString()}`,
    `Severity: ${String(a.severity || '').toUpperCase()}`,
    a.hr ? `HR: ${a.hr} bpm` : '',
    a.spo2 ? `SpO2: ${a.spo2}%` : '',
    a.note ? `Note: ${a.note}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function htmlFrame(title, rows) {
  const product = 'AuraLink';
  const dash = '#';
  const tr = (k, v) => `
    <tr>
      <td style=\"padding:8px 12px;background:#f6f7f9;border-bottom:1px solid #e6e8ee;font-weight:600\">${k}</td>
      <td style=\"padding:8px 12px;border-bottom:1px solid #e6e8ee\">${v}</td>
    </tr>`;
  return `<!doctype html>
<html><body style=\"font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica Neue,sans-serif;line-height:1.5;color:#0f172a\">
  <div style=\"max-width:560px;margin:24px auto;border:1px solid #e6e8ee;border-radius:12px;overflow:hidden\">
    <div style=\"padding:16px 20px;background:#0ea5e9;color:white;font-weight:700\">
      🛎️ ${product}: ${title}
    </div>
    <div style=\"padding:16px 20px\">
      <table style=\"width:100%;border-collapse:collapse\">
        ${rows.map(([k, v]) => tr(String(k), String(v))).join('')}
      </table>
      <div style=\"margin-top:16px\">
        <a href=\"${dash}\" style=\"display:inline-block;padding:10px 14px;text-decoration:none;border-radius:8px;border:1px solid #0ea5e9\">Open Dashboard</a>
      </div>
      <p style=\"font-size:12px;color:#475569;margin-top:16px\">
        You’re receiving this because you are listed as an emergency contact.
      </p>
    </div>
  </div>
</body></html>`;
}

function htmlFall(a) {
  const rows = [
    ['Device', a.deviceId],
    ['Time (UTC)', new Date(a.ts).toISOString()],
    ['Severity', String(a.severity || '').toUpperCase()],
    ['HR', a.hr ? `${a.hr} bpm` : '—'],
    ['SpO₂', a.spo2 ? `${a.spo2}%` : '—'],
    ['Note', a.note || '—'],
  ];
  return htmlFrame('FALL DETECTED Emergency', rows);
}

function labelForRule(rule) {
  const map = {
    fall: 'FALL',
    hrLow: 'LOW HEART RATE',
    hrHigh: 'HIGH HEART RATE',
    spo2Low: 'LOW SpO₂',
    spo2High: 'HIGH SpO₂',
    custom: 'ALERT',
  };
  return map[rule] || 'ALERT';
}

function plainTextGeneric(a) {
  return [
    `${labelForRule(a.rule)} ALERT`,
    `Device: ${a.deviceId}`,
    `Time: ${new Date(a.ts).toISOString()}`,
    a.value != null ? `Value: ${a.value}` : '',
    `Severity: ${String(a.severity || '').toUpperCase()}`,
    a.hr ? `HR: ${a.hr} bpm` : '',
    a.spo2 ? `SpO2: ${a.spo2}%` : '',
    a.note ? `Note: ${a.note}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function htmlGeneric(a) {
  const rows = [
    ['Device', a.deviceId],
    ['Time (UTC)', new Date(a.ts).toISOString()],
    ['Rule', a.rule],
    ['Value', a.value != null ? a.value : '—'],
    ['Severity', String(a.severity || '').toUpperCase()],
    ['HR', a.hr ? `${a.hr} bpm` : '—'],
    ['SpO₂', a.spo2 ? `${a.spo2}%` : '—'],
    ['Note', a.note || '—'],
  ];
  return htmlFrame(`${labelForRule(a.rule)} ALERT`, rows);
}

export async function sendFallEmail(alert) {
  const key = `${alert.deviceId || 'unknown'}:FALL`;
  const now = Date.now();
  if (lastSent.has(key) && now - (lastSent.get(key) || 0) < COOLDOWN_MS) return; // cooldown
  lastSent.set(key, now);

  const subject = `Aura Link Alert | ${String(alert.severity || '').toUpperCase()} | ${alert.deviceId}`;
  const text = plainTextFall(alert);
  const html = htmlFall(alert);

  const to = String(process.env.ALERT_EMAIL_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!to.length) throw new Error('ALERT_EMAIL_TO not configured');

  await sendMail(to, subject, html);
}

export async function sendAlertEmail(a) {
  // console.log(a);
  const key = `${a.deviceId || 'unknown'}:${a.rule || 'ALERT'}`;
  const now = Date.now();
  if (lastSent.has(key) && now - (lastSent.get(key) || 0) < COOLDOWN_MS) return; // cooldown
  lastSent.set(key, now);

  const subject = `${labelForRule(a.rule)} | ${String(a.severity || '').toUpperCase()} | ${a.deviceId}`;
  const html = htmlGeneric(a);

  const to = String(process.env.ALERT_EMAIL_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!to.length) throw new Error('ALERT_EMAIL_TO not configured');
  // console.log('Email object:', { to, subject, html });
  await sendMail(to, subject, html);
}
