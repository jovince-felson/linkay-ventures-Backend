import nodemailer from "nodemailer";
import MailConfigs from "../models/mailconfig.model.js";
import FCMTokens from "../models/fcmtoken.model.js";
import { sendPushNotification } from "../helpers/firebase.helper.js";

const KYC_PUSH = {
  APPROVED: { title: 'Identity Verified', body: 'Your identity verification is approved. You can now invest.' },
  REJECTED: { title: 'Verification Failed', body: 'Your identity verification was unsuccessful. Please contact support.' },
  RESUBMIT_REQUIRED: { title: 'Action Required', body: 'Additional documents are needed. Please resubmit your KYC.' },
  PENDING: { title: 'Under Review', body: 'Your verification is being reviewed by our team.' },
};

export const sendKycPushNotification = async (req, res) => {
  const { userId, kycStatus } = req.body;
  if (!userId || !kycStatus) {
    return res.status(400).json({ success: false, message: 'userId and kycStatus are required' });
  }

  const payload = KYC_PUSH[kycStatus];
  if (!payload) {
    return res.status(400).json({ success: false, message: `Unknown kycStatus: ${kycStatus}` });
  }

  try {
    const tokens = await FCMTokens.findAll({ where: { user_id: userId } });
    if (!tokens.length) {
      return res.json({ success: true, message: 'No FCM tokens registered for user' });
    }

    await Promise.all(tokens.map(t => sendPushNotification(t.fcm_key, payload.title, payload.body, { kycStatus })));
    return res.json({ success: true, message: 'Push notifications sent' });
  } catch (err) {
    console.error('sendKycPushNotification error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to send push notification' });
  }
};

const getTransporter = async () => {
  try {
    const config = await MailConfigs.findOne({ where: { is_active: 1 } });
    if (config) {
      return nodemailer.createTransport({
        host: config.smtp_host,
        port: parseInt(config.smtp_port),
        secure: config.smtp_encryption === "ssl",
        auth: { user: config.smtp_user, pass: config.smtp_password },
      });
    }
  } catch {
    // fall through to env config
  }

  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: Number(process.env.MAIL_PORT) === 465,
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });
};

const FROM = () => `"Linkay" <${process.env.MAIL_FROM || process.env.MAIL_USER}>`;

export const sendVerificationEmail = async (req, res) => {
  const { email, firstName, verificationLink } = req.body;

  if (!email || !firstName || !verificationLink) {
    return res.status(400).json({ success: false, message: "email, firstName and verificationLink are required" });
  }

  try {
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: FROM(),
      to: email,
      subject: "Verify your email address — Linkay",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#4F46E5;">Welcome to Linkay, ${firstName}!</h2>
          <p>Please verify your email address by clicking the button below:</p>
          <p style="margin:30px 0;">
            <a href="${verificationLink}"
               style="background:#4F46E5;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">
              Verify Email Address
            </a>
          </p>
          <p style="color:#666;font-size:14px;">This link expires in 24 hours.</p>
          <p style="color:#666;font-size:14px;">If you did not create an account, you can safely ignore this email.</p>
        </div>
      `,
    });

    return res.json({ success: true, message: "Verification email sent" });
  } catch (err) {
    console.error("sendVerificationEmail error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to send email" });
  }
};

export const sendPasswordResetEmail = async (req, res) => {
  const { email, firstName, resetLink } = req.body;

  if (!email || !firstName || !resetLink) {
    return res.status(400).json({ success: false, message: "email, firstName and resetLink are required" });
  }

  try {
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: FROM(),
      to: email,
      subject: "Reset your password — Linkay",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#4F46E5;">Password Reset Request</h2>
          <p>Hi ${firstName}, you requested to reset your password.</p>
          <p style="margin:30px 0;">
            <a href="${resetLink}"
               style="background:#4F46E5;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">
              Reset Password
            </a>
          </p>
          <p style="color:#666;font-size:14px;">This link expires in 1 hour.</p>
          <p style="color:#666;font-size:14px;">If you did not request this, ignore this email — your password will remain unchanged.</p>
        </div>
      `,
    });

    return res.json({ success: true, message: "Password reset email sent" });
  } catch (err) {
    console.error("sendPasswordResetEmail error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to send email" });
  }
};

export const sendKycApprovedEmail = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "email is required" });

  try {
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: FROM(),
      to: email,
      subject: "Identity Verified — Linkay",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#16A34A;">Your identity has been verified!</h2>
          <p>Congratulations — your KYC verification was successful. You now have full access to the Linkay platform.</p>
          <p style="color:#666;font-size:14px;">If you have any questions, contact our support team.</p>
        </div>
      `,
    });
    return res.json({ success: true, message: "KYC approved email sent" });
  } catch (err) {
    console.error("sendKycApprovedEmail error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to send email" });
  }
};

export const sendKycRejectedEmail = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "email is required" });

  try {
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: FROM(),
      to: email,
      subject: "Identity Verification Failed — Linkay",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#DC2626;">Identity Verification Unsuccessful</h2>
          <p>Unfortunately, we were unable to verify your identity. This could be due to unclear documents or a mismatch in your information.</p>
          <p>Please contact our support team for assistance.</p>
          <p style="color:#666;font-size:14px;">We apologise for any inconvenience caused.</p>
        </div>
      `,
    });
    return res.json({ success: true, message: "KYC rejected email sent" });
  } catch (err) {
    console.error("sendKycRejectedEmail error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to send email" });
  }
};

export const sendKycResubmitEmail = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "email is required" });

  try {
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: FROM(),
      to: email,
      subject: "Action Required: Resubmit your KYC documents — Linkay",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#D97706;">Additional Documents Required</h2>
          <p>Your identity verification requires additional information. Please log in to your Linkay dashboard and resubmit your documents.</p>
          <p style="color:#666;font-size:14px;">If you need help, our support team is available to assist you.</p>
        </div>
      `,
    });
    return res.json({ success: true, message: "KYC resubmit email sent" });
  } catch (err) {
    console.error("sendKycResubmitEmail error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to send email" });
  }
};
