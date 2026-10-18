"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut, UserRound, MapPin, Users, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/navbar";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

type User = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  createdAt: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [avatarSrc, setAvatarSrc] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const loadUser = useCallback(async (signal: AbortSignal) => {
    const response = await fetch(`${API}/api/auth/me`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal,
      headers: { Accept: "application/json" },
    });

    if (response.status === 401) {
      router.replace("/login");
      return;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error ?? "Could not load your profile. Please try again.");
    }
    setUser(data.user as User);
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      try {
        setError("");
        await loadUser(controller.signal);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message || "Something went wrong while loading your profile.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void run();
    return () => controller.abort();
  }, [loadUser]);

  // Load the private avatar with credentials so cross-origin API setups work too.
  useEffect(() => {
    if (!user?.avatarUrl) {
      setAvatarSrc("");
      return;
    }

    const controller = new AbortController();
    let objectUrl = "";

    async function loadAvatar() {
      try {
        const response = await fetch(`${API}${user!.avatarUrl}`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;

        const blob = await response.blob();
        if (!controller.signal.aborted && blob.size > 0) {
          objectUrl = URL.createObjectURL(blob);
          setAvatarSrc(objectUrl);
        }
      } catch {
        // Keep the icon fallback if the avatar is unavailable.
      }
    }

    void loadAvatar();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user]);

  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    setError("");

    try {
      const response = await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error("Sign-out could not be confirmed. Please try again.");
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out. Check your connection and try again.");
      setSigningOut(false);
    }
  }

  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">
            Cholo Ghure Asi
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Your profile</h1>
          <p className="mt-2 text-muted-foreground">Your account, your people, your Puja plans.</p>
        </div>

        {loading && (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-6 text-muted-foreground" role="status" aria-live="polite">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            Loading your profile...
          </div>
        )}

        {error && (
          <div role="alert" className="mb-6 flex flex-col gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            {!user && !loading && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="shrink-0 rounded-lg border border-current px-3 py-2 font-semibold hover:bg-black/5 dark:hover:bg-white/5"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {!loading && user && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="h-28 bg-gradient-to-r from-rose-950 via-rose-800 to-amber-700 sm:h-36" />

              <div className="px-5 pb-6 sm:px-8 sm:pb-8">
                <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100 sm:h-28 sm:w-28">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={`${user.fullName}'s profile`} className="h-full w-full object-cover" />
                    ) : (
                      <UserRound className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden="true" />
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={signingOut}
                    onClick={logout}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {signingOut ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    {signingOut ? "Signing out..." : "Sign out"}
                  </button>
                </div>

                <div className="mt-5">
                  <h2 className="break-words text-2xl font-black sm:text-3xl">{user.fullName}</h2>
                  <p className="mt-1 break-all text-sm text-muted-foreground">{user.email}</p>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-muted/70 p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ShieldCheck className="h-4 w-4" />
                      Account email
                    </div>
                    <p className="mt-2 break-all font-semibold">{user.email}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/70 p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      Phone number
                    </div>
                    <p className="mt-2 font-semibold">{user.phone}</p>
                  </div>
                </div>

                {joinedDate && <p className="mt-5 text-xs text-muted-foreground">Puja gang member since {joinedDate}</p>}
              </div>
            </section>

            <aside className="flex flex-col gap-4">
              <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                  <Users className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-xl font-bold">Your Puja gang</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Get ready to plan pandal-hopping routes, connect with friends, and organise your group for Puja.
                </p>
                <Link
                  href="/friends?welcome=1"
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-rose-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                >
                  Continue to friends
                </Link>
              </section>

              <section className="rounded-3xl border border-amber-300/60 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/20 sm:p-6">
                <p className="font-bold text-amber-950 dark:text-amber-100">A quick privacy note</p>
                <p className="mt-2 text-sm leading-6 text-amber-900/80 dark:text-amber-100/70">
                  Your live location should only be shared when you choose to share it. Location-sharing controls will be connected in a later phase.
                </p>
              </section>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
