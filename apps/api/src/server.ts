import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pandalRoutes from "./routes/pandals";
import authRoutes from "./routes/auth";

import friendsRoutes from "./routes/friends";
import groupsRoutes from "./routes/groups";
import socialRoutes from "./routes/social";


const app = express();

const PORT = Number(process.env.PORT ?? 4000);
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

app.use(helmet());

app.use(
  cors({
    origin: WEB_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "cholo-ghure-asi-api",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
  });
});

app.use("/api/pandals", pandalRoutes);
app.use("/api/auth", authRoutes);


app.use("/api/friends", friendsRoutes);
app.use("/api/groups", groupsRoutes);

app.use("/api/social", socialRoutes);


app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("API error:", error instanceof Error ? error.message : error);

    const message =
      error instanceof Error ? error.message : "Unexpected server error";

    if (message.includes("File too large")) {
      return res.status(413).json({ error: "Image must be 5 MB or smaller." });
    }

    if (
      message.includes("Upload a JPEG") ||
      message.includes("Invalid image") ||
      message.includes("Image dimensions") ||
      message.includes("Image could not be compressed")
    ) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({
      error: "An unexpected server error occurred.",
    });
  }
);

async function start() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required.");
  }

  if (!process.env.JWT_SECRET || !process.env.OTP_SECRET) {
    throw new Error("JWT_SECRET and OTP_SECRET are required.");
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error("Gmail SMTP credentials are required.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  app.listen(PORT, () => {
    console.log(`Cholo Ghure Asi API listening on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error("API startup failed:", error);
  process.exit(1);
});