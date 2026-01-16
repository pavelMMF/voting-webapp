import { AppShell } from "../components/AppShell";
import { Badge, Card, ProgressBar, Stat } from "../components/ui";

export default function Profile() {
  return (
    <AppShell
      title="Профиль"
      subtitle="Идентичность, роли, вес голоса, бейджи и безопасность."
    >
      <div className="grid gap-4 md:grid-cols-12">
        <div className="md:col-span-4">
          <Card glow>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/10" />
              <div>
                <div className="text-lg font-semibold tracking-tight">
                  Andrew M.
                </div>
                <div className="text-xs text-white/60">0x19…7B • LAN member</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="live">Role: Admin</Badge>
              <Badge tone="neutral">KYC: internal</Badge>
              <Badge tone="ended">2FA: enabled</Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Stat label="Vote power" value="12.4" />
              <Stat label="Merit" value="+8" />
            </div>

            <div className="mt-4">
              <ProgressBar value={78} label="Trust score" />
            </div>
          </Card>
        </div>

        <div className="md:col-span-8 grid gap-4">
          <Card>
            <h3 className="font-semibold">Бейджи / допуски</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-white/80">S-1 Security</div>
                <div className="mt-1 text-xs text-white/60">
                  действителен • 2026
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-white/80">P-1 Protocol</div>
                <div className="mt-1 text-xs text-white/60">
                  действителен • 2026
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-white/80">V-2 Verifier</div>
                <div className="mt-1 text-xs text-white/60">
                  ограниченный доступ
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold">Безопасность</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm text-white/70">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                • Hardware key (опц.)
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                • Session signing
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                • Export audit
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold">Активность</h3>
            <div className="mt-3 space-y-3 text-xs text-white/60">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                VoteCast • #41 • hash: 0x8f…a2
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                ExamPassed • Security • badge: S-1
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
