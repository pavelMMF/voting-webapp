import React from "react";
import { Link } from "react-router-dom";

export function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "live" | "ended" | "warning";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/6 text-white/80 border-white/10",
    live: "bg-cyan-400/10 text-cyan-200 border-cyan-300/20",
    ended: "bg-fuchsia-400/10 text-fuchsia-200 border-fuchsia-300/20",
    warning: "bg-amber-400/10 text-amber-200 border-amber-300/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
        tones[tone]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  glow = false,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur",
        glow &&
          "shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_28px_rgba(34,211,238,0.12)]",
        className
      )}
    >
      <div className="absolute inset-0 rounded-2xl pointer-events-none [mask-image:radial-gradient(120px_120px_at_20%_0%,black,transparent)] bg-gradient-to-r from-cyan-400/18 via-transparent to-fuchsia-500/14" />
      <div className="relative p-5">{children}</div>
    </div>
  );
}

export function ButtonLink({
  to,
  children,
  variant = "primary",
}: {
  to: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const v =
    variant === "primary"
      ? "bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black hover:opacity-95"
      : "bg-white/5 text-white/90 hover:bg-white/8 border border-white/10";

  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition",
        v
      )}
    >
      {children}
    </Link>
  );
}

// если нужна кнопка без роутинга (на будущее)
export function Button({
  onClick,
  children,
  variant = "ghost",
}: {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const v =
    variant === "primary"
      ? "bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black hover:opacity-95"
      : "bg-white/5 text-white/90 hover:bg-white/8 border border-white/10";

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition",
        v
      )}
      type="button"
    >
      {children}
    </button>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-lg font-semibold tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  label,
}: {
  value: number; // 0..100
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      {label && (
        <div className="mb-2 flex items-center justify-between text-xs text-white/60">
          <span>{label}</span>
          <span>{v}%</span>
        </div>
      )}
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}