// api/src/capEngine.js
// Формулы из "Система формирования суммы голосов..." :contentReference[oaicite:1]{index=1}

export const FP = 1_000_000; // fixed point 1e6

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function yearsSince(isoDate, nowMs) {
  if (!isoDate) return 0;
  const t = Date.parse(isoDate);
  if (!Number.isFinite(t)) return 0;
  const years = (nowMs - t) / (365.25 * 24 * 3600 * 1000);
  return Math.max(0, years);
}

// Политика по умолчанию (пример из документа) :contentReference[oaicite:2]{index=2}
export function defaultPolicy() {
  return {
    q: { 0: 0.25, 1: 0.15, 2: 0.25, 3: 0.35 }, // квоты
    f: { 1: 1.2, 2: 2.0, 3: 4.0 },             // нижние пороги f_k :contentReference[oaicite:3]{index=3}
    delta: { 1: 0.5, 2: 0.5, 3: 0.5 },         // доля “усыхания” δ_k :contentReference[oaicite:4]{index=4}
    T_years: 5,                                // период деградации T :contentReference[oaicite:5]{index=5}
    eduPoolFrac: 0.05,                          // P_edu 5% :contentReference[oaicite:6]{index=6}
  };
}

function userLevelForTopic(user, topicId) {
  // ожидаем структуру:
  // user.levels = { "1": { level: 2, confirmedAt: "2025-01-01T00:00:00Z" }, ... }
  const rec = user?.levels?.[String(topicId)];
  const level = Number(rec?.level ?? 0);
  const confirmedAt = rec?.confirmedAt ?? null;
  return { level: [1,2,3].includes(level) ? level : 0, confirmedAt };
}

function eduScore(user) {
  // s_i ∈ [-1,1], берем положительные только (как в документе) :contentReference[oaicite:7]{index=7}
  const s = Number(user?.eduScore ?? 0);
  if (!Number.isFinite(s)) return 0;
  return Math.max(0, Math.min(1, s));
}

// Главная функция: возвращает map address -> weight (в “человеческих” единицах, w0=1)
export function computeCaps(users, topicId, policy, nowMs) {
  // группируем по level
  const groups = { 0: [], 1: [], 2: [], 3: [] };
  for (const u of users) {
    if (!u.verified || !u.walletAddress) continue;
    const { level } = userLevelForTopic(u, topicId);
    groups[level].push(u);
  }

  const N0 = groups[0].length;
  const N1 = groups[1].length;
  const N2 = groups[2].length;
  const N3 = groups[3].length;

  const q = policy.q;
  const f = policy.f;

  // S = N0/q0 :contentReference[oaicite:8]{index=8}
  const S = (q[0] > 0 && N0 > 0) ? (N0 / q[0]) : 0;

  // T_k = S*q_k :contentReference[oaicite:9]{index=9}
  const T = { 0: S*q[0], 1: S*q[1], 2: S*q[2], 3: S*q[3] };

  // базовый вес внутри группы k :contentReference[oaicite:10]{index=10}
  const wBase = { 0: 1.0, 1: f[1], 2: f[2], 3: f[3] };

  for (const k of [1,2,3]) {
    const Nk = groups[k].length;
    if (Nk <= 0) { wBase[k] = f[k]; continue; }
    const Fk = Nk * f[k]; // F_k = N_k * f_k :contentReference[oaicite:11]{index=11}
    if (Fk <= T[k]) {
      wBase[k] = f[k] + (T[k] - Fk) / Nk; // f + (T-F)/N :contentReference[oaicite:12]{index=12}
    } else {
      wBase[k] = f[k];
    }
  }

  // деградация + сумма без edu
  const noEdu = new Map();
  let sumNoEdu = 0;

  for (const k of [0,1,2,3]) {
    for (const u of groups[k]) {
      const addr = u.walletAddress;
      let w = wBase[k];

      if (k > 0) {
        const { confirmedAt } = userLevelForTopic(u, topicId);
        const tYears = yearsSince(confirmedAt, nowMs);

        const delta = clamp01(policy.delta[k] ?? 0.5);
        const Tyears = Math.max(0.1, Number(policy.T_years ?? 5));

        const decay = Math.pow(1 - delta, tYears / Tyears);               // (1-δ)^(t/T) :contentReference[oaicite:13]{index=13}
        const dMin = (f[k] / wBase[k]);                                    // f_k / w_base чтобы не упасть ниже f_k :contentReference[oaicite:14]{index=14}
        const d = Math.max(dMin, decay);

        w = wBase[k] * d;
      }

      noEdu.set(addr, w);
      sumNoEdu += w;
    }
  }

  // образовательный бонус (пул P_edu) :contentReference[oaicite:15]{index=15}
  const eduPool = sumNoEdu * clamp01(policy.eduPoolFrac ?? 0.05);
  let sumPos = 0;
  const sPos = new Map();
  for (const u of users) {
    if (!u.verified || !u.walletAddress) continue;
    const sp = eduScore(u);
    sPos.set(u.walletAddress, sp);
    sumPos += sp;
  }

  const out = new Map();
  for (const [addr, w] of noEdu.entries()) {
    const bonus = (sumPos > 0) ? (eduPool * (sPos.get(addr) ?? 0) / sumPos) : 0;
    out.set(addr, w + bonus);
  }

  return { wBase, out };
}
