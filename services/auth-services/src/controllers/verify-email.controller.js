import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/users.model.js";
import { logger, RESPONSE_CODES } from "rhoam-shared-utils";

dotenv.config();

const EMAIL_VERIFICATION_SECRET = process.env.EMAIL_VERIFICATION_SECRET;

export const VerifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is missing.",
      });
    }

    // Verify JWT signature and expiry
    let payload;
    try {
      payload = jwt.verify(token, EMAIL_VERIFICATION_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        // Spec: 410 on expiry with 'Request new link' CTA
        return res.status(410).json({
          success: false,
          response_code: "AUTH_003",
          message: "Verification link has expired. Please request a new one.",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Invalid verification link.",
      });
    }

    // Match token against the stored column — prevents reuse after rotation
    // or if the user registers again and gets a new token
    const user = await User.findOne({
      where: {
        id: payload.user_id,
        email_verification_token: token,
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or already used verification link.",
      });
    }

    // Activate account and null the token — enforces single-use
    user.email_verified = true;
    user.status = "ACTIVE";
    user.email_verification_token = null;
    await user.save();

    logger.info("Email verified", { user_id: user.id });

    return res.status(200).json({
      success: true,
      message: "Email verified successfully. You can now log in.",
    });
  } catch (exception) {
    logger.error("VerifyEmail Error", exception);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
      response_code: RESPONSE_CODES.SERVER_ERROR,
    });
  }
};