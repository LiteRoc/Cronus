// app.js (ROOT)
import express from "express";
import cors from "cors";
import contractRoutes from "./src/routes/contractRoutes.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: ["http://localhost:5173"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    })
  );

  app.use(express.json());

  app.use("/contracts", contractRoutes);

  return app;
}