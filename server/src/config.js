import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join((process.cwd(), '.env')) });

export default {
  port: process.env.PORT || 8080,
  mongoUri: process.env.MONGO_URI,
  dashboardOrigin: process.env.DASHBOARD_ORIGIN,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioWhatsAppFrom: process.env.TWILIO_WHATSAPP_FROM,
  alertToWhatsApp: process.env.ALERT_TO_WHATSAPP,
  nodemailer: {
    admin_email: process.env.ALERT_EMAIL_FROM?.match(/<(.+)>/)?.[1] || '',
    admin_pass: process.env.ALERT_EMAIL_PASS || '',
    email_to: process.env.ALERT_EMAIL_TO || '',
    reply_to: process.env.ALERT_EMAIL_REPLY_TO || '',
    from_name: process.env.ALERT_EMAIL_FROM?.replace(/<(.+)>/, '').trim() || 'Alert',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
  },
};
