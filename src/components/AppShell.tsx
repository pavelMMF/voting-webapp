import React from "react";
import { Link, NavLink } from "react-router-dom";
import { cn } from "./ui";

const nav = [
  { to: "/", label: "Главная" },
  { to: "/votes", label: "Голосования" },
  { to: "/exams", label: "Экзамены" },
  { to: "/profile", label: "Профиль" },
];

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen bg-[#05060a] text-white">
      {/* subtle grid background */}
      <div className="pointer-events-none fixed inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(800px_400px_at_30%_0%,rgba(34,211,238,0.16),transparent_60%),radial-gradient(700px_420px_at_80%_10%,rgba(217,70,239,0.10),transparent_65%)]" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/35 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500" />
            <div>
              <div className="text-sm font-semibold tracking-tight">
                Voting Console
              </div>
              <div className="text-xs text-white/55">LAN / private</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-xl px-3 py-2 text-sm text-white/75 hover:text-white hover:bg-white/5 transition",
                    isActive && "bg-white/10 text-white"
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
              Live
            </span>
            <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/8 transition">
              Подписать / Wallet
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
        </div>
        {children}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-xs text-white/45">
        Snapshot-friendly UI • audit-first • no dark patterns
      </footer>
    </div>
  );
}
