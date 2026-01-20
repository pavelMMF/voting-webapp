import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/AppShell";
import { Badge, ButtonLink, Card } from "../components/ui";
import { useAuth } from "../auth/AuthProvider";

type ProposalRow = {
  proposalId: string;
  title?: string;
  description?: string;
  onchain: {
    proposalId: string;
    topicId: number;
    state: number;
    snapshotBlock: number;
    deadlineBlock: number;
    votes: { against: string; for: string; abstain: string };
  };
};

function stateLabel(s: number) {
  // OZ Governor: 0 Pending, 1 Active, 2 Canceled, 3 Defeated, 4 Succeeded, 5 Queued, 6 Expired, 7 Executed
  if (s === 1) return { tone: "live" as const, text: "Active" };
  if (s === 0) return { tone: "neutral" as const, text: "Pending" };
  return { tone: "ended" as const, text: "Ended" };
}

export default function Votes() {
  const { user } = useAuth();
  const [data, setData] = useState<ProposalRow[]>([]);
  const [tab, setTab] = useState<"live" | "upcoming" | "ended">("live");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const r = await fetch("/api/proposals", { credentials: "include" }).then(async (res) => {
      const t = await res.text();
      if (!res.ok) throw new Error(t || `HTTP ${res.status}`);
      return JSON.parse(t);
    });
    setData(r.proposals ?? []);
  }

  useEffect(() => {
    load().catch((e) => setErr(e?.message ?? String(e)));
  }, []);

  const filtered = useMemo(() => {
    return data.filter((p) => {
      const st = p.onchain?.state ?? 99;
      if (tab === "live") return st === 1;
      if (tab === "upcoming") return st === 0;
      return st !== 0 && st !== 1;
    });
  }, [data, tab]);

  return (
    <AppShell
      title="Голосования"
      subtitle="Данные берём с чейна: state/snapshot/deadline/votes/topicId."
    >
      {err ? <div className="mb-4 text-amber-200 text-sm">{err}</div> : null}

      <div className="flex flex-wrap items-center gap-2">
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

        <div className="flex-1" />

        {user?.role === "admin" ? (
          <ButtonLink to="/votes/new" variant="ghost">
            + New proposal
          </ButtonLink>
        ) : null}

        <button
          onClick={() => load().catch((e) => setErr(e?.message ?? String(e)))}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/8 transition"
        >
          Refresh
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        {filtered.map((p) => {
          const st = stateLabel(p.onchain.state);
          return (
            <Card key={p.onchain.proposalId} glow={p.onchain.state === 1}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge tone={st.tone}>{st.text}</Badge>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight">
                    #{p.onchain.proposalId} • topic {p.onchain.topicId}
                  </h3>
                  <p className="mt-1 text-sm text-white/60">
                    snapshot #{p.onchain.snapshotBlock} • deadline #{p.onchain.deadlineBlock}
                  </p>
                  {p.title ? (
                    <p className="mt-2 text-sm text-white/80">{p.title}</p>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <ButtonLink to={`/votes/${p.onchain.proposalId}`} variant="ghost">
                    Подробнее
                  </ButtonLink>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm text-white/70">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  Against: <b>{p.onchain.votes.against}</b>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  For: <b>{p.onchain.votes.for}</b>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  Abstain: <b>{p.onchain.votes.abstain}</b>
                </div>
              </div>
            </Card>
          );
        })}

        {filtered.length === 0 ? (
          <Card>
            <div className="text-sm text-white/60">
              Пусто. Если ты admin — создай новое голосование. Если уже есть proposals в чейне,
              но список пуст — значит они не были созданы через наш backend (мы пока храним список в DB).
            </div>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
