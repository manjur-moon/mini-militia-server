import {
  connectToDatabase,
  disconnectFromDatabase,
} from "../config/database.js";
import { AISummary } from "../models/ai-summary.model.js";

async function main() {
  await connectToDatabase();
  const result = await AISummary.syncIndexes();
  console.log("AI summary indexes synchronized.", result);
  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error("AI summary index migration failed:", error);
  await disconnectFromDatabase().catch(() => undefined);
  process.exitCode = 1;
});
