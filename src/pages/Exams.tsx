import { AppShell } from "../components/AppShell";
import { Badge, ButtonLink, Card, ProgressBar } from "../components/ui";

const exams = [
  {
    id: "SEC-101",
    title: "Security Basics",
    minutes: 12,
    questions: 10,
    pass: 80,
    progress: 40,
    reward: "+2 merit",
  },
  {
    id: "GOV-201",
    title: "Voting Protocol & Rules",
    minutes: 18,
    questions: 14,
    pass: 75,
    progress: 0,
    reward: "доступ к весовому голосу",
  },
  {
    id: "AUD-301",
    title: "Audit & Verification",
    minutes: 15,
    questions: 12,
    pass: 85,
    progress: 0,
    reward: "роль verifier (огранич.)",
  },
];

export default function Exams() {
  return (
    <AppShell
      title="Экзамены"
      subtitle="Короткие тесты: повышают доверие, дают бейджи и (опционально) вес голоса."
    >
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-8 grid gap-4">
          {exams.map((e) => (
            <Card key={e.id} glow={e.progress > 0 && e.progress < 100}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Badge tone={e.progress === 0 ? "neutral" : "live"}>
                    {e.progress === 0 ? "Доступен" : "В процессе"}
                  </Badge>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight">
                    {e.id} — {e.title}
                  </h3>
                  <p className="mt-1 text-sm text-white/60">
                    {e.questions} вопросов • {e.minutes} минут • проходной{" "}
                    {e.pass}%
                  </p>
                </div>

                <div className="flex gap-2">
                  <ButtonLink to="/exams" variant="ghost">
                    Детали
                  </ButtonLink>
                  <ButtonLink to="/exams">
                    {e.progress > 0 ? "Продолжить" : "Начать"}
                  </ButtonLink>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <ProgressBar value={e.progress} label="Прогресс" />
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/60">
                  <div className="text-white/80">Награда</div>
                  <div className="mt-1">{e.reward}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="md:col-span-4">
          <Card>
            <h3 className="font-semibold">Почему экзамены здесь</h3>
            <p className="mt-2 text-sm text-white/60">
              Чтобы пользователь понимал правила и последствия действий, а
              система могла честно раздавать допуски/веса без магии.
            </p>
            <div className="mt-4 space-y-3 text-xs text-white/60">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                • Превью эффекта перед подтверждением
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                • Прозрачные правила доступа к типам голосований
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                • Проверяемость (audit / hash)
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
