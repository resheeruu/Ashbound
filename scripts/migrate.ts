import { databaseManager } from "../src/storage/database";
async function main() {
  await databaseManager.migrate();
  console.log("Database migrations applied.");
  databaseManager.close();
}
main().catch((error) => { console.error("Migration failed:", error); process.exit(1); });
