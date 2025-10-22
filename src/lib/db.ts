import { Pool } from "pg";

// Variables de entorno requeridas para la conexión a la base de datos
const host = process.env.POSTGRES_HOST;
const port = parseInt(process.env.POSTGRES_PORT || "5432");
const database = process.env.POSTGRES_DATABASE;
const user = process.env.POSTGRES_USER;
const password = process.env.POSTGRES_PASSWORD;

// Validar que todas las variables de entorno estén configuradas
if (!host || !database || !user || !password) {
  throw new Error(
    "Faltan variables de entorno de base de datos. Asegúrate de configurar: POSTGRES_HOST, POSTGRES_DATABASE, POSTGRES_USER, POSTGRES_PASSWORD"
  );
}

const pool = new Pool({
  host,
  port,
  database,
  user,
  password,
  ssl: { rejectUnauthorized: false },
});

export default pool;
