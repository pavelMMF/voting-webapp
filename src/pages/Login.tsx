import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../auth/AuthProvider";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit() {
    try {
      setErr(null);
      await login(email, password);
      nav("/votes");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <AppShell title="Вход" subtitle="Email + пароль (custodial wallets).">
      <div className="max-w-md space-y-3">
        <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
          placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
          placeholder="Пароль" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        {err ? <div className="text-sm text-amber-200">{err}</div> : null}
        <button onClick={onSubmit}
          className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/15">Войти</button>
        <div className="text-sm text-white/60">
          Нет аккаунта? <Link className="underline" to="/register">Регистрация</Link>
        </div>
      </div>
    </AppShell>
  );
}
