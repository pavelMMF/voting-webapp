import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../auth/AuthProvider";
import { Card, Badge, ButtonLink } from "../components/ui";

async function api<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  const t = await r.text().catch(() => "");
  if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
  return t ? (JSON.parse(t) as T) : ({} as T);
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// форматируем как token(18 decimals)
function fmt18(raw?: string) {
  if (!raw) return "0";
  try {
    return ethers.formatUnits(raw, 18);
  } catch {
    return raw;
  }
}

export default function Profile() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const r = await api<{ ok: boolean; topicWeights: any[]; voted: any[] }>(
      "/api/profile/overview"
    );
    setOverview(r);
  }

  useEffect(() => {
    load().catch((e) => setErr(String(e)));
  }, []);

  return (
    <AppShell
      title="Профиль"
      subtitle="Учетка, текущий вес голоса по темам и история голосований."
    >
      {err ? <div className="mb-4 text-amber-200 text-sm">{err}</div> : null}

      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-5">
          <Card glow>
            <div className="text-lg font-semibold">{user?.email}</div>
            <div className="mt-1 text-sm text-white/60">role: {user?.role}</div>
            <div className="mt-1 text-sm text-white/60">
              wallet:{" "}
              {user?.walletAddress ? shortAddr(user.walletAddress) : "—"}
            </div>

            {user?.role === "admin" ? (
              <div className="mt-4">
                <ButtonLink to="/admin">Админ-панель</ButtonLink>
              </div>
            ) : null}
          </Card>

          <div className="mt-4">
            <Card>
              <div className="font-semibold">Экспертность по темам</div>
              <pre className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                {JSON.stringify(user?.levels ?? {}, null, 2)}
              </pre>
            </Card>
          </div>
        </div>

        <div className="md:col-span-7 space-y-4">
          <Card>
            <div className="flex items-center justify-between">
              <div className="font-semibold">Вес голоса сейчас</div>
              <button
                onClick={() => load().catch((e) => setErr(String(e)))}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/8"
              >
                Refresh
              </button>
            </div>

            {overview?.topicWeights?.length ? (
              <div className="mt-3 space-y-2">
                {overview.topicWeights.map((t: any) => (
                  <div
                    key={t.topicId}
                    className="rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">
                        topic {t.topicId} • {t.name}
                      </div>
                      <Badge tone="neutral">{fmt18(t.effectiveNow)}</Badge>
                    </div>

                    <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs text-white/70">
                      <div>
                        baseNow: <b className="text-white">{fmt18(t.baseNow)}</b>
                        <div className="text-[11px] text-white/45 break-all">
                          raw: {t.baseNow}
                        </div>
                      </div>

                      <div>
                        capNow: <b className="text-white">{fmt18(t.capNow)}</b>
                        <div className="text-[11px] text-white/45 break-all">
                          raw: {t.capNow}
                        </div>
                      </div>

                      <div>
                        effectiveNow:{" "}
                        <b className="text-white">{fmt18(t.effectiveNow)}</b>
                        <div className="text-[11px] text-white/45 break-all">
                          raw: {t.effectiveNow}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-white/60">Нет данных по темам.</div>
            )}
          </Card>

          <Card>
            <div className="font-semibold">Голосования, где ты голосовал(а)</div>
            {overview?.voted?.length ? (
              <div className="mt-3 space-y-2">
                {overview.voted.map((v: any) => (
                  <div
                    key={v.proposalId}
                    className="rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">
                        #{v.proposalId} • topic {v.topicId}
                      </div>
                      <ButtonLink to={`/votes/${v.proposalId}`} variant="ghost">
                        Открыть
                      </ButtonLink>
                    </div>

                    {v.title ? (
                      <div className="mt-1 text-xs text-white/60">{v.title}</div>
                    ) : null}

                    {v.receipt ? (
                      <div className="mt-2 text-xs text-white/70">
                        receipt: against={fmt18(v.receipt.against)} • for=
                        {fmt18(v.receipt.for)} • abstain={fmt18(v.receipt.abstain)}
                        <div className="mt-1 text-[11px] text-white/45 break-all">
                          raw: against={v.receipt.against} • for={v.receipt.for} •
                          abstain={v.receipt.abstain}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-white/60">
                        receipt: n/a
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-white/60">Пока нет.</div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
