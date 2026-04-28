import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import FileV1Routes from "./src/routes/v1/file.routes.js";
import sequelize from "./src/config/database.js";
import {logger} from "rhoam-shared-utils";
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/v1/file",FileV1Routes);

sequelize.sync().then(() => console.log("Database Connected")).catch((error) =>{
    logger.error("File Service DataBase Error",error);
    console.error("DataBase Error In File");
});

const PORT = process.env.PORT || 4005;

app.listen(PORT,()=>{
    console.log(`File Service Running On Port: ${PORT}`);
}); 
