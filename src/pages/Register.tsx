import { useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../auth/AuthProvider";

export default function Register() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit() {
    try {
      setErr(null);
      const r = await register(email, password);
      setVerifyUrl(r.verifyUrl ?? null);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <AppShell title="Регистрация" subtitle="После подтверждения email сервер выдаст кошелёк и добавит в allowlist.">
      <div className="max-w-md space-y-3">
        <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
          placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
          placeholder="Пароль (мин 8 символов)" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        {err ? <div className="text-sm text-amber-200">{err}</div> : null}

        <button onClick={onSubmit}
          className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15">Создать аккаунт</button>

        {verifyUrl ? (
          <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-sm text-cyan-200">
            DEV-режим: ссылка для подтверждения:
            <div className="mt-2">
              <Link className="underline" to={verifyUrl}>{verifyUrl}</Link>
            </div>
          </div>
        ) : null}

        <div className="text-sm text-white/60">
          Уже есть аккаунт? <Link className="underline" to="/login">Войти</Link>
        </div>
      </div>
    </AppShell>
  );
}
