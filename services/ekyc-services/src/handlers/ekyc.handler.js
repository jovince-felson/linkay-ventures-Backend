import { decryptId, logger } from "rhoam-shared-utils";
import EkycProfiles from "../models/ekyc_profiles.model.js";
import EkycDocs from "../models/ekyc_documents.model.js";
import EkycSteps from "../models/ekyc_steps.model.js";

export const StoreDocumentData = async (data) => {
    try {

        const user_id = data.user_id;
        const ekyc_profile_id = data.ekyc_profile_id;
        const file_id = data.file_id;
        const file_path = data.file_path;
        const file_key = data.file_key;
        const ekyc_step = data.ekyc_step;
        const document_type = data.document_type;
        const meta_data = data.meta_data;

        const profile_id = decryptId(ekyc_profile_id);

        const profile = await EkycProfiles.findOne({
            where: {
                id: profile_id,
                user_id: decryptId(user_id),
            }
        });

        if (!profile) {
            return false;
        }

        // Trash Previous Files 
        const previous_doc = await EkycDocs.findOne({
            where: {
                ekyc_profile_id: profile_id,
                ekyc_step: ekyc_step,
                document_type: document_type,
                status: 1,
                trash: "NO"
            }
        });

        if (previous_doc) {
            previous_doc.status = 1;
            previous_doc.trash = "YES";
            await previous_doc.save();
        }


        const store_document = await EkycDocs.create({
            ekyc_profile_id: profile_id,
            ekyc_step: ekyc_step,
            file_path: file_path,
            file_key: file_key,
            file_id: file_id,
            ekyc_meta_data: meta_data,
            document_type: data.document_type,
            created_at: new Date(),
        });

        // Finde Steps
        const find_step = await EkycSteps.findOne({
            where: {
                ekyc_profile_id: profile_id,
                step: ekyc_step,
                step_status: 1,
            }
        });

        if (!find_step) {
            // Create Step
            const steps = await EkycSteps.create({
                step_status: 1,
                step: ekyc_step,
                ekyc_profile_id: profile_id,
                created_at: new Date(),
            });
        }

        



        // Check For OverAll Verification And Update Profile


        return true;
    }
    catch (exception) {
        logger.error("Ekyc Kafka Event Error, Document Verification Data", exception);
        return false;
    }

};

export const DeleteDocumentData = async (data) => {
    try {

        const user_id = data.user_id;
        const file_id = data.file_id;

        const findFile = await EkycDocs.findOne({
            where: {
                user_id: user_id,
                file_id: file_id,
            }
        });

        if (findFile) {
            findFile.status = 0;
            findFile.trash = "YES";
            await findFile.save();
        }


        return true;
    }
    catch (exception) {
        logger.error("Delete Document Data Error", exception);
        return false;
    }
};
