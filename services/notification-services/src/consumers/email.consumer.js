import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { Kafka } from "kafkajs";
import MailConfigs from "../models/mailconfig.model.js";
import { logger } from "rhoam-shared-utils";

dotenv.config();

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "email-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_EMAIL_GROUP_ID || "email-service-group",
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const getActiveSmtpConfig = async () => {
  const config = await MailConfigs.findOne({ where: { is_active: 1 } });
  if (!config) throw new Error("No active SMTP configuration found");
  return config;
};

const createTransporter = (config) =>
  nodemailer.createTransport({
    host: config.smtp_host,
    port: parseInt(config.smtp_port),
    secure: config.smtp_encryption === "ssl",
    auth: {
      user: config.smtp_user,
      pass: config.smtp_password,
    },
  });

const getFallbackTransporter = () =>
  nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: Number(process.env.MAIL_PORT) === 465,
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });

const getTransporter = async () => {
  try {
    const config = await MailConfigs.findOne({ where: { is_active: 1 } });
    return config ? createTransporter(config) : getFallbackTransporter();
  } catch {
    return getFallbackTransporter();
  }
};

// ── Email Templates ───────────────────────────────────────────────────────────

const buildVerificationEmail = (to, firstName, verificationLink) => ({
  from: `"Linkay" <${process.env.MAIL_FROM || process.env.MAIL_USER}>`,
  to,
  subject: "Verify your email address",
  html: `
    <p>Hi ${firstName},</p>
    <p>Thanks for registering. Click the link below to verify your email address.</p>
    <p>
      <a href="${verificationLink}" target="_blank"
         style="background:#4F46E5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">
        Verify Email Address
      </a>
    </p>
    <p>This link expires in 24 hours.</p>
    <p>If you didn't create an account, you can safely ignore this email.</p>
  `,
});

const buildPasswordResetEmail = (to, firstName, resetLink) => ({
  from: `"Linkay" <${process.env.MAIL_FROM || process.env.MAIL_USER}>`,
  to,
  subject: "Reset your password",
  html: `
    <p>Hi ${firstName},</p>
    <p>You requested a password reset. Click the link below to set a new password.</p>
    <p>
      <a href="${resetLink}" target="_blank"
         style="background:#4F46E5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">
        Reset Password
      </a>
    </p>
    <p>This link expires in 1 hour.</p>
    <p>If you did not request this, please ignore this email — your password will remain unchanged.</p>
  `,
});

// ── Handlers ──────────────────────────────────────────────────────────────────

const handleEmailVerify = async (payload) => {
  const { email, firstName, verification_link } = payload;
  const transporter = await getTransporter();
  await transporter.sendMail(buildVerificationEmail(email, firstName, verification_link));
  logger.info("Verification email sent", { email });
};

const handlePasswordReset = async (payload) => {
  const { email, firstName, reset_link } = payload;
  const transporter = await getTransporter();
  await transporter.sendMail(buildPasswordResetEmail(email, firstName, reset_link));
  logger.info("Password reset email sent", { email });
};

const HANDLERS = {
  USER_EMAIL_VERIFY: handleEmailVerify,
  USER_PASSWORD_RESET: handlePasswordReset,
};

// ── Consumer Bootstrap ────────────────────────────────────────────────────────

export const startEmailConsumer = async () => {
  await consumer.connect();

  await consumer.subscribe({
    topic: process.env.KAFKA_USER_EVENTS_TOPIC || "user-events",
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const key = message.key?.toString();
        const payload = JSON.parse(message.value.toString());

        const handler = HANDLERS[key];
        if (!handler) return; // not an email event — skip silently

        await handler(payload);
      } catch (err) {
        logger.error("Email consumer handler error", {
          error: err.message,
          key: message.key?.toString(),
        });
      }
    },
  });

  logger.info("Email consumer started");
};
