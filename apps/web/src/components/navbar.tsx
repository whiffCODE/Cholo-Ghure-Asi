
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  MapPinned,
  Users,
  TrainFront,
  UserRound,
  Compass,
  X,
  ChevronDown,
  LogOut,
  Settings,
  LoaderCircle,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const API =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const links = [
  { label: "Home", href: "/", icon: Compass },
  { label: "Map", href: "/map", icon: MapPinned },
  { label: "North Pandals", href: "/map?region=North" },
  { label: "Central Pandals", href: "/map?region=Central" },
  { label: "South Pandals", href: "/map?region=South" },
  { label: "Friends", href: "/friends", icon: Users },
  { label: "Nearest Metro", href: "/metro", icon: TrainFront },
];

type CurrentUser = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
};

export function Navbar() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  const loadUser = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/auth/me`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = await response.json();
      setUser(data.user ?? null);
      setAvatarFailed(false);
    } catch {
      // Keep the navbar usable if the API is temporarily unavailable.
      setUser(null);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  // Close the avatar menu when clicking outside it or pressing Escape.
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    setProfileOpen(false);
    setOpen(false);

    try {
      const response = await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Sign out failed.");
      }

      setUser(null);
      router.push("/login");
      router.refresh();
    } catch {
      // Do not pretend the server session was cleared if the request failed.
      await loadUser();
    } finally {
      setSigningOut(false);
    }
  }

  const avatarUrl =
    user?.avatarUrl ? `${API}${user.avatarUrl}` : null;

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
      >
        {/* Brand */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
          onClick={() => setOpen(false)}
          aria-label="Cholo Ghure Asi home"
        >
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden sm:h-16 sm:w-16">
            <img
              src="/assets/cga_logo.png"
              alt="Cholo Ghure Asi"
              className="h-full w-full object-contain"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </span>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-1 xl:flex">
          {links.map((link) => {
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                {Icon && <Icon className="h-4 w-4" />}
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right-side controls */}
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />

          {checkingAuth ? (
            <div
              className="flex h-10 w-10 items-center justify-center"
              aria-label="Checking sign-in status"
            >
              <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : user ? (
            /* Signed-in avatar and its tucked dropdown */
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((value) => !value)}
                className="flex items-center gap-2 rounded-full border border-border bg-background p-1 pr-2 transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                aria-label="Open profile menu"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100">
                  {avatarUrl && !avatarFailed ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={() => setAvatarFailed(true)}
                    />
                  ) : (
                    <UserRound className="h-5 w-5" />
                  )}
                </span>

                <span className="hidden max-w-28 truncate text-sm font-semibold sm:block">
                  {user.fullName.split(" ")[0]}
                </span>

                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  aria-label="Profile menu"
                  className="absolute right-0 top-[calc(100%+10px)] z-50 w-72 overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
                >
                  {/* Account identity */}
                  <div className="border-b border-border bg-accent/40 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100">
                        {avatarUrl && !avatarFailed ? (
                          <img
                            src={avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={() => setAvatarFailed(true)}
                          />
                        ) : (
                          <UserRound className="h-6 w-6" />
                        )}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate font-bold">
                          {user.fullName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </p>
                        <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          Signed in
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu links */}
                  <div className="p-2">
                    <Link
                      href="/profile"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition hover:bg-accent"
                    >
                      <UserRound className="h-4 w-4 text-rose-700 dark:text-rose-300" />
                      My profile
                    </Link>

                    <Link
                      href="/friends"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition hover:bg-accent"
                    >
                      <Users className="h-4 w-4 text-rose-700 dark:text-rose-300" />
                      Friends & Puja groups
                    </Link>

                    <Link
                      href="/profile"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition hover:bg-accent"
                    >
                      <Settings className="h-4 w-4 text-rose-700 dark:text-rose-300" />
                      Account settings
                    </Link>
                  </div>

                  <div className="border-t border-border p-2">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={signingOut}
                      onClick={() => void handleSignOut()}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      {signingOut ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                      {signingOut ? "Signing out..." : "Sign out"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
  href="/login"
  className="hidden items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 sm:inline-flex"
>
  <UserRound className="mr-2 h-4 w-4" />
  Sign in
</Link>
          )}

          {/* Mobile navigation toggle */}
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl xl:hidden"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            onClick={() => {
              setOpen((value) => !value);
              setProfileOpen(false);
            }}
          >
            {open ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </nav>

      {/* Mobile links */}
      {open && (
        <div className="border-t border-border bg-background px-4 py-4 shadow-lg xl:hidden">
          <div className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
            {links.map((link) => {
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition hover:bg-accent"
                >
                  {Icon && (
                    <Icon className="h-4 w-4 text-rose-700 dark:text-rose-300" />
                  )}
                  {link.label}
                </Link>
              );
            })}

            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition hover:bg-accent"
                >
                  <UserRound className="h-4 w-4" />
                  My profile
                </Link>

                <button
                  type="button"
                  disabled={signingOut}
                  onClick={() => void handleSignOut()}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition hover:bg-accent"
              >
                <UserRound className="h-4 w-4" />
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
