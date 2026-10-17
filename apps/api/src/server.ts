import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import pandalRoutes from "./routes/pandals";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

app.use(helmet());
app.use(cors({ origin: WEB_URL }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "cholo-ghure-asi-api",
    database: mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected",
  });
});

app.use("/api/pandals", pandalRoutes);

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(error);

    res.status(500).json({
      error: "An unexpected server error occurred",
    });
  }
);

async function start() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
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