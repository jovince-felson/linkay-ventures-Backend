import nodemailer from "nodemailer";
import ejs from "ejs";
import path from "path";
import { fileURLToPath } from "url";
import { mailQueue } from "./mail.queue.js";

console.log("📨 Mail worker booted");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_BASE = path.join(process.cwd(), "src", "mail");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: Number(process.env.MAIL_PORT) === 465,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

mailQueue.process(async (job) => {
  try {
    console.log("📨 Processing mail job:", job.id);

    const { emailData } = job.data;

    let htmlContent;

    if (emailData.templatePath && emailData.templateData) {
      const templatePath = path.join(TEMPLATE_BASE, emailData.templatePath);
      htmlContent = await ejs.renderFile(templatePath, emailData.templateData);
    } else {
      htmlContent = emailData.html || `<p>${emailData.text}</p>`;
    }

    const log = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: htmlContent,
    });

    console.log("📨 Mail sent:", log.messageId);

    console.log("✅ Mail sent to:", emailData.to);
  } catch (err) {
    console.error("❌ Mail job failed:", err);
    throw err;
  }
});
