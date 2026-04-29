import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from 'dotenv';
dotenv.config();

if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } catch (err) {
        console.warn("Firebase init skipped — invalid FIREBASE_SERVICE_ACCOUNT:", err.message);
    }
}

export const sendPushNotification = async (token, title, body, data = {}) => {
    if (!admin.apps.length) {
        console.warn("Push notification skipped — Firebase not configured");
        return false;
    }
    try {
        const message = { token, notification: { title, body }, data };
        const response = await admin.messaging().send(message);
        console.log("📲 Push Notification Sent:", response);
        return true;
    } catch (error) {
        console.error("❌ FCM Error:", error);
        return false;
    }
};