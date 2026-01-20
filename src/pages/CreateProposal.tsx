import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, credentials: "include" });
  const t = await r.text().catch(() => "");
  if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
  return t ? (JSON.parse(t) as T) : ({} as T);
}

export default function CreateProposal() {
  const nav = useNavigate();

  const [topics, setTopics] = useState<any[]>([]);
  const [topicId, setTopicId] = useState<number>(1);

  const [title, setTitle] = useState("Website: change roadmap");
  const [description, setDescription] = useState("Proposal demo for topic.");
  const [incBy, setIncBy] = useState(1);

  const [err, setErr] = useState<string | null>(null);

  async function loadTopics() {
    const r = await api<{ ok: boolean; topics: any[] }>("/api/topics");
    setTopics(r.topics ?? []);
    if ((r.topics ?? []).length && !r.topics.find((t) => t.id === topicId)) {
      setTopicId(Number(r.topics[0].id));
    }
  }

  useEffect(() => {
    loadTopics().catch((e) => setErr(String(e)));
  }, []);

  const selectedTopic = topics.find((t) => Number(t.id) === Number(topicId));

  async function create() {
    try {
      setErr(null);
      const r = await api<{ ok: boolean; proposalId: string }>(`/api/proposals/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId,
          title,
          description,
          counterIncBy: incBy,
        }),
      });
      nav(`/votes/${r.proposalId}`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <AppShell title="New proposal" subtitle="Выбираешь топик → создаём on-chain proposalWithTopic(topicId,...).">
      {err ? <div className="mb-4 text-amber-200 text-sm">{err}</div> : null}

      <div className="max-w-xl space-y-3">
        <label className="block text-sm text-white/70">Topic</label>
        <select
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
          value={topicId}
          onChange={(e) => setTopicId(Number(e.target.value))}
        >
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id} — {t.name}
            </option>
          ))}
        </select>

        {selectedTopic?.description ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
            {selectedTopic.description}
          </div>
        ) : null}

        <label className="block text-sm text-white/70">Title</label>
        <input
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <label className="block text-sm text-white/70">Description</label>
        <textarea
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label className="block text-sm text-white/70">Counter incBy (demo action)</label>
        <input
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
          type="number"
          value={incBy}
          onChange={(e) => setIncBy(Number(e.target.value))}
        />

        <button
          onClick={create}
          className="rounded-2xl px-5 py-3 text-sm font-semibold text-black
                     bg-gradient-to-r from-cyan-400 to-fuchsia-500
                     shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_28px_rgba(217,70,239,0.18)]
                     hover:opacity-95"
        >
          Create on-chain
        </button>
      </div>
    </AppShell>
  );
}
