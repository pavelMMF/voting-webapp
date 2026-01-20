import { useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { Card, ButtonLink, Badge } from "../components/ui";

export default function Exams() {
  const [exams, setExams] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const r = await fetch("/api/exams", { credentials: "include" }).then(async (res) => {
      const t = await res.text();
      if (!res.ok) throw new Error(t || `HTTP ${res.status}`);
      return JSON.parse(t);
    });
    setExams(r.exams ?? []);
  }

  useEffect(() => {
    load().catch((e) => setErr(String(e)));
  }, []);

  return (
    <AppShell title="Экзамены" subtitle="Экзамены по темам. 80%+ — уровень 1. Manual карточки уходят на ревью.">
      {err ? <div className="mb-4 text-amber-200 text-sm">{err}</div> : null}

      <div className="grid gap-4">
        {exams.map((e) => (
          <Card key={e.id} glow={e.userLevel >= 1}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge tone={e.userLevel >= 1 ? "live" : "neutral"}>
                  {e.userLevel >= 1 ? `Уровень ${e.userLevel}` : "Не пройден"}
                </Badge>
                <div className="mt-2 text-lg font-semibold">{e.title}</div>
                <div className="mt-1 text-sm text-white/60">
                  TopicId: {e.topicId} • карточек: {e.cardsCount} • проходной: {e.passPercent}%
                </div>
              </div>

              <ButtonLink to={`/exams/${e.id}`}>
                {e.userLevel >= 1 ? "Пройти ещё раз" : "Начать"}
              </ButtonLink>
            </div>
          </Card>
        ))}

        {exams.length === 0 ? (
          <Card>
            <div className="text-sm text-white/60">
              Экзаменов пока нет (или backend не отдаёт /api/exams).
            </div>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
