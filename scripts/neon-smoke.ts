import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "[Neon smoke] Missing DIRECT_DATABASE_URL or DATABASE_URL. Configure a Neon connection before running this check.",
  );
  process.exitCode = 2;
} else {
  const sql = neon(databaseUrl);
  const result = await sql`select 1 as ok, current_database() as database_name`;
  const row = result[0];

  if (!row || row.ok !== 1) {
    throw new Error("[Neon smoke] The database did not return the expected result.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        driver: "@neondatabase/serverless",
        database: row.database_name,
      },
      null,
      2,
    ),
  );
}
