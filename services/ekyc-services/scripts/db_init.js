import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { DB_HOST, DB_PASS, DB_NAME, DB_USER, DB_PORT } = process.env;

(async () => {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  console.log(`Database ensured: ${DB_NAME}`);
  process.exit(0);
})();
