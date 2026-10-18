import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import crypto from "node:crypto";
import { z } from "zod";

import User from "../models/User";
import EmailVerification from "../models/EmailVerification";

const router = Router();

const isProduction = process.env.NODE_ENV === "production";
const cookieName = "cga_session";
const otpLifetimeMs = 10 * 60 * 1000;
const verifiedLifetimeMs = 30 * 60 * 1000;
const resendDelayMs = 60 * 1000;
const avatarLimit = 100 * 1024;
const maxAvatarUploadBytes = 5 * 1024 * 1024;
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function requireSecret(name: "JWT_SECRET" | "OTP_SECRET"): string {
  const value = process.env[name];
  if (!value || Buffer.byteLength(value, "utf8") < 32) {
    throw new Error(`${name} must be configured with at least 32 bytes.`);
  }
  return value;
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many OTP requests. Try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again later." },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxAvatarUploadBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new Error("Upload a JPEG, PNG or WebP image."));
      return;
    }
    callback(null, true);
  },
});

const emailSchema = z.string().trim().email().max(254);

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: emailSchema,
  phone: z.string().regex(/^\+91[6-9]\d{9}$/),
  password: z.string().min(12).max(256),
  confirmPassword: z.string().max(256),
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(256),
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashOtp(email: string, otp: string): string {
  return crypto
    .createHmac("sha256", requireSecret("OTP_SECRET"))
    .update(`${normalizeEmail(email)}:${otp}`)
    .digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: sessionLifetimeMs,
  });
}

function createSession(userId: string): string {
  return jwt.sign(
    { sub: userId },
    requireSecret("JWT_SECRET"),
    { expiresIn: "7d", issuer: "cholo-ghure-asi" },
  );
}

function getUserId(req: Request): string | null {
  const token = req.cookies?.[cookieName];
  if (typeof token !== "string") return null;

  try {
    const payload = jwt.verify(token, requireSecret("JWT_SECRET"), {
      issuer: "cholo-ghure-asi",
    });
    if (typeof payload === "string" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

async function compressAvatar(file?: Express.Multer.File) {
  if (!file) return {};

  try {
    const image = sharp(file.buffer, { limitInputPixels: 20_000_000 });
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Invalid image. Please choose a valid photo.");
    }
    if (metadata.width > 6000 || metadata.height > 6000) {
      throw new Error("Image dimensions are too large.");
    }

    for (const width of [512, 384, 256, 192, 128]) {
      const output = await sharp(file.buffer, { limitInputPixels: 20_000_000 })
        .rotate()
        .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 75, effort: 4 })
        .toBuffer();

      if (output.length <= avatarLimit) {
        return { avatar: output, avatarContentType: "image/webp" };
      }
    }
    throw new Error("Image could not be compressed below 100 KB. Try another photo.");
  } catch (error) {
    if (error instanceof Error && error.message.includes("100 KB")) throw error;
    if (error instanceof Error && (error.message.includes("dimensions") || error.message.includes("valid photo"))) throw error;
    throw new Error("That image could not be processed. Please upload a valid JPEG, PNG or WebP photo.");
  }
}

function publicUser(user: {
  _id: unknown;
  fullName: string;
  email: string;
  phone: string;
  createdAt: Date;
}) {
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    avatarUrl: "/api/auth/avatar",
    createdAt: user.createdAt,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11000;
}

// Request an email OTP. The OTP itself is never stored in the database.
router.post("/register-otp", otpLimiter, async (req, res, next) => {
  try {
    const parsed = z.object({ email: emailSchema }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const email = normalizeEmail(parsed.data.email);
    if (await User.exists({ email })) {
      return res.status(409).json({ error: "An account with this email already exists. Please sign in." });
    }

    const existing = await EmailVerification.findOne({ email });
    const now = new Date();
    if (existing && existing.resendAfter > now) {
      const retryAfterSeconds = Math.ceil((existing.resendAfter.getTime() - now.getTime()) / 1000);
      return res.status(429).json({ error: "Please wait before requesting another OTP.", retryAfterSeconds });
    }

    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = new Date(Date.now() + otpLifetimeMs);
    const resendAfter = new Date(Date.now() + resendDelayMs);

    await EmailVerification.findOneAndUpdate(
      { email },
      { $set: { otpHash: hashOtp(email, otp), expiresAt, resendAfter, attempts: 0, verifiedAt: null } },
      { upsert: true, new: true, runValidators: true },
    );

    try {
      const webUrl = (process.env.WEB_URL || "http://localhost:3000").replace(/\/$/, "");
      await transporter.sendMail({
        from: `"Cholo Ghure Asi" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: "Verify your email | Cholo Ghure Asi",
        text: `Your verification code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#32141e">
            <div style="background:#4a1020;color:#fff7eb;padding:24px;border-radius:16px">
              <img src="${webUrl}/assets/cga_logo.png" alt="Cholo Ghure Asi" style="max-width:180px;max-height:64px;object-fit:contain" />
              <p style="color:#f6d8a3">Your Kolkata Puja companion</p>
            </div>
            <h2 style="margin-top:28px">Verify your email</h2>
            <p>Use the code below to continue registration.</p>
            <p style="font-size:32px;letter-spacing:8px;font-weight:bold">${otp}</p>
            <p>This code expires in 10 minutes. Never share it with anyone.</p>
          </div>`,
      });
    } catch (error) {
      await EmailVerification.deleteOne({ email });
      throw error;
    }

    return res.json({ message: "Verification code sent.", expiresInSeconds: 600, retryAfterSeconds: 60 });
  } catch (error) {
    next(error);
  }
});

// Verify an email OTP. Successful verification remains valid for 30 minutes.
router.post("/verify-otp", otpLimiter, async (req, res, next) => {
  try {
    const parsed = z.object({ email: emailSchema, otp: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Enter a valid six-digit code." });
    }

    const email = normalizeEmail(parsed.data.email);
    const record = await EmailVerification.findOne({ email });
    if (!record || record.expiresAt <= new Date()) {
      return res.status(400).json({ error: "The code has expired. Request a new one." });
    }
    if (record.verifiedAt) {
      if (Date.now() - record.verifiedAt.getTime() <= verifiedLifetimeMs) {
        return res.json({ verified: true, message: "Email already verified." });
      }
      await EmailVerification.deleteOne({ email });
      return res.status(400).json({ error: "Verification expired. Request a new code." });
    }
    if (record.attempts >= 5) {
      await EmailVerification.deleteOne({ email });
      return res.status(429).json({ error: "Too many incorrect codes. Request a new OTP." });
    }

    if (!safeEqualHex(record.otpHash, hashOtp(email, parsed.data.otp))) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ error: "Incorrect verification code.", attemptsRemaining: Math.max(0, 5 - record.attempts) });
    }

    record.verifiedAt = new Date();
    record.expiresAt = new Date(Date.now() + verifiedLifetimeMs);
    record.otpHash = "verified";
    await record.save();
    return res.json({ verified: true, message: "Email verified successfully." });
  } catch (error) {
    next(error);
  }
});

// Create the account. Verification and password byte length are checked server-side.
router.post("/register", authLimiter, upload.single("avatar"), async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Please correct the registration details.", details: parsed.error.flatten() });
    }

    const data = parsed.data;
    if (Buffer.byteLength(data.password, "utf8") > 72) {
      return res.status(400).json({ error: "Password must be no longer than 72 bytes when encoded." });
    }

    const email = normalizeEmail(data.email);
    const verification = await EmailVerification.findOne({ email });
    if (!verification || !verification.verifiedAt || Date.now() - verification.verifiedAt.getTime() > verifiedLifetimeMs) {
      return res.status(403).json({ error: "Verify your email before creating your account." });
    }

    if (await User.exists({ email })) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const avatar = await compressAvatar(req.file);
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await User.create({ fullName: data.fullName, email, phone: data.phone, passwordHash, ...avatar });

    await EmailVerification.deleteOne({ email });
    setSessionCookie(res, createSession(String(user._id)));
    return res.status(201).json({ message: "Account created successfully.", user: publicUser(user) });
  } catch (error) {
    if (error instanceof Error && /100 KB|dimensions|valid photo|could not be processed/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    if (isDuplicateKeyError(error)) {
      return res.status(409).json({ error: "An account with this email or phone already exists." });
    }
    next(error);
  }
});

// Login.
router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and password." });

    const { email: rawEmail, password } = parsed.data;
    if (Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ error: "Password is invalid." });
    }
    const email = normalizeEmail(rawEmail);
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    setSessionCookie(res, createSession(String(user._id)));
    return res.json({ message: "Signed in successfully.", user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

// Current signed-in user.
router.get("/me", async (req, res, next) => {
  try {
    const id = getUserId(req);
    if (!id) return res.status(401).json({ error: "Please sign in." });

    const user = await User.findById(id);
    if (!user) return res.status(401).json({ error: "Account not found." });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

// Authenticated avatar retrieval.
router.get("/avatar", async (req, res, next) => {
  try {
    const id = getUserId(req);
    if (!id) return res.status(401).json({ error: "Please sign in." });

    const user = await User.findById(id).select("+avatar +avatarContentType");
    if (!user?.avatar || !user.avatarContentType) {
      return res.status(404).json({ error: "No profile photo uploaded." });
    }

    res.setHeader("Content-Type", user.avatarContentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(user.avatar);
  } catch (error) {
    next(error);
  }
});

// Logout.
router.post("/logout", (_req, res) => {
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
  return res.json({ message: "Signed out successfully." });
});

export default router;
