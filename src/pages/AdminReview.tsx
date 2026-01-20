import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Card, Badge } from "../components/ui";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, credentials: "include" });
  const t = await r.text().catch(() => "");
  if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
  return t ? (JSON.parse(t) as T) : ({} as T);
}

export default function AdminReview() {
  const { attemptId = "" } = useParams();

  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<any>(null);

  async function load() {
    setErr(null);
    const r = await api<{ ok: boolean; attempt: any; exam: any }>(`/api/admin/reviews/${attemptId}`);
    setData(r);
    setResult(null);

    const exam = r.exam;
    const manual = (exam?.cards ?? []).filter((c: any) => c.type === "manual");
    const init: Record<string, boolean> = {};
    for (const c of manual) init[c.id] = false;
    setDecisions(init);
  }

  useEffect(() => {
    load().catch((e) => setErr(String(e)));
  }, [attemptId]);

  const exam = data?.exam;
  const attempt = data?.attempt;

  const manualCards = useMemo(() => (exam?.cards ?? []).filter((c: any) => c.type === "manual"), [exam]);
  const answers = attempt?.answers ?? {};

  async function finalize() {
    try {
      setErr(null);
      const r = await api(`/api/admin/reviews/${attemptId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions }),
      });
      setResult(r);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <AppShell title="Manual review" subtitle="Проверяешь manual карточки → финализируешь → уровень присваивается/нет.">
      {err ? <div className="mb-4 text-amber-200 text-sm">{err}</div> : null}

      {!data ? (
        <Card><div className="text-sm text-white/60">Loading...</div></Card>
      ) : (
        <div className="space-y-4">
          <Card glow>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Attempt: {attemptId}</div>
                <div className="mt-1 text-sm text-white/60">exam: {attempt.examId} • topic {attempt.topicId} • status: {attempt.status}</div>
                <div className="mt-1 text-sm text-white/60">auto: {attempt.auto?.percent ?? attempt.auto?.percentAuto ?? attempt.auto?.percent}%</div>
              </div>
              <Link className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/8" to="/admin">
                ← Back
              </Link>
            </div>
          </Card>

          {manualCards.map((c: any) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge tone="neutral">manual</Badge>
                  <div className="mt-2 text-lg font-semibold">{c.title}</div>
                  <div className="mt-2 text-sm text-white/80 whitespace-pre-wrap">{c.text}</div>
                  {c.rubric ? <div className="mt-2 text-xs text-white/50 whitespace-pre-wrap">{c.rubric}</div> : null}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setDecisions((d) => ({ ...d, [c.id]: true }))}
                    className={`rounded-xl px-4 py-2 text-sm border ${
                      decisions[c.id] === true
                        ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                        : "border-white/10 bg-white/5 text-white/80 hover:bg-white/8"
                    }`}
                  >
                    ✅ Правильно
                  </button>
                  <button
                    onClick={() => setDecisions((d) => ({ ...d, [c.id]: false }))}
                    className={`rounded-xl px-4 py-2 text-sm border ${
                      decisions[c.id] === false
                        ? "border-fuchsia-300/30 bg-fuchsia-400/10 text-fuchsia-200 shadow-[0_0_20px_rgba(217,70,239,0.15)]"
                        : "border-white/10 bg-white/5 text-white/80 hover:bg-white/8"
                    }`}
                  >
                    ❌ Неправильно
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs text-white/60">Ответ пользователя:</div>
                <div className="mt-2 text-sm text-white/90 whitespace-pre-wrap">
                  {answers[c.id] ?? "—"}
                </div>
              </div>
            </Card>
          ))}

          <div className="fixed bottom-6 right-6 z-40">
            <button
              onClick={finalize}
              className="rounded-2xl px-5 py-3 text-sm font-semibold text-black
                         bg-gradient-to-r from-cyan-400 to-fuchsia-500 hover:opacity-95"
            >
              Финализировать
            </button>
          </div>

          {result ? (
            <Card glow>
              <div className="text-lg font-semibold">Результат</div>
              <div className="mt-2 text-sm text-white/70">
                percent: <b className="text-white">{result.percent}</b> • passed:{" "}
                <b className="text-white">{String(result.passed)}</b>
              </div>
              {result.assignedLevel ? (
                <div className="mt-1 text-sm text-white/70">
                  assignedLevel: <b className="text-white">{result.assignedLevel}</b>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
