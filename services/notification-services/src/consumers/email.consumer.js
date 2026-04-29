import nodemailer from "nodemailer";
import { Kafka } from "kafkajs";
import MailConfigs from "../models/mailconfig.model.js";
import { logger } from "rhoam-shared-utils";

dotenv.config();

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "email-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || "email-service-group",
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
    // true for port 465 (SSL), false for 587 (TLS/STARTTLS)
    secure: config.smtp_encryption === "ssl",
    auth: {
      user: config.smtp_user,
      pass: config.smtp_password,
    },
  });

// ── Email Templates ───────────────────────────────────────────────────────────

const buildVerificationEmail = (to, firstName, verification_link) => ({
  from: `"No Reply" <${process.env.MAIL_FROM_ADDRESS}>`,
  to,
  subject: "Verify your email address",
  html: `
    <p>Hi ${firstName},</p>
    <p>Thanks for registering. Click the link below to verify your email address.</p>
    <p>
      <a href="${verification_link}" target="_blank">Verify Email Address</a>
    </p>
    <p>This link expires in 24 hours.</p>
    <p>If you didn't create an account, you can safely ignore this email.</p>
  `,
});

// ── Handlers ──────────────────────────────────────────────────────────────────

const handleEmailVerify = async (payload) => {
  const { email, firstName, verification_link } = payload;

  const smtpConfig = await getActiveSmtpConfig();
  const transporter = createTransporter(smtpConfig);
  const mailOptions = buildVerificationEmail(email, firstName, verification_link);

  await transporter.sendMail(mailOptions);

  logger.info("Verification email sent", { email });
};

// Register additional event handlers here as the service grows:
// const handlePasswordReset = async (payload) => { ... };

const HANDLERS = {
  USER_EMAIL_VERIFY: handleEmailVerify,
  // USER_PASSWORD_RESET: handlePasswordReset,
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

        if (!handler) {
          // Not every event on this topic is for the email service — skip silently
          return;
        }

        await handler(payload);
      } catch (err) {
        // Log and continue — never crash the consumer on a single bad message.
        // Route to a dead-letter topic here for production retry handling.
        logger.error("Email consumer handler error", {
          error: err.message,
          key: message.key?.toString(),
        });
      }
    },
  });

  logger.info("Email consumer started");
};