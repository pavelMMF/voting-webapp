import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../auth/AuthProvider";

export default function VerifyEmail() {
  const { verifyEmail } = useAuth();
  const [sp] = useSearchParams();
  const token = sp.get("token") ?? "";
  const [status, setStatus] = useState("Верифицируем…");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await verifyEmail(token);
        setStatus("Email подтверждён. Кошелёк выдан, allowlist включён.");
      } catch (e: any) {
        setErr(e?.message ?? String(e));
        setStatus("Ошибка");
      }
    })();
  }, []);

  return (
    <AppShell title="Подтверждение email">
      <div className="space-y-3">
        <div className="text-white/80">{status}</div>
        {err ? <div className="text-amber-200 text-sm">{err}</div> : null}
        <Link className="underline" to="/login">Перейти к входу</Link>
      </div>
    </AppShell>
  );
}
