"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { Navbar } from "@/components/navbar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const startedAt = Date.now();

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not sign in.");
      }

      await new Promise<void>((resolve) =>
        setTimeout(resolve, Math.max(0, 3000 - (Date.now() - startedAt)))
      );

      router.push("/profile");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-600";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="mx-auto grid min-h-[calc(100vh-72px)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-8 lg:grid-cols-2">
        <aside className="hidden rounded-[2rem] bg-[#35101b] p-10 text-white lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
            Your Puja journey awaits
          </p>
          <h1 className="mt-6 text-5xl font-black leading-tight">
            Your gang.
            <br />
            Your routes.
            <br />
            Your Kolkata.
          </h1>
          <p className="mt-6 max-w-sm leading-7 text-rose-100/75">
            Sign in to continue planning pandal hops, exploring metro
            connections and meeting your friends.
          </p>
        </aside>

        <section className="mx-auto w-full max-w-md">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
            <LockKeyhole className="h-7 w-7" />
          </span>

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
            Welcome back
          </p>

          <h2 className="mt-2 text-3xl font-black sm:text-4xl">
            Sign in to your account
          </h2>

          <p className="mt-3 text-sm text-muted-foreground">
            Pick up your Puja plans right where you left them.
          </p>

          {error && (
            <p role="alert" className="mt-5 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </p>
          )}

          <form onSubmit={handleLogin} className="mt-7 space-y-5">
            <div>
              <label htmlFor="email" className="text-sm font-semibold">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-semibold">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  className={`${inputClass} pr-12`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                />

                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  aria-label={visible ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {visible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-800 px-4 py-3.5 font-bold text-white transition hover:bg-rose-900 disabled:opacity-50"
            >
              {loading && <LoaderCircle className="h-5 w-5 animate-spin" />}
              {loading ? "Signing you in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Tor account nei?{" "}
            <Link href="/register" className="font-bold text-rose-800 hover:underline dark:text-rose-300">
              Sign up
            </Link>
          </p>
        </section>
      </section>
    </main>
  );
}