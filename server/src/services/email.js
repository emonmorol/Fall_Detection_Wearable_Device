import nodemailer from 'nodemailer';
import config from '../config.js';

export const sendMail = async (to, subject, html) => {
  try {
    // Decide port & secure mode based on Gmail's rules
    const port = Number(config.nodemailer.port) || 465;
    const secure = port === 465; // Gmail uses secure=true for port 465

    // Transporter setup
    const transporter = nodemailer.createTransport({
      host: config.nodemailer.host,
      port,
      secure,
      auth: {
        user: config.nodemailer.admin_email, // full Gmail address
        pass: config.nodemailer.admin_pass, // Gmail App Password
      },
    });

    // Verify connection before sending
    await transporter.verify();
    console.log('✅ SMTP server is ready to take messages');
    console.log('Sending email to:', to, 'Subject:', subject);
    console.log('Email content:', html);
    // Send email
    const info = await transporter.sendMail({
      from: `"AuraLink" <${config.nodemailer.admin_email}>`,
      to,
      subject,
      html,
    });

    return info;
  } catch (err) {
    console.error('❌ Email sending failed:');
    throw err; // Let controller handle the 500 response
  }
};
