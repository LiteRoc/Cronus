// server.js (ROOT)
import dotenv from "dotenv";
import { createApp } from "./app.js";
import connectDB from "./config/db.js";
import { startContractLifecycleCron } from "./src/jobs/contractLifecycleCron.js";

dotenv.config();

async function start() {
  await connectDB();

  startContractLifecycleCron();

  const app = createApp();
  const PORT = process.env.PORT || 5001;

  app.listen(PORT, () => {
    console.log(`🚀 Contract Service running on port ${PORT}`);
  });
}

start();