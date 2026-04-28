import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const SUMSUB_BASE_URL = process.env.SUMSUB_BASE_URL;
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN;
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY;
const SUMSUB_CLIENT_ID = process.env.SUMSUB_CLIENT_ID; // your app (not used here)
const DUE_CLIENT_ID = process.env.DUE_SUMSUB_CLIENT_ID; // IMPORTANT

const signRequest = (method, url, body = "") => {
    const ts = Math.floor(Date.now() / 1000);

    const signature = crypto
        .createHmac("sha256", SUMSUB_SECRET_KEY)
        .update(ts + method + url + body)
        .digest("hex");

    return { ts, signature };
};

export const generateShareToken = async (applicant_id) => {
    try {
        const url = "/resources/accessTokens/shareToken";

        const bodyObj = {
            applicantId: applicant_id,
            forClientId: DUE_CLIENT_ID, // 🔥 THIS IS CRITICAL
            ttlInSecs: 600,
        };

        const body = JSON.stringify(bodyObj);

        const { ts, signature } = signRequest("POST", url, body);

        const response = await axios.post(
            `${SUMSUB_BASE_URL}${url}`,
            bodyObj,
            {
                headers: {
                    "X-App-Token": SUMSUB_APP_TOKEN,
                    "X-App-Access-Sig": signature,
                    "X-App-Access-Ts": ts,
                    "Content-Type": "application/json",
                },
            }
        );

        if (!response.data?.token) {
            return false;
        }

        return response.data.token;

    } catch (exception) {
        console.error("Error generating Sumsub share token:", exception?.response?.data || exception.message);
        return false;
    }
};