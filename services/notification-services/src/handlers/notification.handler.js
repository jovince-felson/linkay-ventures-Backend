import { logger } from "rhoam-shared-utils";
import FCMToken from "../models/fcmtoken.model.js";
import { addMailJob } from "../queues/mail.queue.js";
import { GetActiveMail } from "../helpers/common.helper.js";
import { sendPushNotification } from "../helpers/firebase.helper.js";
import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

export const handleFCMStore = async (data) => {
    try {
        const user_id = data.user_id;

        const previous_token = await FCMToken.findOne({
            where: {
                user_id: user_id,
            },
        });

        if (previous_token) {
            previous_token.fcm_key = data.fcm_token;
            await previous_token.save();

            return true;
        }

        await FCMToken.create({
            user_id: user_id,
            fcm_key: data.fcm_token,
        });

        return true;
    } catch (exception) {
        logger.error("Error In Notification Handle Fcm Store", exception);
        return false;
    }
};

export const handleUserOTPEmail = async (data) => {
    try {
        const email = data.email;
        const otp = data.otp;

        const ActiveMail = await GetActiveMail();

        let mailConfig;

        if (ActiveMail) {
            mailConfig = {
                host: ActiveMail.smtp_host,
                port: ActiveMail.smtp_port,
                secure: Number(ActiveMail.smtp_port) === 465,
                auth: {
                    user: ActiveMail.smtp_user,
                    pass: ActiveMail.smtp_password,
                },
            };
        } else {
            mailConfig = {
                host: process.env.MAIL_HOST,
                port: process.env.MAIL_PORT,
                secure: Number(process.env.MAIL_PORT) === 465,
                auth: {
                    user: process.env.MAIL_USER,
                    pass: process.env.MAIL_PASS,
                },
            };
        }

        await addMailJob({
            mailConfig,
            emailData: {
                to: data.email,
                subject: "Two Factor Authentication",
                templatePath: "otp.ejs",
                templateData: {
                    title: "Two Factor Authentication",
                    message: "Two Factor Authentication",
                    otp: otp,
                    email: email,
                    otp_expiry_text: "OTP Will Be Expired After 10Minutes",
                },
                text: "Two Factor Verification Email",
            },
        });
    } catch (exception) {
        logger.error("Error In Notification Handle User OTP", exception);
        return false;
    }
};

export const handleUserOTPMobile = async (data) => {
    try {
        const TWILIO_SID = process.env.TWILIO_SID;
        const TWILIO_AUTH = process.env.TWILIO_AUTH;
        const TWILIO_NUMBER = process.env.TWILIO_NUMBER
        const client = twilio(TWILIO_SID, TWILIO_AUTH);

        const message = await client.messages.create({
            body: `[RHOAM] Your verification code is ${data.otp}. Do not share this code with anyone. Valid for 10 minutes.`,
            from: `${TWILIO_NUMBER}`,
            to: data.phone_number,
        });
    } catch (exception) {
        return false;
    }
};
