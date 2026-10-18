"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Users } from "lucide-react";
import { Navbar } from "@/components/navbar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function FriendsWelcome() {
  const router = useRouter();
  const params = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function checkSession() {
      try {
        const response = await fetch(`${API}/api/auth/me`, {
          credentials: "include",
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) throw new Error("Could not check session.");

        const data = await response.json();
        setName(data.user.fullName);
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          router.replace("/login");
        }
      } finally {
        setChecking(false);
      }
    }

    void checkSession();
    return () => controller.abort();
  }, [router]);

  if (checking) {
    return <p className="mt-8 text-muted-foreground">Checking your account...</p>;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-8">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
        <Users className="h-8 w-8" />
      </span>

      <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
        {params.get("welcome") === "1" ? "Welcome aboard" : "Your Puja gang"}
      </p>

      <h1 className="mt-3 text-3xl font-black sm:text-5xl">
        {name ? `Ready, ${name.split(" ")[0]}?` : "Ready for Pujo?"}
      </h1>

      <p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">
        Your account is ready. Next, you&apos;ll be able to create a group,
        invite friends with a code, join an existing group and plan a
        pandal-hopping route together.
      </p>

      <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-6 text-left">
        <h2 className="font-bold">Coming in Phase 4</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• Create a Puja group and generate a friend code.</li>
          <li>• Join a group using an invitation code.</li>
          <li>• Manage friends and their contact details.</li>
          <li>• Choose whether to share your live location.</li>
        </ul>
      </div>

      <Link
        href="/profile"
        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-rose-800 px-5 py-3 font-bold text-white hover:bg-rose-900"
      >
        View your profile <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

export default function FriendsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Suspense fallback={<div className="p-8">Loading...</div>}>
        <FriendsWelcome />
      </Suspense>
    </main>
  );
}