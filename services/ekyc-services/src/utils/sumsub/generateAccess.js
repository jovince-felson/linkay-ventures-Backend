import axios from "axios";
import crypto from "crypto";
import { ALLOWED_SUMSUB_LEVELS } from "../../config/constants.js";

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

// export const generateSumsubAccessToken = async (applicant_id, level_name) => {
//   try{
//     if (!ALLOWED_SUMSUB_LEVELS.includes(level_name)) {
//     throw new Error("Invalid Sumsub level");
//   }

//   const url = `/resources/accessTokens?userId=${applicant_id}&levelName=${level_name}&ttlInSecs=600`;

//   const { ts, signature } = signRequest("POST", url);

//   const response = await axios.post(
//     SUMSUB_BASE_URL + url,
//     null,
//     {
//       headers: {
//         "X-App-Token": SUMSUB_APP_TOKEN,
//         "X-App-Access-Sig": signature,
//         "X-App-Access-Ts": ts,
//       },
//     }
//   );

//   if (!response.data?.token) {
//     return false;
//   }

//   return response.data.token;
//   }
//   catch(error)
//   {
//     console.error("Error generating Sumsub access token:", error);
//   }
// };

export const generateSumsubAccessToken = async (
  applicant_id,
  external_user_id, 
  level_name
) => {
  try {
    if (!ALLOWED_SUMSUB_LEVELS.includes(level_name)) {
      throw new Error("Invalid Sumsub level");
    }
      
    const body = JSON.stringify({
      applicantId: applicant_id
    });

    const url =
      `/resources/accessTokens?userId=${external_user_id}&levelName=${level_name}&ttlInSecs=600`;

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

    return response.data?.token || null;
  } catch (err) {
    console.error("Error generating Sumsub access token:", err);
    return null;
  }
};

