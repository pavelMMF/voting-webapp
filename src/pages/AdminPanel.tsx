import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Card, Badge } from "../components/ui";

type Tab = "users" | "topics" | "exams" | "reviews";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, credentials: "include" });
  const t = await r.text().catch(() => "");
  if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
  return t ? (JSON.parse(t) as T) : ({} as T);
}

function tabBtn(active: boolean) {
  return `rounded-xl px-4 py-2 text-sm border ${
    active
      ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-200"
      : "border-white/10 bg-white/5 text-white/75 hover:bg-white/8"
  }`;
}

function levelBtn(active: boolean) {
  return active
    ? "rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.18)]"
    : "rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs hover:bg-white/15";
}

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function emptyCard(type: "choice" | "text" | "manual") {
  const id = "c_" + Math.random().toString(16).slice(2, 8);
  if (type === "choice") {
    return { id, type, title: "", text: "", media: [], points: 1, options: ["", "", "", ""], correct: 0 };
  }
  if (type === "text") {
    return { id, type, title: "", text: "", media: [], points: 1, placeholder: "Введите ответ", accepted: [""] };
  }
  return { id, type, title: "", text: "", media: [], points: 1, rubric: "" };
}

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("users");
  const [err, setErr] = useState<string | null>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);

  // users search + topic selector
  const [q, setQ] = useState("");
  const [activeTopicId, setActiveTopicId] = useState<number>(1);

  // create topic
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDesc, setNewTopicDesc] = useState("");
  const [newQ0, setNewQ0] = useState(0.1);
  const [newQ1, setNewQ1] = useState(0.15);
  const [newQ2, setNewQ2] = useState(0.2);
  const [newQ3, setNewQ3] = useState(0.55);

  // exams builder
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId) ?? null,
    [exams, selectedExamId]
  );
  const [draft, setDraft] = useState<any>(null);

  // create exam
  const [createExamTitle, setCreateExamTitle] = useState("New exam");
  const [createExamTopicId, setCreateExamTopicId] = useState<number>(1);
  const [createExamPass, setCreateExamPass] = useState<number>(80);
  const [createExamLevel, setCreateExamLevel] = useState<number>(1); // 0..3

  async function loadAll() {
    setErr(null);
    const [u, t, e, r] = await Promise.all([
      api<{ ok: boolean; users: any[] }>("/api/admin/users"),
      api<{ ok: boolean; topics: any[] }>("/api/admin/topics"),
      api<{ ok: boolean; exams: any[] }>("/api/admin/exams"),
      api<{ ok: boolean; pending: any[] }>("/api/admin/reviews"),
    ]);
    setUsers(u.users ?? []);
    setTopics(t.topics ?? []);
    setExams(e.exams ?? []);
    setPending(r.pending ?? []);

    // если активный топик не существует — переключим на первый
    const first = (t.topics ?? [])[0];
    if (first && !(t.topics ?? []).some((x:any)=>Number(x.id)===Number(activeTopicId))) {
      setActiveTopicId(Number(first.id));
    }
  }

  useEffect(() => {
    loadAll().catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    if (selectedExam) setDraft(JSON.parse(JSON.stringify(selectedExam)));
  }, [selectedExamId]);

  const filteredUsers = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => {
      const email = String(u.email ?? "").toLowerCase();
      const wallet = String(u.walletAddress ?? "").toLowerCase();
      return email.includes(s) || wallet.includes(s);
    });
  }, [users, q]);

  const activeTopicLabel = useMemo(() => {
    const t = topics.find((x) => Number(x.id) === Number(activeTopicId));
    return t ? `${t.id} — ${t.name}` : String(activeTopicId);
  }, [topics, activeTopicId]);

  async function setLevel(userId: string, level: number) {
    setErr(null);
    await api(`/api/admin/users/${userId}/set-level`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: activeTopicId, level }),
    });
    await loadAll();
  }

  async function bootstrapUser(userId: string) {
    setErr(null);
    await api(`/api/admin/users/${userId}/bootstrap`, { method: "POST" });
    await loadAll();
  }

  async function saveTopic(t: any) {
    setErr(null);
    const q = t.policy?.q ?? {};
    const sum = safeNum(q[0]) + safeNum(q[1]) + safeNum(q[2]) + safeNum(q[3]);
    if (Math.abs(sum - 1) > 0.0001) throw new Error("Сумма квот должна быть 1.00");

    await api(`/api/admin/topics/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t),
    });
    await loadAll();
  }

  async function createTopic() {
    setErr(null);
    const sum = newQ0 + newQ1 + newQ2 + newQ3;
    if (Math.abs(sum - 1) > 0.0001) throw new Error("Сумма квот должна быть 1.00");

    const policy = {
      q: { 0: newQ0, 1: newQ1, 2: newQ2, 3: newQ3 },
      f: { 1: 1.2, 2: 2.0, 3: 4.0 },
      delta: { 1: 0.5, 2: 0.5, 3: 0.5 },
      T_years: 5,
      eduPoolFrac: 0.05,
    };

    await api(`/api/admin/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTopicName, description: newTopicDesc, policy }),
    });

    setNewTopicName("");
    setNewTopicDesc("");
    await loadAll();
  }

  async function createExam() {
    setErr(null);
    if (![0,1,2,3].includes(createExamLevel)) throw new Error("Level must be L0..L3");

    const r = await api<{ ok: boolean; id: string }>(`/api/admin/exams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: createExamTitle,
        topicId: createExamTopicId,
        passPercent: createExamPass,
        levelOnPass: createExamLevel,
        cards: [],
      }),
    });
    await loadAll();
    setSelectedExamId(r.id);
  }

  function updateDraft(patch: any) {
    setDraft((d: any) => ({ ...(d ?? {}), ...patch }));
  }

  async function saveExam() {
    setErr(null);
    if (!draft?.id) return;
    await api(`/api/admin/exams/${draft.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    await loadAll();
  }

  function addCard(type: "choice" | "text" | "manual") {
    const cards = [...(draft.cards ?? [])];
    cards.push(emptyCard(type));
    updateDraft({ cards });
  }

  function moveCard(i: number, dir: -1 | 1) {
    const cards = [...(draft.cards ?? [])];
    const j = i + dir;
    if (j < 0 || j >= cards.length) return;
    [cards[i], cards[j]] = [cards[j], cards[i]];
    updateDraft({ cards });
  }

  function removeCard(i: number) {
    const cards = [...(draft.cards ?? [])];
    cards.splice(i, 1);
    updateDraft({ cards });
  }

  return (
    <AppShell title="Админ-панель" subtitle="Users • Topics • Exams • Manual reviews">
      {err ? <div className="mb-4 text-amber-200 text-sm">{err}</div> : null}

      <div className="flex gap-2 mb-4">
        {(["users", "topics", "exams", "reviews"] as Tab[]).map((x) => (
          <button key={x} onClick={() => setTab(x)} className={tabBtn(tab === x)}>
            {x}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => loadAll().catch((e) => setErr(String(e)))}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/8"
        >
          Refresh
        </button>
      </div>

      {/* USERS */}
      {tab === "users" ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="text-lg font-semibold">Users</div>

            <div className="flex gap-2 items-center">
              <select
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
                value={activeTopicId}
                onChange={(e) => setActiveTopicId(Number(e.target.value))}
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} — {t.name}
                  </option>
                ))}
              </select>

              <input
                className="w-80 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
                placeholder="Search email or wallet..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="text-xs text-white/60 mb-3">
            Active topic: <b className="text-white">{activeTopicLabel}</b>
          </div>

          <div className="space-y-3">
            {filteredUsers.map((u) => {
              const cur = Number(u.levels?.[String(activeTopicId)]?.level ?? 0);
              return (
                <div key={u.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">{u.email}</div>
                      <div className="text-xs text-white/60">wallet: {u.walletAddress ?? "—"}</div>
                      <div className="text-xs text-white/60">role: {u.role}</div>

                      <div className="mt-2">
                        <button
                          onClick={() => bootstrapUser(u.id).catch((e)=>setErr(String(e)))}
                          className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
                        >
                          Give tokens + delegate
                        </button>
                      </div>

                      <pre className="mt-2 text-xs text-white/60">
                        {JSON.stringify(u.levels ?? {}, null, 2)}
                      </pre>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-white/60">Set level (active topic):</div>
                      <div className="flex gap-2">
                        {[0, 1, 2, 3].map((lvl) => (
                          <button key={lvl} onClick={() => setLevel(u.id, lvl).catch((e)=>setErr(String(e)))} className={levelBtn(cur === lvl)}>
                            L{lvl}
                          </button>
                        ))}
                      </div>
                      <div className="text-xs text-white/50">
                        Current: <b className="text-white">L{cur}</b>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredUsers.length === 0 ? <div className="text-sm text-white/60">No users.</div> : null}
          </div>
        </Card>
      ) : null}

      {/* TOPICS */}
      {tab === "topics" ? (
        <div className="space-y-4">
          <Card glow>
            <div className="text-lg font-semibold mb-2">Create topic</div>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" placeholder="Topic name" value={newTopicName} onChange={(e)=>setNewTopicName(e.target.value)} />
              <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" placeholder="Description" value={newTopicDesc} onChange={(e)=>setNewTopicDesc(e.target.value)} />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              {[
                ["q0", newQ0, setNewQ0],
                ["q1", newQ1, setNewQ1],
                ["q2", newQ2, setNewQ2],
                ["q3", newQ3, setNewQ3],
              ].map(([label, val, setter]: any) => (
                <div key={label}>
                  <div className="text-xs text-white/60">{label}</div>
                  <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="number" step="0.01" value={val} onChange={(e)=>setter(Number(e.target.value))} />
                </div>
              ))}
            </div>

            <div className="mt-2 text-xs text-white/60">sum = {(newQ0+newQ1+newQ2+newQ3).toFixed(2)} (must be 1.00)</div>

            <button onClick={() => createTopic().catch((e)=>setErr(String(e)))} className="mt-3 rounded-2xl px-5 py-3 text-sm font-semibold text-black bg-gradient-to-r from-cyan-400 to-fuchsia-500 hover:opacity-95">
              Create
            </button>
          </Card>

          <Card>
            <div className="text-lg font-semibold mb-3">Topics</div>
            <div className="space-y-3">
              {topics.map((t) => {
                const q = t.policy?.q ?? {0:0.25,1:0.15,2:0.25,3:0.35};
                const sum = safeNum(q[0])+safeNum(q[1])+safeNum(q[2])+safeNum(q[3]);
                return (
                  <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <Badge tone="neutral">topicId: {t.id}</Badge>
                        <div className="mt-2 font-semibold">{t.name}</div>
                        {t.description ? <div className="mt-1 text-xs text-white/60">{t.description}</div> : null}

                        <div className="mt-3 grid gap-3 sm:grid-cols-4">
                          {[0,1,2,3].map((k) => (
                            <div key={k}>
                              <div className="text-xs text-white/60">q{k}</div>
                              <input
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                                type="number"
                                step="0.01"
                                value={safeNum(q[k])}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  const next = { ...t, policy: { ...(t.policy ?? {}), q: { ...(t.policy?.q ?? {}), [k]: v } } };
                                  setTopics((arr) => arr.map((x) => (x.id === t.id ? next : x)));
                                }}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 text-xs text-white/60">
                          sum = {sum.toFixed(2)} {Math.abs(sum - 1) > 0.0001 ? " (fix to 1.00)" : ""}
                        </div>
                      </div>

                      <button onClick={() => saveTopic(t).catch((e)=>setErr(String(e)))} className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
                        Save
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      ) : null}

      {/* EXAMS */}
      {tab === "exams" ? (
        <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-4 space-y-4">
            <Card glow>
              <div className="text-lg font-semibold mb-2">Create exam</div>

              <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                value={createExamTitle} onChange={(e)=>setCreateExamTitle(e.target.value)} placeholder="Название экзамена" />

              <div className="mt-2">
                <div className="text-xs text-white/60 mb-1">Топик</div>
                <select className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
                  value={createExamTopicId} onChange={(e)=>setCreateExamTopicId(Number(e.target.value))}>
                  {topics.map((t)=>(
                    <option key={t.id} value={t.id}>{t.id} — {t.name}</option>
                  ))}
                </select>
              </div>

              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-white/60 mb-1">Проходной балл</div>
                  <div className="flex items-center gap-2">
                    <input className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                      type="number" min={0} max={100} value={createExamPass} onChange={(e)=>setCreateExamPass(Number(e.target.value))} />
                    <span className="text-sm text-white/70">%</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-white/60 mb-1">Уровень за сдачу</div>
                  <select className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
                    value={createExamLevel} onChange={(e)=>setCreateExamLevel(Number(e.target.value))}>
                    <option value={0}>L0</option>
                    <option value={1}>L1</option>
                    <option value={2}>L2</option>
                    <option value={3}>L3</option>
                  </select>
                </div>
              </div>

              <button onClick={() => createExam().catch((e)=>setErr(String(e)))} className="mt-3 rounded-2xl px-5 py-3 text-sm font-semibold text-black bg-gradient-to-r from-cyan-400 to-fuchsia-500 hover:opacity-95">
                Create exam
              </button>
            </Card>

            <Card>
              <div className="text-lg font-semibold mb-2">Exams</div>
              <div className="space-y-2">
                {exams.map((e) => (
                  <button key={e.id} onClick={() => setSelectedExamId(e.id)}
                    className={`w-full text-left rounded-xl border px-3 py-2 text-sm ${
                      selectedExamId === e.id ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-200" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/8"
                    }`}>
                    {e.id} • topic {e.topicId}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <div className="md:col-span-8">
            <Card glow>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">Exam builder</div>
                  <div className="text-xs text-white/60">Карточки: choice / text / manual + media. Save пишет в db.</div>
                </div>
                <button onClick={() => saveExam().catch((e)=>setErr(String(e)))} className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15" disabled={!draft?.id}>
                  Save
                </button>
              </div>

              {!draft ? (
                <div className="mt-4 text-sm text-white/60">Выбери экзамен слева.</div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                      value={draft.title ?? ""} onChange={(e)=>updateDraft({ title: e.target.value })} placeholder="Title" />
                    <div className="grid grid-cols-3 gap-2">
                      <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="number"
                        value={draft.topicId ?? 0} onChange={(e)=>updateDraft({ topicId: Number(e.target.value) })} placeholder="topicId" />
                      <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="number"
                        value={draft.passPercent ?? 80} onChange={(e)=>updateDraft({ passPercent: Number(e.target.value) })} placeholder="pass%" />
                      <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="number"
                        value={draft.levelOnPass ?? 1} onChange={(e)=>updateDraft({ levelOnPass: Number(e.target.value) })} placeholder="level" />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => addCard("choice")} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs hover:bg-white/15">+ choice</button>
                    <button onClick={() => addCard("text")} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs hover:bg-white/15">+ text</button>
                    <button onClick={() => addCard("manual")} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs hover:bg-white/15">+ manual</button>
                  </div>

                  <div className="space-y-3">
                    {(draft.cards ?? []).map((c: any, i: number) => (
                      <div key={c.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold">Card {i+1} • {c.type} • {c.id}</div>
                          <div className="flex gap-2">
                            <button onClick={() => moveCard(i, -1)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/8">↑</button>
                            <button onClick={() => moveCard(i, 1)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/8">↓</button>
                            <button onClick={() => removeCard(i)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/8">Remove</button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                            value={c.title ?? ""} onChange={(e)=>{ const cards=[...(draft.cards??[])]; cards[i]={...c,title:e.target.value}; updateDraft({cards}); }} placeholder="Title" />
                          <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="number"
                            value={c.points ?? 1} onChange={(e)=>{ const cards=[...(draft.cards??[])]; cards[i]={...c,points:Number(e.target.value)}; updateDraft({cards}); }} placeholder="Points" />
                        </div>

                        <textarea className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                          rows={3} value={c.text ?? ""} onChange={(e)=>{ const cards=[...(draft.cards??[])]; cards[i]={...c,text:e.target.value}; updateDraft({cards}); }} placeholder="Text" />

                        <input className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                          value={(c.media ?? []).join(",")} onChange={(e)=>{ const media=e.target.value.split(",").map(s=>s.trim()).filter(Boolean); const cards=[...(draft.cards??[])]; cards[i]={...c,media}; updateDraft({cards}); }} placeholder="Media URLs (comma separated)" />

                        {c.type === "choice" ? (
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <textarea className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                              rows={4} value={(c.options ?? []).join("\n")} onChange={(e)=>{ const options=e.target.value.split("\n"); const cards=[...(draft.cards??[])]; cards[i]={...c,options}; updateDraft({cards}); }} placeholder="Options (one per line)" />
                            <div>
                              <div className="text-xs text-white/60 mb-1">Correct index</div>
                              <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="number"
                                value={c.correct ?? 0} onChange={(e)=>{ const cards=[...(draft.cards??[])]; cards[i]={...c,correct:Number(e.target.value)}; updateDraft({cards}); }} />
                            </div>
                          </div>
                        ) : null}

                        {c.type === "text" ? (
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <textarea className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                              rows={4} value={(c.accepted ?? []).join("\n")} onChange={(e)=>{ const accepted=e.target.value.split("\n"); const cards=[...(draft.cards??[])]; cards[i]={...c,accepted}; updateDraft({cards}); }} placeholder="Accepted answers (one per line)" />
                            <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                              value={c.placeholder ?? ""} onChange={(e)=>{ const cards=[...(draft.cards??[])]; cards[i]={...c,placeholder:e.target.value}; updateDraft({cards}); }} placeholder="Placeholder" />
                          </div>
                        ) : null}

                        {c.type === "manual" ? (
                          <textarea className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                            rows={3} value={c.rubric ?? ""} onChange={(e)=>{ const cards=[...(draft.cards??[])]; cards[i]={...c,rubric:e.target.value}; updateDraft({cards}); }} placeholder="Rubric (admin hint)" />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {/* REVIEWS */}
      {tab === "reviews" ? (
        <Card>
          <div className="text-lg font-semibold mb-3">Manual reviews (pending)</div>
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-white/80">
                    attempt: <b>{p.id}</b> • exam: {p.examId} • userId: {p.userId}
                  </div>
                  <div className="text-xs text-white/60">submitted: {p.submittedAt}</div>
                </div>

                <Link to={`/admin/reviews/${p.id}`} className="rounded-2xl px-4 py-2 text-sm font-semibold text-black bg-gradient-to-r from-cyan-400 to-fuchsia-500 hover:opacity-95">
                  Open
                </Link>
              </div>
            ))}
            {pending.length === 0 ? <div className="text-sm text-white/60">Очередь пуста.</div> : null}
          </div>
        </Card>
      ) : null}
    </AppShell>
  );
}
