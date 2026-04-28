import fs from "fs";
import path from "path";

const LOCAL_UPLOAD_PATH = path.join(process.cwd(), "uploads");

export const localStorage = {
    save: async (file) => {
        if (!fs.existsSync(LOCAL_UPLOAD_PATH)) {
            fs.mkdirSync(LOCAL_UPLOAD_PATH, { recursive: true });
        }

        const fullPath = path.join(LOCAL_UPLOAD_PATH, file.originalname);

        fs.writeFileSync(fullPath, file.buffer);

        return {
            url: `/uploads/${file.originalname}`,
            file_original_name: file.originalname,
            file_name: file.originalname,
            path: fullPath,
            storage: "local"
        };
    },

    delete: async (filePath) => {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
};
