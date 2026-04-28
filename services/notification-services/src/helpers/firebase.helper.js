import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from 'dotenv';
dotenv.config();

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

export const sendPushNotification = async (token, title, body, data = {}) => {
    try {
        const message = {
            token,
            notification: { title, body },
            data,
        };

        const response = await admin.messaging().send(message);
        console.log("📲 Push Notification Sent:", response);
        return true;

    } catch (error) {
        console.error("❌ FCM Error:", error);
        return false;
    }
};