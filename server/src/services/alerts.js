import Twilio from 'twilio';
import TelegramBot from 'node-telegram-bot-api';
import Alert from '../models/alert.js';

const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioTok = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;
const whatsappTo = process.env.ALERT_TO_WHATSAPP;

const tgToken = process.env.TELEGRAM_BOT_TOKEN;
const tgChatId = process.env.TELEGRAM_CHAT_ID;

const twilio = twilioSid && twilioTok ? new Twilio(twilioSid, twilioTok) : null;
const bot = tgToken ? new TelegramBot(tgToken, { polling: false }) : null;

// dedupe within 2 minutes per device/rule
async function shouldDeliver(deviceId, rule) {
  const since = new Date(Date.now() - 2 * 60 * 1000);
  const exists = await Alert.findOne({ deviceId, rule, createdAt: { $gte: since } });
  return !exists;
}

export async function fanoutAlert({ deviceId, rule, value }) {
  if (!(await shouldDeliver(deviceId, rule))) return;

  const text = `ALERT (${deviceId}): ${rule} = ${value}`;
  const deliveredTo = [];

  if (twilio && twilioFrom && whatsappTo) {
    try {
      await twilio.messages.create({ from: twilioFrom, to: whatsappTo, body: text });
      deliveredTo.push('whatsapp');
    } catch {}
  }
  if (bot && tgChatId) {
    try {
      await bot.sendMessage(tgChatId, text);
      deliveredTo.push('telegram');
    } catch {}
  }

  await Alert.create({ deviceId, rule, value, ts: new Date(), deliveredTo });
}
