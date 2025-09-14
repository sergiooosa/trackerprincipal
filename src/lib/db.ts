import { Pool } from "pg";

// Fallbacks para despliegue si no hay variables de entorno en Vercel
const host = process.env.POSTGRES_HOST || "mainbd.automatizacionesia.com";
const port = parseInt(process.env.POSTGRES_PORT || "5432");
const database = process.env.POSTGRES_DATABASE || "postgres";
const user = process.env.POSTGRES_USER || "postgres";
const password = process.env.POSTGRES_PASSWORD || "R81N0ds7Cr8b";

const pool = new Pool({
  host,
  port,
  database,
  user,
  password,
  ssl: { rejectUnauthorized: false },
});

export default pool;
