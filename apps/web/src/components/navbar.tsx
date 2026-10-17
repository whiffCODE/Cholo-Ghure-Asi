"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Menu,
  MapPinned,
  Users,
  TrainFront,
  UserRound,
  Compass,
  ChevronDown,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const links = [
  { label: "Home", href: "/", icon: Compass },
  { label: "Map", href: "/map", icon: MapPinned },
  { label: "North Pandals", href: "/map?region=North" },
  { label: "Central Pandals", href: "/map?region=Central" },
  { label: "South Pandals", href: "/map?region=South" },
  { label: "Friends", href: "/friends", icon: Users },
  { label: "Nearest Metro", href: "/metro", icon: TrainFront },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-[1000] border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-rose-800 text-lg font-black text-amber-100 shadow-sm">
            <img
              src="/assets/cga_logo.png"
              alt=""
              className="h-full w-full object-contain"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <span className="sr-only">Cholo Ghure Asi</span>
          </span>

          <span className="leading-tight">
            <span className="block text-sm font-black tracking-tight sm:text-base">
              Cholo Ghure Asi
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Kolkata Puja Guide
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 xl:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />

          <Button asChild className="hidden rounded-xl sm:inline-flex">
            <Link href="/profile">
              <UserRound className="mr-2 h-4 w-4" />
              Profile
            </Link>
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="rounded-xl xl:hidden"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </nav>

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
                  {Icon && <Icon className="h-4 w-4 text-rose-700 dark:text-rose-300" />}
                  {link.label}
                </Link>
              );
            })}

            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition hover:bg-accent"
            >
              <UserRound className="h-4 w-4" />
              Profile / Sign in
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}