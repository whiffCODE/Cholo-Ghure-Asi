"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";
import { Navbar } from "@/components/navbar";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const MAX_AVATAR_BYTES = 100 * 1024;
const MAX_INPUT_BYTES = 5 * 1024 * 1024;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function readError(response: Response): Promise<string> {
  const data = await response.json().catch(() => ({}));
  return typeof data?.error === "string" ? data.error : "Something went wrong. Please try again.";
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({} as Record<string, unknown>));
}

async function compressPhoto(file: File): Promise<File> {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Please select a JPEG, PNG or WebP image.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Please select an image smaller than 5 MB.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be opened. Please choose another image.");
  }

  try {
    if (!bitmap.width || !bitmap.height || bitmap.width > 6000 || bitmap.height > 6000) {
      throw new Error("Image dimensions must be no larger than 6000 × 6000 pixels.");
    }

    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process this image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42, 0.32, 0.22]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
      if (blob && blob.size <= MAX_AVATAR_BYTES) {
        return new File([blob], "profile.webp", { type: "image/webp", lastModified: Date.now() });
      }
    }
    throw new Error("This image could not be compressed below 100 KB. Please choose another.");
  } finally {
    bitmap.close();
  }
}

const features = [
  { Icon: Mail, title: "Verified email", detail: "Keep your account protected." },
  { Icon: ShieldCheck, title: "Secure sign-in", detail: "Your password stays private." },
  { Icon: LockKeyhole, title: "Your choice", detail: "Share your live location only when you want." },
];

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const cleanEmail = email.trim().toLowerCase();
  const emailIsVerified = Boolean(cleanEmail && verifiedEmail === cleanEmail);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!avatar) {
      setAvatarPreview("");
      return;
    }
    const url = URL.createObjectURL(avatar);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  async function requestOtp() {
    setError("");
    setSuccess("");
    const targetEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setError("Enter a valid email address first.");
      return;
    }
    if (sendingOtp || cooldown > 0 || (verifiedEmail && verifiedEmail === targetEmail)) return;

    setSendingOtp(true);
    try {
      const response = await fetch(`${API}/api/auth/register-otp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        if (typeof data.retryAfterSeconds === "number") setCooldown(data.retryAfterSeconds);
        throw new Error(typeof data.error === "string" ? data.error : "Could not send verification code.");
      }
      setOtpEmail(targetEmail);
      setOtp("");
      setVerifiedEmail("");
      setOtpOpen(true);
      setCooldown(typeof data.retryAfterSeconds === "number" ? data.retryAfterSeconds : 60);
      setSuccess("Verification code sent. Check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification code.");
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifyOtp() {
    if (otpEmail !== cleanEmail) {
      setError("The email address changed. Request a new verification code.");
      setOtpOpen(false);
      setVerifiedEmail("");
      return;
    }
    setError("");
    setVerifyingOtp(true);
    try {
      const response = await fetch(`${API}/api/auth/verify-otp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, otp }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Verification failed.");
      }
      if (data.verified !== true) throw new Error("The server did not confirm email verification.");
      setVerifiedEmail(otpEmail);
      setOtpOpen(false);
      setSuccess("Email verified successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setProcessingPhoto(true);
    try {
      setAvatar(await compressPhoto(file));
    } catch (err) {
      setAvatar(null);
      setError(err instanceof Error ? err.message : "Could not process image.");
    } finally {
      setProcessingPhoto(false);
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!emailIsVerified) {
      setError("Verify your current email address before registering.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (password.length < 12) {
      setError("Use a password with at least 12 characters.");
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError("Password must not exceed 72 UTF-8 bytes.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (processingPhoto) {
      setError("Please wait until your profile photo has finished processing.");
      return;
    }

    setSubmitting(true);
    const startedAt = Date.now();
    try {
      const formData = new FormData();
      formData.set("fullName", fullName.trim());
      formData.set("email", cleanEmail);
      formData.set("phone", `+91${phone}`);
      formData.set("password", password);
      formData.set("confirmPassword", confirmPassword);
      if (avatar) formData.set("avatar", avatar);

      const response = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) throw new Error(await readError(response));

      await wait(Math.max(0, 3000 - (Date.now() - startedAt)));
      router.push("/friends?welcome=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-rose-600";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <section className="mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl items-center gap-10 px-4 py-8 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:py-12">
        <aside className="hidden rounded-[2rem] bg-[#35101b] p-10 text-white lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Welcome to the Puja gang</p>
          <h1 className="mt-6 text-5xl font-black leading-tight">Make memories.<br />Not route mistakes.</h1>
          <p className="mt-5 leading-7 text-rose-100/75">Create your account to plan pandal hops, find metro stations and stay connected with your friends.</p>
          <div className="mt-10 space-y-5">
            {features.map(({ Icon, title, detail }) => (
              <div key={title} className="flex gap-3">
                <Icon className="mt-1 h-5 w-5 shrink-0 text-amber-300" />
                <div><p className="font-bold">{title}</p><p className="mt-1 text-sm text-rose-100/65">{detail}</p></div>
              </div>
            ))}
          </div>
        </aside>

        <section className="mx-auto w-full max-w-xl">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />Back to home
          </Link>
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">Join the celebration</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">Create your account</h2>
            <p className="mt-2 text-sm text-muted-foreground">One account. Your pandals, your friends, your routes.</p>
          </div>

          {error && <div role="alert" aria-live="polite" className="mt-5 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
          {success && <div role="status" aria-live="polite" className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{success}</div>}

          <form onSubmit={register} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-semibold" htmlFor="fullName">Full name</label>
              <input id="fullName" className={inputClass} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} minLength={2} maxLength={80} required placeholder="Enter your full name" />
            </div>

            <div>
              <label className="text-sm font-semibold" htmlFor="phone">Mobile number</label>
              <div className="mt-1.5 flex overflow-hidden rounded-xl border border-border focus-within:ring-2 focus-within:ring-rose-600">
                <span className="flex items-center border-r border-border bg-muted px-3 text-sm font-semibold">+91</span>
                <input id="phone" className="min-w-0 flex-1 bg-background px-3.5 py-3 text-sm outline-none" type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} pattern="[6-9][0-9]{9}" maxLength={10} required placeholder="10-digit mobile number" />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold" htmlFor="email">Email address</label>
              <div className="mt-1.5 flex gap-2">
                <input id="email" type="email" autoComplete="email" maxLength={254} className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-600" value={email} onChange={(e) => {
                  const nextEmail = e.target.value;
                  setEmail(nextEmail);
                  if (verifiedEmail !== nextEmail.trim().toLowerCase()) setVerifiedEmail("");
                  if (otpOpen && otpEmail !== nextEmail.trim().toLowerCase()) { setOtpOpen(false); setOtp(""); }
                }} required placeholder="you@example.com" />
                <button type="button" disabled={sendingOtp || cooldown > 0 || !email.trim() || emailIsVerified} onClick={() => void requestOtp()} className="shrink-0 rounded-xl border border-rose-300 px-3 text-sm font-bold text-rose-800 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950">
                  {sendingOtp ? <LoaderCircle className="h-4 w-4 animate-spin" /> : emailIsVerified ? <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Verified</span> : cooldown > 0 ? `Wait ${cooldown}s` : "Verify OTP"}
                </button>
              </div>
              {emailIsVerified && <p className="mt-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Email verified successfully.</p>}
            </div>

            <div>
              <label className="text-sm font-semibold" htmlFor="avatar">Profile photo <span className="font-normal text-muted-foreground">(optional)</span></label>
              <label htmlFor="avatar" className="mt-1.5 flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-border p-3 transition hover:border-rose-400">
                {avatarPreview ? <img src={avatarPreview} alt="Profile photo preview" className="h-14 w-14 rounded-full object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><ImagePlus className="h-6 w-6 text-muted-foreground" /></span>}
                <span className="min-w-0 flex-1"><span className="block break-all text-sm font-semibold">{processingPhoto ? "Processing photo..." : avatar ? avatar.name : "Choose a profile photo"}</span><span className="mt-1 block text-xs text-muted-foreground">JPEG, PNG or WebP · compressed to at most 100 KB</span></span>
                {processingPhoto && <LoaderCircle className="h-4 w-4 animate-spin" />}
              </label>
              <input id="avatar" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void handlePhoto(e)} />
              {avatar && <button type="button" className="mt-2 text-xs font-semibold text-rose-700 hover:underline dark:text-rose-300" onClick={() => setAvatar(null)}>Remove photo</button>}
            </div>

            <div>
              <label className="text-sm font-semibold" htmlFor="password">Password</label>
              <div className="relative mt-1.5">
                <input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" className={`${inputClass} pr-12`} value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required placeholder="At least 12 characters" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Use a long, unique password you don&apos;t use elsewhere. Maximum 72 UTF-8 bytes.</p>
            </div>

            <div>
              <label className="text-sm font-semibold" htmlFor="confirmPassword">Confirm password</label>
              <div className="relative mt-1.5">
                <input id="confirmPassword" type={showConfirm ? "text" : "password"} autoComplete="new-password" className={`${inputClass} pr-12`} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Enter your password again" />
                <button type="button" onClick={() => setShowConfirm((value) => !value)} aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
              {confirmPassword && <p className={`mt-1.5 text-xs ${password === confirmPassword ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>{password === confirmPassword ? "Passwords match" : "Passwords do not match"}</p>}
            </div>

            <button type="submit" disabled={submitting || processingPhoto || !emailIsVerified || !fullName.trim() || !phone || !password || !confirmPassword} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-800 px-4 py-3.5 font-bold text-white transition hover:bg-rose-900 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? <><LoaderCircle className="h-5 w-5 animate-spin" />Creating your account...</> : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">Tor account ache? <Link href="/login" className="font-bold text-rose-800 hover:underline dark:text-rose-300">Sign in</Link></p>
        </section>
      </section>

      {otpOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !verifyingOtp) setOtpOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="otp-title" className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"><Mail className="h-6 w-6" /></span>
              <button type="button" aria-label="Close verification dialog" disabled={verifyingOtp} onClick={() => setOtpOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-accent disabled:opacity-50"><X className="h-5 w-5" /></button>
            </div>
            <h2 id="otp-title" className="mt-5 text-2xl font-black">Verify your email</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Enter the six-digit code sent to <strong className="break-all text-foreground">{otpEmail}</strong>. The code expires in 10 minutes.</p>
            <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void verifyOtp(); }}>
              <label htmlFor="otp" className="text-sm font-semibold">Verification code</label>
              <input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required className="w-full rounded-xl border border-border bg-background px-4 py-4 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-rose-600" />
              <button type="submit" disabled={verifyingOtp || otp.length !== 6} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-800 px-4 py-3 font-bold text-white disabled:opacity-50">{verifyingOtp && <LoaderCircle className="h-4 w-4 animate-spin" />}{verifyingOtp ? "Verifying..." : "Verify email"}</button>
              <button type="button" disabled={sendingOtp || cooldown > 0 || verifyingOtp} onClick={() => void requestOtp()} className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:text-muted-foreground dark:text-rose-300 dark:hover:bg-rose-950">{sendingOtp ? "Sending..." : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend verification code"}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
