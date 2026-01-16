import { useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { Badge, ButtonLink, Card, ProgressBar } from "../components/ui";

type Status = "live" | "upcoming" | "ended";

const ballots = [
  {
    id: 42,
    title: "Утвердить бюджет на Q1 2026",
    status: "live" as Status,
    closesIn: "18ч 12м",
    turnout: 47,
    quorum: 60,
    snapshot: "#18392",
  },
  {
    id: 43,
    title: "Изменить правило кворума (60% → 55%)",
    status: "upcoming" as Status,
    closesIn: "старт через 2д",
    turnout: 0,
    quorum: 55,
    snapshot: "—",
  },
  {
    id: 41,
    title: "Закупить оборудование (лимит 120k)",
    status: "ended" as Status,
    closesIn: "закрыто",
    turnout: 71,
    quorum: 60,
    snapshot: "#18110",
    result: { yes: 62, no: 38 },
  },
];

export default function Votes() {
  const [tab, setTab] = useState<Status>("live");

  const filtered = useMemo(
    () => ballots.filter((b) => b.status === tab),
    [tab]
  );

  return (
    <AppShell
      title="Голосования"
      subtitle="Живые, будущие и завершённые. Всё по-честному, всё проверяемо."
    >
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab("live")}
          className={`rounded-xl px-4 py-2 text-sm border ${
            tab === "live"
              ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-200"
              : "border-white/10 bg-white/5 text-white/75 hover:bg-white/8"
          }`}
        >
          Live
        </button>
        <button
          onClick={() => setTab("upcoming")}
          className={`rounded-xl px-4 py-2 text-sm border ${
            tab === "upcoming"
              ? "border-fuchsia-300/30 bg-fuchsia-400/10 text-fuchsia-200"
              : "border-white/10 bg-white/5 text-white/75 hover:bg-white/8"
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setTab("ended")}
          className={`rounded-xl px-4 py-2 text-sm border ${
            tab === "ended"
              ? "border-white/20 bg-white/10 text-white"
              : "border-white/10 bg-white/5 text-white/75 hover:bg-white/8"
          }`}
        >
          Ended
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        {filtered.map((b) => (
          <Card key={b.id} glow={b.status === "live"}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Badge
                  tone={
                    b.status === "live"
                      ? "live"
                      : b.status === "ended"
                      ? "ended"
                      : "neutral"
                  }
                >
                  {b.status === "live"
                    ? "Активно"
                    : b.status === "upcoming"
                    ? "Скоро"
                    : "Завершено"}
                </Badge>
                <h3 className="mt-2 text-lg font-semibold tracking-tight">
                  #{b.id} — {b.title}
                </h3>
                <p className="mt-1 text-sm text-white/60">
                  {b.status === "live" ? `Закрытие: ${b.closesIn}` : b.closesIn} •
                  Кворум: {b.quorum}% • Snapshot: {b.snapshot}
                </p>
              </div>

              <div className="flex gap-2">
                <ButtonLink to="/votes" variant="ghost">
                  Подробнее
                </ButtonLink>
                {b.status === "live" ? (
                  <ButtonLink to="/votes">Голосовать</ButtonLink>
                ) : (
                  <ButtonLink to="/votes" variant="ghost">
                    Результаты
                  </ButtonLink>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <ProgressBar value={b.turnout} label="Явка" />
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/60">
                <div className="text-white/80">Audit</div>
                <div className="mt-1">export • hash • verify</div>
              </div>
            </div>

            {"result" in b && (b as any).result ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-white/70">За</div>
                  <div className="mt-1 text-white font-semibold">
                    {(b as any).result.yes}%
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-white/70">Против</div>
                  <div className="mt-1 text-white font-semibold">
                    {(b as any).result.no}%
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
        ))}

        {filtered.length === 0 && (
          <Card>
            <p className="text-sm text-white/60">Пока пусто в этой вкладке.</p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
