import { AppShell } from "../components/AppShell";
import { Badge, ButtonLink, Card, ProgressBar, Stat } from "../components/ui";

export default function Home() {
  return (
    <AppShell
      title="Пульт голосований"
      subtitle="Минимал-неон, быстрые действия, прозрачность и аудит."
    >
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-8">
          <Card glow>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge tone="live">Активное голосование</Badge>
                <h2 className="mt-3 text-xl font-semibold tracking-tight">
                  #42 — Утвердить бюджет на Q1 2026
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  Закрытие через 18ч 12м • Кворум 60% • Голос весовой (merit)
                </p>
              </div>

              <div className="flex gap-2">
                <ButtonLink to="/votes">Открыть список</ButtonLink>
                <ButtonLink to="/votes" variant="ghost">
                  Голосовать
                </ButtonLink>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Stat label="Turnout" value="47%" />
              <Stat label="Кворум" value="60%" />
              <Stat label="Snapshot" value="#18 392" />
            </div>

            <div className="mt-5">
              <ProgressBar value={47} label="Прогресс явки" />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3 text-xs text-white/60">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-white/80">Что записывается</div>
                <div className="mt-1">
                  choice + signature + snapshot + timestamp
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-white/80">Проверка</div>
                <div className="mt-1">audit log / hash / export</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-white/80">Explain</div>
                <div className="mt-1">“Объяснить вопрос” (AI)</div>
              </div>
            </div>
          </Card>
        </div>

        <div className="md:col-span-4">
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Следующие шаги</h3>
              <Badge tone="neutral">Сегодня</Badge>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li>• Подписать сессию (wallet / key)</li>
              <li>• Пройти “Security Basics” (даёт +2 merit)</li>
              <li>• Проголосовать в #42 до дедлайна</li>
            </ul>
            <div className="mt-4 flex gap-2">
              <ButtonLink to="/exams" variant="ghost">
                Экзамены
              </ButtonLink>
              <ButtonLink to="/profile" variant="ghost">
                Профиль
              </ButtonLink>
            </div>
          </Card>

          <div className="mt-4">
            <Card>
              <h3 className="font-semibold">Последние события</h3>
              <div className="mt-3 space-y-3 text-xs text-white/60">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-white/80">VoteCast • #41</div>
                  <div className="mt-1">hash: 0x8f…a2 • 12:14</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-white/80">ExamPassed • Security</div>
                  <div className="mt-1">badge: S-1 • 09:02</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-12">
        <div className="md:col-span-4">
          <Card>
            <h3 className="font-semibold">Прозрачность</h3>
            <p className="mt-2 text-sm text-white/60">
              Превью эффекта перед подтверждением + ссылка на аудит.
            </p>
          </Card>
        </div>
        <div className="md:col-span-4">
          <Card>
            <h3 className="font-semibold">Скорость</h3>
            <p className="mt-2 text-sm text-white/60">
              Никакого тяжёлого WebGL по умолчанию. Всё — CSS, быстро.
            </p>
          </Card>
        </div>
        <div className="md:col-span-4">
          <Card>
            <h3 className="font-semibold">Доступность</h3>
            <p className="mt-2 text-sm text-white/60">
              Контраст, крупные кликабельные зоны, уважение к “reduce motion”.
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}