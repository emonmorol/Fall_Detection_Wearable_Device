import Twilio from 'twilio';
import Alert from '../models/alert.js';
import device from '../models/device.js';
import config from '../config.js';

const twilioSid = config.twilioAccountSid;
const twilioTok = config.twilioAuthToken;
const twilioFrom = config.twilioWhatsAppFrom;
const twilioTo = config.twilioWhatsAppTo;

const twilio = twilioSid && twilioTok ? new Twilio(twilioSid, twilioTok) : null;

// dedupe within 2 minutes per device/rule
async function shouldDeliver(deviceId, rule) {
  const since = new Date(Date.now() - 2 * 60 * 1000);
  const exists = await Alert.findOne({ deviceId, rule, createdAt: { $gte: since } });
  return !exists;
}

export async function fanoutAlert({ deviceId, rule, value }) {
  // console.log('FANOUT ALERT', await shouldDeliver(deviceId, rule));
  if (!(await shouldDeliver(deviceId, rule))) return;
  const text = `ALERT (${deviceId}): ${rule} = ${value}`;
  const deliveredTo = [];

  if (twilio && twilioFrom && twilioTo) {
    try {
      const msg = await twilio.messages.create({ from: twilioFrom, to: twilioTo, body: text });
      // console.log('Twilio sent', msg);
      deliveredTo.push('whatsapp');
    } catch {}
  }

  await Alert.create({ deviceId, rule, value, ts: new Date(), deliveredTo });
}
