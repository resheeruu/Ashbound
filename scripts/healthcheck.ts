import { databaseManager } from "../src/storage/database";
const db = databaseManager.getDb();
const result = db.prepare("SELECT 1 as ok").get() as { ok: number };
if (result?.ok === 1) { console.log("✓ Database connected"); } else { console.log("✗ Database connection failed"); process.exit(1); }
db.close();
console.log("Health check complete.");
