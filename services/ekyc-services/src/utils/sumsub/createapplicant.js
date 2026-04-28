import axios from "axios";
import crypto from "crypto";
import { SUMSUB_LEVELS } from "../../config/constants.js";
import { encryptId } from "rhoam-shared-utils";

const SUMSUB_BASE_URL = process.env.SUMSUB_BASE_URL;
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN;
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY;

const signRequest = (method, url, body = "") => {
  const ts = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", SUMSUB_SECRET_KEY)
    .update(ts + method + url + body)
    .digest("hex");

  return { ts, signature };
};

export const createSumsubApplicant = async ({ user, level }) => {
  try {
    const encrypted_user_id = encryptId(user.id);
    const payload = {
      externalUserId: `USR_${encrypted_user_id}`,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    const body = JSON.stringify(payload);
    const url = `/resources/applicants?levelName=${level}`;

    const { ts, signature } = signRequest("POST", url, body);

    const response = await axios.post(
      SUMSUB_BASE_URL + url,
      body,
      {
        headers: {
          "X-App-Token": SUMSUB_APP_TOKEN,
          "X-App-Access-Sig": signature,
          "X-App-Access-Ts": ts,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data?.id) {
      return false;
    }

    return {
      applicant_id: response.data.id,
    };
  }
  catch (exception) {
    console.error("Error creating Sumsub applicant:", exception);
  }
};
