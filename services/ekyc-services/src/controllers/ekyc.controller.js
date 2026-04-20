import EkycProfiles from "../models/ekyc_profiles.model.js";
import EkycDocs from "../models/ekyc_documents.model.js";
import EkycAudit from "../models/ekyc_audit.model.js";
import EkycSteps from "../models/ekyc_steps.model.js";
import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import { EKYC_STEPS, logger, RESPONSE_CODES, publish, Topics, Keys, decryptId, encryptId, SERVICE_URLS } from "rhoam-shared-utils";

import { createSumsubApplicant } from "../utils/sumsub/createapplicant.js";
import { generateSumsubAccessToken } from "../utils/sumsub/generateAccess.js";
import { SUMSUB_LEVELS, ALLOWED_SUMSUB_LEVELS } from "../config/constants.js";



export const FetchLevels = async (req, res) => {
    try {
        const levels = SUMSUB_LEVELS;

        return res.status(200).json({
            success: true,
            message: 'Levels Fetched Successfully',
            data: {
                levels,
            },
        });
    }
    catch (exception) {
        logger.error("Ekyc Fetch Levels Error");
        return res.status(500).json({
            success: false,
            response_code: RESPONSE_CODES.SERVER_ERROR,
            message: 'Something went wrong , Please Try Again Later !',
            error: exception.message,
        });
    }
};

export const FetchUserStatus = async (req, res) => {
    try {
        const { user_id } = req.body;

        const decrypted_user_id = decryptId(user_id);

        const profile = await EkycProfiles.findOne({
            where: { user_id: decrypted_user_id }
        });

        if (!profile) {
            return res.status(200).json({
                success: true,
                message: "No Verification Process Initiated, Please Click On Sumsub Button To Start Verification",
                response_code: RESPONSE_CODES.EKYC_NOT_INITIATED,
                data: {
                    ekyc_status: "NOT_INITIATED",
                    ekyc_profile_id: null,
                }
            });
        }

        const steps = await EkycSteps.findOne({
            where: { ekyc_profile_id: profile.id }
        });

        if(!steps)
        {
            return res.status(200).json({
                success: false,
                message: "No Verification Steps Found",
                response_code: RESPONSE_CODES.EKYC_NOT_INITIATED,
                data: {}
            });
        }

        if(steps.step_status === "PASSED")
        {
            return res.status(200).json({
                success: true,
                message: "EKYC Verified Successfully",
                response_code: RESPONSE_CODES.EKYC_VERIFICATION_COMPLETE,
                data: {
                    ekyc_status: steps.step_status,
                    ekyc_profile_id: encryptId(profile.id),
                }
            });
        }

        if(steps.step_status === "FAILED")
        {
            return res.status(200).json({
                success: false,
                message: "EKYC Verification Failed",
                response_code: RESPONSE_CODES.EKYC_VERIFICATION_FAILED,
                data: {
                    ekyc_status: steps.step_status,
                    ekyc_profile_id: encryptId(profile.id),
                }
            });
        }

        if(steps.step_status === "PENDING")
        {
            return res.status(200).json({
                success: false,
                message: "EKYC Verification Pending",
                response_code: RESPONSE_CODES.EKYC_VERIFICATION_PENDING,
                data: {
                    ekyc_status: steps.step_status,
                    ekyc_profile_id: encryptId(profile.id),
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: "EKYC Status Fetched",
            response_code: RESPONSE_CODES.SUCCESS,
            data: {
                levels,
                ekyc_status: encryptId(profile.ekyc_status),
                ekyc_profile_id: encryptId(profile.id),
            }
        });

    } catch (exception) {
        logger.error("User EKYC Fetch Status Error", exception);
        return res.status(500).json({
            success: false,
            message: "Something went wrong, Please Try Again Later ..!",
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

export const StorePersonalInfo = async (req, res) => {
    try {
        const { user_id, session_id, device_id, device_name, name, dob, gender, nationality, country_of_residence } = req.body;

        const decrypted_user_id = decryptId(user_id);
        const decrypted_nationality = decryptId(nationality);
        const decrypted_cor = decryptId(country_of_residence);

        const check_profiles = await EkycProfiles.findOne({
            where: {
                user_id: decrypted_user_id
            }
        });

        let ekyc_profile_id;

        if (!check_profiles) {
            const create_profile = await EkycProfiles.create({
                user_id: decrypted_user_id,
                created_at: new Date(),
            });

            // Steps

            ekyc_profile_id = create_profile.id;

            const create_steps = await EkycSteps.create({
                step: EKYC_STEPS.PERSONAL_INFO,
                step_status: 1,
                ekyc_profile_id: create_profile.id,
                created_at: new Date(),
            });
        }

        await publish(Topics.EKYC_EVENTS, [
            {
                key: Keys.USER_DETAILS_UPDATE,
                value: JSON.stringify({
                    user_id: user_id,
                    name: name,
                    dob: dob,
                    gender: gender,
                    nationality: nationality,
                    country_of_residence: country_of_residence,
                })
            }
        ]);

        return res.status(201).json({
            success: true,
            message: 'User Personal Information Saved Successfully',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            data: {
                ekyc_profile_id: encryptId(ekyc_profile_id),
            }
        })
    }
    catch (exception) {
        logger.error("Store Personal Info Error", exception);
        return res.status(500).json({
            success: false,
            response_code: RESPONSE_CODES.SERVER_ERROR,
            message: 'Something went wrong, Please Try Again ..!',
            error: exception.message,
        });
    }
};

export const InitiateSumSub = async (req, res) => {
    try {
        const { user_id, level_name } = req.body;

        if (!level_name || !ALLOWED_SUMSUB_LEVELS.includes(level_name)) {
            return res.status(400).json({
                success: false,
                message: "Invalid or missing KYC level",
            });
        }

        const decrypted_user_id = decryptId(user_id);

        let ekyc_profile = await EkycProfiles.findOne({
            where: { user_id: decrypted_user_id },
        });

        if (!ekyc_profile) {
            ekyc_profile = await EkycProfiles.create({
                user_id: decrypted_user_id,
                created_at: new Date(),
            });
        }

        const userResponse = await axios.post(
            `${SERVICE_URLS.auth_services}/get-details`,
            { user_id }
        );

        if (!userResponse.data?.success) {
            return res.status(400).json({
                success: false,
                message: "User details fetch failed",
            });
        }

        const user = userResponse.data.data;

        if (!ekyc_profile.applicant_id) {
            const applicant = await createSumsubApplicant({ user, level: level_name });
            if (!applicant) {
                return res.status(500).json({
                    success: false,
                    message: "Sumsub applicant creation failed",
                });
            }

            ekyc_profile.applicant_id = applicant.applicant_id;
            await ekyc_profile.save();
        }

        const accessToken = await generateSumsubAccessToken(
            ekyc_profile.applicant_id,
            encryptId(decrypted_user_id),
            level_name
        );

        if (!accessToken) {
            return res.status(500).json({
                success: false,
                message: "Sumsub access token generation failed",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Sumsub initiated successfully",
            data: {
                sumsub_access_token: accessToken,
                sumsub_base_url: process.env.SUMSUB_SDK_URL,
                sumsub_applicant_id: ekyc_profile.applicant_id,
                user_id: encryptId(decrypted_user_id),
                ekyc_profile_id: encryptId(ekyc_profile.id),
            },
        });
    } catch (err) {
        logger.error("Initiate Sumsub Error", err);
        return res.status(500).json({
            success: false,
            message: "Something went wrong",
        });
    }
};


export const FetchDocDetails = async (req, res) => {
    try {
        const { user_id, profile_id, step_id } = req.body;

        const decrypted_user_id = decryptId(user_id);
        const decrypted_profile_id = decryptId(profile_id);
        const decrypted_step_id = decryptId(step_id);

        const findProfile = await EkycProfiles.findOne({
            where: {
                user_id: decrypted_user_id,
                id: decrypted_profile_id,
            }
        });

        if (!findProfile) {
            return res.status(200).json({
                success: true,
                message: "No Verification Process Initiated",
                response_code: RESPONSE_CODES.EKYC_NOT_INITIATED,
                data: {
                    personal_info: false,
                    document_submission: false,
                    selfie_verification: false,
                }
            });
        }

        // Fetch Document

        const fetch_doc = await EkycDocs.findOne({
            where: {
                ekyc_profile_id: decrypted_profile_id,
                ekyc_step: decrypted_step_id,
                status: 1,
                trash: "NO",
            }
        });

        if (!fetch_doc) {
            return res.status(400).json({
                success: false,
                message: 'Document Not Uploaded Yet',
                response_code: RESPONSE_CODES.OPERATION_FAILED,
            });
        }

        const details = {
            file_url: fetch_doc.file_path + fetch_doc.file_key,
            file_id: encryptId(fetch_doc.file_id),
            document_type: encryptId(fetch_doc.document_type),
        };

        return res.status(200).json({
            success: true,
            message: 'Document Fetched Successfully',
            data: {
                details,
            },
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
        });

    }
    catch (exception) {
        logger.error("Fetch Details Error In EKYC", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

export const HandleWebHook = async (req, res) => {
    try {
        const payload = req.body;

        if (payload?.type !== "applicantReviewed") {
            console.log("Event Type Not Handled");
            return res.status(200).json({
                success: true,
                message: "Event Type Not Handled",
            });
        }

        const applicantId = payload.applicantId;
        const levelName = payload.levelName;
        const reviewAnswer = payload.reviewResult?.reviewAnswer;
        const rejectLabels = payload.review?.reviewResult?.rejectLabels || [];

        if (!applicantId || !levelName || !reviewAnswer) {
            return res.status(200).json({ success: true });
        }

        const ekycProfile = await EkycProfiles.findOne({
            where: { applicant_id: applicantId }
        });

        if (!ekycProfile) {
            return res.status(200).json({ success: true });
        }

        const stepStatus =
            reviewAnswer === "GREEN" ? "PASSED" : "FAILED";


        const user_id = encryptId(ekycProfile.user_id);

        await EkycSteps.upsert({
            ekyc_profile_id: ekycProfile.id,
            step: levelName,
            step_status: stepStatus,
            updated_at: new Date(),
        });

        await EkycAudit.create({
            ekyc_profile_id: ekycProfile.id,
            level_name: levelName,
            status: stepStatus,
            reason: rejectLabels.length ? rejectLabels.join(", ") : null,
            reviewed_at: new Date(),
            created_at: new Date(),
        });


        if (stepStatus === "PASSED") {
            ekycProfile.ekyc_status = 1;
            ekycProfile.updated_at = new Date();
            await ekycProfile.save();

            await publish(Topics.EKYC_EVENTS, [
                {
                    key: Keys.EKYC_VERIFICATION_COMPLETED,
                    value: JSON.stringify({
                        user_id: user_id,
                    }),
                }
            ]);
        }

        return res.status(200).json({
            success: true,
            message: "WebHook Processed Successfully",
        });

    }
    catch (exception) {
        logger.error("SumSub WebHook Handler Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

export const FetchKycStatus = async (req, res) => {
    try {
        const { user_id, ekyc_profile_id } = req.body;

        const ekyc_profile = await EkycProfiles.findOne({
            where: {
                user_id: decryptId(user_id),
                id: decryptId(ekyc_profile_id),
            }
        });

        if (!ekyc_profile) {
            return res.status(400).json({
                success: false,
                message: 'EKYC Profile Not Found',
                response_code: RESPONSE_CODES.EKYC_NOT_INITIATED,
            });
        }

        switch (ekyc_profile.ekyc_status) {
            case 0:
                return res.status(200).json({
                    success: true,
                    message: 'EKYC Pending',
                    response_code: RESPONSE_CODES.EKYC_INITIATED,
                    data: {
                        ekyc_status: encryptId(ekyc_profile.id),
                    }
                });

            case 1:
                return res.status(200).json({
                    success: true,
                    message: 'EKYC Verified Successfully',
                    response_code: RESPONSE_CODES.EKYC_VERIFICATION_COMPLETE,
                    data: {
                        ekyc_status: encryptId(ekyc_profile.id),
                    }
                });

            case 2:
                return res.status(200).json({
                    success: true,
                    message: 'EKYC Rejected',
                    response_code: RESPONSE_CODES.EKYC_VERIFICATION_FAILED,
                    data: {
                        ekyc_status: encryptId(ekyc_profile.id),
                    }
                });

            case 3:
                return res.status(200).json({
                    success: true,
                    message: 'EKYC Manual Approval Needed',
                    response_code: RESPONSE_CODES.EKYC_MANNUAL_APPROVAL_NEEDED,
                    data: {
                        ekyc_status: encryptId(ekyc_profile.id),
                    }
                });

            default:
                return res.status(500).json({
                    success: false,
                    message: 'Invalid EKYC Status',
                    response_code: RESPONSE_CODES.SERVER_ERROR,
                });
        }
    }
    catch (exception) {
        logger.error("EKYC Status Fetch Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }

};

export const FetchEkycDetails = async(req,res) => {
    try{

        const {user_id } = req.body;

        const decrypted_user_id = decryptId(user_id);

        // Fetch Profile
        const fetch_profile = await EkycProfiles.findOne({
            where:{
                user_id: decrypted_user_id,
            }
        });

        if(!fetch_profile)
        {
            return res.status(400).json({
                success: false,
                response_code: RESPONSE_CODES.INVALID_INPUT,
                message: 'Ekyc Details Not Found',
                data:{}
            });
        }

        const data = {
            "ekyc_attempts" : fetch_profile.attempts,
            "ekyc_status" : KYC_ENUM[fetch_profile.ekyc_status],
            "applicant_id" : fetch_profile.applicant_id,
            "inspection_id" : fetch_profile.inspection_id,
            "last_submitted_at" : fetch_profile.last_submitted_at,
        }; 
        
        // Fetch Ekyc Audits
        const fetch_audits = await EkycAudit.findOne({
            where:{
                ekyc_profile_id: fetch_profile.id
            }
        });

        let audit_data = {};
        if(fetch_audits)
        {
            audit_data = {
                "level_name" : fetch_audits.level_name,
                "status" : fetch_audits.status,
                "reason" : fetch_audits.reason,
                "reviewed_at" : fetch_audits.reviewed_at
            };
        }

        return res.status(200).json({
            success: true,
            message: 'Ekyc Details Fetched Successfully',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            data:{
                data,
                audit_data,
            }
        }); 



    }
    catch(exception)
    {
        logger.error("EKYC Details Fetch Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};  
