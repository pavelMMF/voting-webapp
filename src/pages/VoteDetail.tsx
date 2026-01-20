import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ethers } from "ethers";
import { AppShell } from "../components/AppShell";

function fmt18(raw?: string) {
  if (!raw) return "0";
  try {
    return ethers.formatUnits(raw, 18);
  } catch {
    return raw;
  }
}

export default function VoteDetail() {
  const { id = "" } = useParams();
  const [proposal, setProposal] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [receipt, setReceipt] = useState<any>(null);
  const [tx, setTx] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);

    const p = await fetch(`/api/proposals/${id}`, { credentials: "include" }).then(async (r) => {
      const t = await r.text();
      if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
      return JSON.parse(t);
    });

    const pr = await fetch(`/api/proposals/${id}/preview`, { credentials: "include" }).then(async (r) => {
      const t = await r.text();
      if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
      return JSON.parse(t);
    });

    const mr = await fetch(`/api/proposals/${id}/my-vote`, { credentials: "include" }).then(async (r) => {
      const t = await r.text();
      if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
      return JSON.parse(t);
    });

    setProposal(p.proposal);
    setPreview(pr.preview);
    setReceipt(mr.receipt);
  }

  useEffect(() => {
    load().catch((e) => setErr(String(e)));
  }, [id]);

  async function vote(support: number) {
    try {
      setErr(null);
      const r = await fetch(`/api/proposals/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ support }),
      }).then(async (res) => {
        const t = await res.text();
        if (!res.ok) throw new Error(t || `HTTP ${res.status}`);
        return JSON.parse(t);
      });

      setTx(r);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <AppShell title={`Голосование #${id}`} subtitle="Preview веса берём с backend (baseVotes/cap/effective).">
      {err ? <div className="text-amber-200 text-sm mb-3">{err}</div> : null}

      <div className="space-y-4">
        <pre className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70 overflow-auto">
          {proposal ? JSON.stringify(proposal, null, 2) : "Loading proposal..."}
        </pre>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="font-semibold">Твой вес голоса сейчас</div>
          {preview ? (
            <div className="mt-2 text-sm text-white/70 space-y-1">
              <div>
                BaseVotes@Snapshot-1: <b>{fmt18(preview.baseVotes)}</b>
                <div className="text-[11px] text-white/45 break-all">raw: {preview.baseVotes}</div>
              </div>
              <div>
                Cap(topicId={preview.topicId}): <b>{fmt18(preview.cap)}</b>
                <div className="text-[11px] text-white/45 break-all">raw: {preview.cap}</div>
              </div>
              <div>
                Effective = min: <b>{fmt18(preview.effective)}</b>
                <div className="text-[11px] text-white/45 break-all">raw: {preview.effective}</div>
              </div>
            </div>
          ) : (
            "Loading preview..."
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="font-semibold">Мой голос (receipt)</div>
          <pre className="mt-2 text-xs text-white/70 overflow-auto">
            {receipt ? JSON.stringify({
              against: fmt18(receipt.against),
              for: fmt18(receipt.for),
              abstain: fmt18(receipt.abstain),
              raw: receipt
            }, null, 2) : "Loading receipt..."}
          </pre>
        </div>

        <div className="flex gap-2">
          <button className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15" onClick={() => vote(1)}>
            За
          </button>
          <button className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15" onClick={() => vote(0)}>
            Против
          </button>
          <button className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15" onClick={() => vote(2)}>
            Воздерж.
          </button>
        </div>

        {tx?.txHash ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70 break-all">
            Tx: <b>{tx.txHash}</b>
            {tx.explorer ? (
              <div className="mt-1">
                <a className="underline" href={tx.explorer} target="_blank" rel="noreferrer">
                  View in explorer
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
