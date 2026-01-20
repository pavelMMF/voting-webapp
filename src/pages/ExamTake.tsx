import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/ui";

type CardType = "choice" | "text" | "manual";

function isFilled(card: any, answer: any) {
  if (card.type === "choice") return typeof answer === "number";
  if (card.type === "text") return typeof answer === "string" && answer.trim().length > 0;
  if (card.type === "manual") return typeof answer === "string" && answer.trim().length > 0;
  return true;
}

function MediaBlock({ media }: { media: any[] }) {
  if (!media || media.length === 0) return null;
  return (
    <div className="mt-3 grid gap-3">
      {media.map((m, idx) => {
        const url = typeof m === "string" ? m : m?.url;
        if (!url) return null;
        return (
          <img
            key={idx}
            src={url}
            alt=""
            className="max-h-64 w-full rounded-xl border border-white/10 object-cover"
          />
        );
      })}
    </div>
  );
}

export default function ExamTake() {
  const { id = "" } = useParams();
  const [exam, setExam] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [err, setErr] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<any>(null);

  async function load() {
    setErr(null);
    const r = await fetch(`/api/exams/${id}`, { credentials: "include" }).then(async (res) => {
      const t = await res.text();
      if (!res.ok) throw new Error(t || `HTTP ${res.status}`);
      return JSON.parse(t);
    });
    setExam(r.exam);
    setIdx(0);
    setSubmitResult(null);
    setAnswers({});
  }

  useEffect(() => {
    load().catch((e) => setErr(String(e)));
  }, [id]);

  const cards = exam?.cards ?? [];
  const card = cards[idx];

  const progress = useMemo(() => {
    const total = cards.length || 1;
    const done = cards.filter((c: any) => isFilled(c, answers[c.id])).length;
    return { done, total };
  }, [cards, answers]);

  const canPrev = idx > 0;
  const canNext = idx < cards.length - 1;
  const isLast = idx === cards.length - 1;

  const allAutofillOk = useMemo(() => {
    // чтобы не блокировать UX, разрешаем "Завершить" даже если не всё заполнено,
    // но показываем предупреждение
    return progress.done === progress.total;
  }, [progress]);

  async function submit() {
    try {
      setErr(null);
      const r = await fetch(`/api/exams/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ answers }),
      }).then(async (res) => {
        const t = await res.text();
        if (!res.ok) throw new Error(t || `HTTP ${res.status}`);
        return JSON.parse(t);
      });

      setSubmitResult(r);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <AppShell title="Экзамен" subtitle="Карточки вопросов. Можно идти вперёд/назад. Manual уходит в админ-ревью.">
      {err ? <div className="mb-4 text-amber-200 text-sm">{err}</div> : null}

      {!exam ? (
        <Card>
          <div className="text-sm text-white/60">Loading...</div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card glow>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-semibold">{exam.title}</div>
                <div className="mt-1 text-sm text-white/60">
                  TopicId: {exam.topicId} • проходной: {exam.passPercent}% • карточка {idx + 1}/{cards.length}
                </div>
              </div>

              <div className="text-sm text-white/60">
                Заполнено: <b className="text-white">{progress.done}</b> / {progress.total}
              </div>
            </div>
          </Card>

          {submitResult ? (
            <Card glow>
              <div className="text-lg font-semibold">Результат</div>
              <div className="mt-2 text-sm text-white/70">
                Статус: <b className="text-white">{submitResult.status}</b>
              </div>
              <div className="mt-1 text-sm text-white/70">
                Auto: <b className="text-white">{submitResult.autoPercent}%</b>
              </div>
              <div className="mt-1 text-sm text-white/70">
                {submitResult.passed ? "Сдано ✅" : "Не сдано ❌"}
                {submitResult.assignedLevel ? ` • присвоен уровень ${submitResult.assignedLevel}` : ""}
              </div>
              <div className="mt-2 text-sm text-white/60">{submitResult.message}</div>

              <div className="mt-4 flex gap-2">
                <Link className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/8" to="/exams">
                  Назад к экзаменам
                </Link>
                <Link className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/8" to="/votes">
                  К голосованиям
                </Link>
              </div>
            </Card>
          ) : (
            <>
              <Card>
                <div className="text-sm text-white/60">Карточка {idx + 1} / {cards.length}</div>
                <div className="mt-2 text-lg font-semibold">{card?.title ?? ""}</div>
                <div className="mt-2 text-sm text-white/80 whitespace-pre-wrap">{card?.text ?? ""}</div>

                <MediaBlock media={card?.media ?? []} />

                {/* Card body */}
                <div className="mt-4">
                  {card?.type === "choice" ? (
                    <div className="space-y-2">
                      {(card.options ?? []).map((opt: string, i: number) => (
                        <label
                          key={i}
                          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/8 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={card.id}
                            checked={answers[card.id] === i}
                            onChange={() => setAnswers((a) => ({ ...a, [card.id]: i }))}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : card?.type === "text" ? (
                    <input
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
                      placeholder={card?.placeholder ?? "Введите ответ"}
                      value={answers[card.id] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [card.id]: e.target.value }))}
                    />
                  ) : card?.type === "manual" ? (
                    <div>
                      {card?.rubric ? (
                        <div className="mb-2 text-xs text-white/50">{card.rubric}</div>
                      ) : null}
                      <textarea
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
                        rows={6}
                        placeholder="Напиши ответ. Он уйдёт на ручную проверку."
                        value={answers[card.id] ?? ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [card.id]: e.target.value }))}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Nav buttons */}
                <div className="mt-5 flex items-center justify-between">
                  <button
                    disabled={!canPrev}
                    onClick={() => setIdx((x) => Math.max(0, x - 1))}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/8 disabled:opacity-40"
                  >
                    ← Назад
                  </button>

                  <button
                    disabled={!canNext}
                    onClick={() => setIdx((x) => Math.min(cards.length - 1, x + 1))}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/8 disabled:opacity-40"
                  >
                    Дальше →
                  </button>
                </div>
              </Card>

              {/* Finish button (bottom-right neon) */}
              {isLast ? (
                <div className="fixed bottom-6 right-6 z-40">
                  {!allAutofillOk ? (
                    <div className="mb-2 text-xs text-amber-200/80">
                      Не все ответы заполнены — но можно завершить.
                    </div>
                  ) : null}
                  <button
                    onClick={submit}
                    className="rounded-2xl px-5 py-3 text-sm font-semibold text-black
                               bg-gradient-to-r from-cyan-400 to-fuchsia-500
                               shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_28px_rgba(217,70,239,0.18)]
                               hover:opacity-95"
                  >
                    Завершить
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
