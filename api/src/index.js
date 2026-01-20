// C:\dev\voting-webapp\api\src\index.js
import "dotenv/config";
import cors from "cors";
import express from "express";
import session from "express-session";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

import { computeCaps, defaultPolicy, FP } from "./capEngine.js";

const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

app.use(
  session({
    name: "voting.sid",
    secret: process.env.SESSION_SECRET ?? "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, sameSite: "lax" },
  })
);

/* ===================== CONFIG ===================== */
const CFG = {
  PORT: Number(process.env.PORT ?? 3001),
  RPC_URL: (process.env.RPC_URL ?? "http://127.0.0.1:8545").trim(),
  CHAIN_ID: Number(process.env.CHAIN_ID ?? 1337),

  ADMIN_PRIVATE_KEY: (process.env.ADMIN_PRIVATE_KEY ?? "").trim(),

  GOVTOKEN_ADDRESS: (process.env.GOVTOKEN_ADDRESS ?? "").trim(),
  ORACLE_ADDRESS: (process.env.ORACLE_ADDRESS ?? "").trim(),
  GOVERNOR_ADDRESS: (process.env.GOVERNOR_ADDRESS ?? "").trim(),
  COUNTER_ADDRESS: (process.env.COUNTER_ADDRESS ?? "").trim(),

  ENCRYPTION_SECRET: (process.env.ENCRYPTION_SECRET ?? "").trim(),
  DEV_EXPOSE_EMAIL_TOKEN: process.env.DEV_EXPOSE_EMAIL_TOKEN === "1",

  EXPLORER_BASE_URL: (process.env.EXPLORER_BASE_URL ?? "").trim(),
  GOVTOKEN_FAUCET_AMOUNT: (process.env.GOVTOKEN_FAUCET_AMOUNT ?? "").trim(),

  // темы, которым пушим cap на onboarding (через запятую)
  DEFAULT_CAP_TOPICS: (process.env.DEFAULT_CAP_TOPICS ?? "0,1").trim(),
};

if (!CFG.ENCRYPTION_SECRET) throw new Error("Missing ENCRYPTION_SECRET");

/* ===================== DB (JSON) ===================== */
const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

function initDbFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify(
        {
          users: [],
          proposals: [],
          topics: [],
          exams: [],
          examAttempts: [],
        },
        null,
        2
      ),
      "utf8"
    );
  }
}
initDbFile();

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}
function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function ensureDbShapeAndSeed() {
  const db = readDb();
  db.users = db.users ?? [];
  db.proposals = db.proposals ?? [];
  db.topics = db.topics ?? [];
  db.exams = db.exams ?? [];
  db.examAttempts = db.examAttempts ?? [];

  // ===== seed topic #1: Website development (квоты как ты сказал) =====
  if (!db.topics.find((t) => Number(t.id) === 1)) {
    db.topics.push({
      id: 1,
      name: "Website development",
      // policy (квоты и прочее)
      policy: {
        q: { 0: 0.10, 1: 0.15, 2: 0.20, 3: 0.55 }, // квоты по группам
        f: { 1: 1.2, 2: 2.0, 3: 4.0 },
        delta: { 1: 0.5, 2: 0.5, 3: 0.5 },
        T_years: 5,
        eduPoolFrac: 0.05,
      },
      createdAt: new Date().toISOString(),
    });
  }

  // ===== seed exam для topicId=1 =====
  // Карточки (cards) могут быть:
  // - choice: выбрать вариант
  // - text: ввести строку (сравнение по нормализованной строке)
  // - manual: ответ уходит на ручную проверку
  if (!db.exams.find((e) => e.id === "webdev-l1")) {
    db.exams.push({
      id: "webdev-l1",
      topicId: 1,
      title: "Website development — Level 1",
      passPercent: 80,
      levelOnPass: 1,
      // UI style can be unified, backend хранит контент
      cards: [
        {
          id: "c1",
          type: "choice",
          title: "HTTP",
          text: "Что такое HTTP?",
          media: [],
          options: ["Язык программирования", "Протокол передачи данных", "База данных", "ОС"],
          correct: 1,
          points: 1,
        },
        {
          id: "c2",
          type: "choice",
          title: "GET vs POST",
          text: "Какая разница между GET и POST?",
          media: [],
          options: ["POST быстрее", "GET обычно для чтения, POST для отправки данных", "Разницы нет", "GET только в мобильных"],
          correct: 1,
          points: 1,
        },
        {
          id: "c3",
          type: "text",
          title: "DNS",
          text: "Введи коротко: что делает DNS?",
          media: [],
          accepted: ["переводит домен в ip", "разрешает домен в ip", "сопоставляет домен и ip", "перевод домена в ip"],
          points: 1,
        },
        {
          id: "c4",
          type: "manual",
          title: "Архитектура",
          text: "Опиши своими словами, как бы ты организовал(а) структуру фронтенда и API для небольшой системы голосований.",
          media: [],
          rubric: "Оцени: ясность, безопасность, разделение ответственности. (Ручная проверка админом)",
          points: 1,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  writeDb(db);
}
ensureDbShapeAndSeed();

/* ===================== DB helpers ===================== */
function getUserByEmail(email) {
  const db = readDb();
  return db.users.find((u) => u.email === email) ?? null;
}
function getUserById(id) {
  const db = readDb();
  return db.users.find((u) => u.id === id) ?? null;
}
function getUserByVerifyToken(token) {
  const db = readDb();
  return db.users.find((u) => u.verifyToken === token) ?? null;
}
function saveUser(user) {
  const db = readDb();
  const idx = db.users.findIndex((u) => u.id === user.id);
  if (idx >= 0) db.users[idx] = user;
  else db.users.push(user);
  writeDb(db);
}

function listProposalsDb() {
  const db = readDb();
  return db.proposals ?? [];
}

async function ensureEth(address, minEth = "0.02") {
  if (!admin) throw new Error("NO_ADMIN_KEY");
  const bal = await provider.getBalance(address);
  const min = ethers.parseEther(minEth);
  if (bal >= min) return false;

  const tx = await admin.sendTransaction({
    to: address,
    value: min - bal,
  });
  await tx.wait();
  return true;
}

function saveProposalDb(p) {
  const db = readDb();
  db.proposals = db.proposals ?? [];
  const idx = db.proposals.findIndex((x) => String(x.proposalId) === String(p.proposalId));
  if (idx >= 0) db.proposals[idx] = p;
  else db.proposals.push(p);
  writeDb(db);
}

function getTopicById(topicId) {
  const db = readDb();
  return (db.topics ?? []).find((t) => Number(t.id) === Number(topicId)) ?? null;
}

function listExams() {
  const db = readDb();
  return db.exams ?? [];
}
function getExamById(id) {
  const db = readDb();
  return (db.exams ?? []).find((e) => e.id === id) ?? null;
}
function saveExam(exam) {
  const db = readDb();
  db.exams = db.exams ?? [];
  const idx = db.exams.findIndex((e) => e.id === exam.id);
  if (idx >= 0) db.exams[idx] = exam;
  else db.exams.push(exam);
  writeDb(db);
}

function saveExamAttempt(attempt) {
  const db = readDb();
  db.examAttempts = db.examAttempts ?? [];
  const idx = db.examAttempts.findIndex((a) => a.id === attempt.id);
  if (idx >= 0) db.examAttempts[idx] = attempt;
  else db.examAttempts.push(attempt);
  writeDb(db);
}

function listPendingManualAttempts() {
  const db = readDb();
  return (db.examAttempts ?? []).filter((a) => a.status === "pending_manual");
}

function getAttemptById(id) {
  const db = readDb();
  return (db.examAttempts ?? []).find((a) => a.id === id) ?? null;
}

/* ===================== crypto (AES-256-GCM) ===================== */
function keyFromSecret(secret) {
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}
function encryptText(plain) {
  const key = keyFromSecret(CFG.ENCRYPTION_SECRET);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}
function decryptText(b64) {
  const raw = Buffer.from(b64, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const key = keyFromSecret(CFG.ENCRYPTION_SECRET);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

/* ===================== chain ===================== */
const provider = new ethers.JsonRpcProvider(CFG.RPC_URL, CFG.CHAIN_ID);
const admin = CFG.ADMIN_PRIVATE_KEY ? new ethers.Wallet(CFG.ADMIN_PRIVATE_KEY, provider) : null;

function asAddress(label, v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (ethers.isAddress(s)) return s;
  console.warn(`[CONFIG] ${label} is not a valid address, ignoring: ${s}`);
  return "";
}

const GovTokenABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function delegate(address delegatee)",
  "function getPastVotes(address account, uint256 timepoint) view returns (uint256)",
  "function getVotes(address account) view returns (uint256)",
];

const MeritOracleABI = [
  "function currentDay() view returns (uint48)",
  "function weightAtTopic(address voter, uint256 timepointTimestamp, uint32 topicId) view returns (uint256)",
  "function weightOfTopic(address voter, uint48 day, uint32 topicId) view returns (uint256)",
  "function pushDailyTopicWeights(uint48 day, uint32 topicId, address[] voters, uint192[] weights, bytes32 contextHash)",

  // AccessControl
  "function WEIGHT_SETTER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function grantRole(bytes32 role, address account)",
];

const MeritGovernorABI = [
  "function proposeWithTopic(uint32 topicId, address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)",
  "function proposalTopic(uint256 proposalId) view returns (uint32)",
  "function state(uint256 proposalId) view returns (uint8)",
  "function proposalSnapshot(uint256 proposalId) view returns (uint256)",
  "function proposalDeadline(uint256 proposalId) view returns (uint256)",
  "function proposalVotes(uint256 proposalId) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)",
  "function hasVoted(uint256 proposalId, address voter) view returns (bool)",
  "function voteReceipt(uint256 proposalId, address voter) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)",
  "function castVote(uint256 proposalId, uint8 support) returns (uint256 usedWeight)",
  "function castVoteWithReasonAndParams(uint256 proposalId, uint8 support, string reason, bytes params) returns (uint256 usedWeight)",

  // hard allowlist
  "function allowed(address) view returns (bool)",
  "function setAllowed(address account, bool isAllowed)",
];

const CounterIface = new ethers.Interface(["function incBy(uint256)"]);

function getContractsOrThrow() {
  const govTokenAddr = asAddress("GOVTOKEN_ADDRESS", CFG.GOVTOKEN_ADDRESS);
  const oracleAddr = asAddress("ORACLE_ADDRESS", CFG.ORACLE_ADDRESS);
  const governorAddr = asAddress("GOVERNOR_ADDRESS", CFG.GOVERNOR_ADDRESS);

  if (!govTokenAddr || !oracleAddr || !governorAddr) {
    throw new Error("Contracts not configured. Check api/.env addresses.");
  }

  const govToken = new ethers.Contract(govTokenAddr, GovTokenABI, provider);
  const oracle = new ethers.Contract(oracleAddr, MeritOracleABI, provider);
  const governor = new ethers.Contract(governorAddr, MeritGovernorABI, provider);

  const counterAddr = asAddress("COUNTER_ADDRESS", CFG.COUNTER_ADDRESS);

  return { govToken, oracle, governor, counterAddr };
}

async function ensureEth(address, minEth = "0.02") {
  if (!admin) throw new Error("NO_ADMIN_KEY");
  const bal = await provider.getBalance(address);
  const min = ethers.parseEther(minEth);
  if (bal >= min) return false;

  const tx = await admin.sendTransaction({
    to: address,
    value: min - bal,
  });
  await tx.wait();
  return true;
}

async function fundUser(address, ethAmount = "0.05") {
  if (!admin) return null;
  const tx = await admin.sendTransaction({ to: address, value: ethers.parseEther(ethAmount) });
  await tx.wait();
  return tx.hash;
}

async function faucetGovToken(address) {
  if (!admin) return null;
  if (!CFG.GOVTOKEN_FAUCET_AMOUNT) return null;

  const { govToken } = getContractsOrThrow();
  const dec = Number(await govToken.decimals());
  const amount = ethers.parseUnits(CFG.GOVTOKEN_FAUCET_AMOUNT, dec);

  const tx = await govToken.connect(admin).transfer(address, amount);
  await tx.wait();
  return tx.hash;
}

async function delegateSelf(userWallet) {
  const { govToken } = getContractsOrThrow();
  const tx = await govToken.connect(userWallet).delegate(await userWallet.getAddress());
  await tx.wait();
  return tx.hash;
}

async function latestTimestamp() {
  const b = await provider.getBlock("latest");
  return BigInt(b.timestamp);
}

/* ---------- allowlist in MeritGovernor ---------- */
async function ensureGovernorAllowed(address) {
  if (!admin) throw new Error("NO_ADMIN_KEY");
  const { governor } = getContractsOrThrow();
  const ok = await governor.allowed(address);
  if (ok) return false;
  await (await governor.connect(admin).setAllowed(address, true)).wait();
  return true;
}

/* ---------- oracle role ---------- */
async function ensureOracleWeightSetter() {
  if (!admin) throw new Error("NO_ADMIN_KEY");
  const { oracle } = getContractsOrThrow();
  const role = await oracle.WEIGHT_SETTER_ROLE();
  const adminAddr = await admin.getAddress();

  const ok = await oracle.hasRole(role, adminAddr);
  if (ok) return false;

  await (await oracle.connect(admin).grantRole(role, adminAddr)).wait();
  return true;
}

function policyForTopic(topicId) {
  const t = getTopicById(topicId);
  if (t?.policy) return t.policy;
  return defaultPolicy();
}

async function pushTodayCaps(topicId, { force = false } = {}) {
  if (!admin) throw new Error("NO_ADMIN_KEY");
  const { oracle, govToken } = getContractsOrThrow();

  await ensureOracleWeightSetter();

  const day = await oracle.currentDay();

  const db = readDb();
  const users = (db.users ?? []).filter((u) => u.verified && u.walletAddress);

  const policy = policyForTopic(topicId);
  const nowMs = Date.now();
  const { out } = computeCaps(users, topicId, policy, nowMs);

  let dec = 18;
  try { dec = Number(await govToken.decimals()); } catch {}
  const tokenScale = 10n ** BigInt(dec);

  const voters = [];
  const caps = [];

  for (const u of users) {
    const addr = u.walletAddress;

    if (!force) {
      let existing = 0n;
      try { existing = BigInt(await oracle.weightOfTopic(addr, day, topicId)); } catch {}
      if (existing > 0n) continue;
    }

    const w = out.get(addr) ?? 1.0;
    const wFp = BigInt(Math.round(w * FP));
    const capUnits = (wFp * tokenScale) / BigInt(FP);

    const MAX_UINT192 = (1n << 192n) - 1n;
    if (capUnits > MAX_UINT192) throw new Error("CAP_TOO_LARGE_UINT192");

    voters.push(addr);
    caps.push(capUnits);
  }

  if (voters.length === 0) return { pushed: 0, day: Number(day) };

  const ctx = ethers.keccak256(
    ethers.toUtf8Bytes(`cap:v1 topic:${topicId} day:${day.toString()} ts:${Date.now()}`)
  );

  await (await oracle.connect(admin).pushDailyTopicWeights(day, topicId, voters, caps, ctx)).wait();
  return { pushed: voters.length, day: Number(day), contextHash: ctx };
}

async function previewVotePower(proposalId, voterAddress) {
  const { govToken, oracle, governor } = getContractsOrThrow();
  const pid = BigInt(proposalId);

  const topicId = await governor.proposalTopic(pid);
  const snap = await governor.proposalSnapshot(pid);
  const timepoint = BigInt(snap) - 1n;

  const baseVotes = await govToken.getPastVotes(voterAddress, timepoint);

  const ts = await latestTimestamp();
  const cap = await oracle.weightAtTopic(voterAddress, ts, topicId);

  const effective = baseVotes < cap ? baseVotes : cap;

  return {
    topicId: Number(topicId),
    snapshotBlock: Number(snap),
    baseVotes: baseVotes.toString(),
    cap: cap.toString(),
    effective: effective.toString(),
  };
}

async function proposalDetails(proposalId) {
  const { governor } = getContractsOrThrow();
  const pid = BigInt(proposalId);

  const topicId = await governor.proposalTopic(pid);
  const state = await governor.state(pid);
  const snapshot = await governor.proposalSnapshot(pid);
  const deadline = await governor.proposalDeadline(pid);
  const votes = await governor.proposalVotes(pid);

  return {
    proposalId: String(proposalId),
    topicId: Number(topicId),
    state: Number(state),
    snapshotBlock: Number(snapshot),
    deadlineBlock: Number(deadline),
    votes: {
      against: votes[0].toString(),
      for: votes[1].toString(),
      abstain: votes[2].toString(),
    },
  };
}

async function voteReceipt(proposalId, voter) {
  const { governor } = getContractsOrThrow();
  const pid = BigInt(proposalId);
  try {
    const r = await governor.voteReceipt(pid, voter);
    return { against: r[0].toString(), for: r[1].toString(), abstain: r[2].toString() };
  } catch {
    return null;
  }
}

/* ===================== auth helpers ===================== */
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: "UNAUTH" });
  const user = getUserById(req.session.userId);
  if (!user) return res.status(401).json({ ok: false, error: "UNAUTH" });
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  next();
}

function isEmail(s) { return typeof s === "string" && s.includes("@") && s.length <= 200; }
function makeId() { return crypto.randomBytes(16).toString("hex"); }
function makeToken() { return crypto.randomBytes(32).toString("hex"); }

/* ===================== AUTH ===================== */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!isEmail(email) || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ ok: false, error: "INVALID_INPUT" });
    }
    if (getUserByEmail(email)) {
      return res.status(409).json({ ok: false, error: "EMAIL_EXISTS" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verifyToken = makeToken();

    const user = {
      id: makeId(),
      email,
      passwordHash,
      verified: false,
      verifyToken,
      role: "user",
      walletAddress: null,
      encryptedPrivateKey: null,

      // экспертиза по темам
      levels: {},     // { "topicId": { level, confirmedAt } }
      eduScore: 0,    // 0..1 (пока)

      createdAt: new Date().toISOString(),
    };

    saveUser(user);

    const verifyUrl = `/verify-email?token=${verifyToken}`;
    console.log(`[DEV] verify email for ${email}: ${verifyUrl}`);

    return res.json({ ok: true, ...(CFG.DEV_EXPOSE_EMAIL_TOKEN ? { verifyUrl } : {}) });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.post("/api/auth/verify-email", async (req, res) => {
  try {
    const { token } = req.body ?? {};
    if (typeof token !== "string" || token.length < 10) {
      return res.status(400).json({ ok: false, error: "INVALID_TOKEN" });
    }

    const user = getUserByVerifyToken(token);
    if (!user) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    if (!user.verified) {
      user.verified = true;
      user.verifyToken = null;

      // создаём кошелек
      const wallet = ethers.Wallet.createRandom();
      const pk = wallet.privateKey;
      const userWallet = new ethers.Wallet(pk, provider);
      const addr = await userWallet.getAddress();

      user.walletAddress = addr;
      user.encryptedPrivateKey = encryptText(pk);
      saveUser(user);

      // газ
      try { await fundUser(addr, "0.05"); } catch (e) { console.warn("fundUser failed:", e?.message ?? e); }

      // allowlist в governor
      try { await ensureGovernorAllowed(addr); } catch (e) { console.warn("setAllowed(user) failed:", e?.message ?? e); }

      // выдача токена + delegate для baseVotes ДО propose
      try { await faucetGovToken(addr); } catch (e) { console.warn("faucetGovToken failed:", e?.message ?? e); }
      try { await delegateSelf(userWallet); } catch (e) { console.warn("delegateSelf failed:", e?.message ?? e); }

      // пушим caps на дефолтные темы
      const topics = CFG.DEFAULT_CAP_TOPICS
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isFinite(x));

      for (const t of topics) {
        try { await pushTodayCaps(t, { force: false }); } catch (e) { console.warn("push caps failed:", e?.message ?? e); }
      }
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const user = getUserByEmail(email);
    if (!user) return res.status(401).json({ ok: false, error: "BAD_CREDENTIALS" });

    const ok = await bcrypt.compare(String(password ?? ""), user.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: "BAD_CREDENTIALS" });
    if (!user.verified) return res.status(403).json({ ok: false, error: "EMAIL_NOT_VERIFIED" });

    req.session.userId = user.id;
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ ok: false });
  const user = getUserById(req.session.userId);
  if (!user) return res.status(401).json({ ok: false });

  return res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      walletAddress: user.walletAddress,
      levels: user.levels ?? {},
      eduScore: user.eduScore ?? 0,
    },
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ===================== PROFILE =====================
app.get("/api/profile/overview", requireAuth, async (req, res) => {
  try {
    const db = readDb();
    const topics = db.topics ?? [];
    const proposals = db.proposals ?? [];

    const addr = req.user.walletAddress;
    if (!addr) return res.status(400).json({ ok: false, error: "NO_WALLET" });

    const { govToken, oracle, governor } = getContractsOrThrow();

    // baseNow: текущие делегированные голоса
    const baseNow = await govToken.getVotes(addr);

    const ts = await latestTimestamp();

    const topicWeights = [];
    for (const t of topics) {
      const topicId = Number(t.id);
      const capNow = await oracle.weightAtTopic(addr, ts, topicId);
      const effectiveNow = baseNow < capNow ? baseNow : capNow;

      topicWeights.push({
        topicId,
        name: t.name,
        capNow: capNow.toString(),
        baseNow: baseNow.toString(),
        effectiveNow: effectiveNow.toString(),
      });
    }

    const voted = [];
    for (const p of proposals) {
      const pid = BigInt(p.proposalId);
      const hv = await governor.hasVoted(pid, addr).catch(() => false);
      if (!hv) continue;

      const receipt = await governor.voteReceipt(pid, addr).catch(() => null);
      voted.push({
        proposalId: String(p.proposalId),
        topicId: Number(p.topicId ?? 0),
        title: p.title ?? "",
        votedAt: p.createdAt ?? null,
        receipt: receipt
          ? {
              against: receipt[0].toString(),
              for: receipt[1].toString(),
              abstain: receipt[2].toString(),
            }
          : null,
      });
    }

    res.json({ ok: true, topicWeights, voted });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e?.shortMessage || e?.reason || e?.message || String(e),
    });
  }
});

/* ===================== TOPICS ===================== */
app.get("/api/topics", requireAuth, (req, res) => {
  const db = readDb();
  res.json({ ok: true, topics: db.topics ?? [] });
});

/* ===================== EXAMS (user) ===================== */
app.get("/api/exams", requireAuth, (req, res) => {
  const db = readDb();
  const out = (db.exams ?? []).map((e) => {
    const level = Number(req.user?.levels?.[String(e.topicId)]?.level ?? 0);
    return {
      id: e.id,
      topicId: e.topicId,
      title: e.title,
      passPercent: e.passPercent,
      levelOnPass: e.levelOnPass,
      cardsCount: (e.cards ?? []).length,
      userLevel: level,
    };
  });
  res.json({ ok: true, exams: out });
});

app.get("/api/exams/:id", requireAuth, (req, res) => {
  const ex = getExamById(req.params.id);
  if (!ex) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  // отдаём cards без правильных ответов
  const cards = (ex.cards ?? []).map((c) => {
    const base = {
      id: c.id,
      type: c.type,
      title: c.title ?? "",
      text: c.text ?? "",
      media: c.media ?? [],
    };
    if (c.type === "choice") {
      return { ...base, options: c.options ?? [] };
    }
    if (c.type === "text") {
      return { ...base, placeholder: c.placeholder ?? "Введите ответ" };
    }
    // manual
    return { ...base, rubric: c.rubric ?? "" };
  });

  res.json({
    ok: true,
    exam: {
      id: ex.id,
      topicId: ex.topicId,
      title: ex.title,
      passPercent: ex.passPercent,
      levelOnPass: ex.levelOnPass,
      cards,
    },
  });
});

function normalizeText(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

app.post("/api/exams/:id/submit", requireAuth, async (req, res) => {
  try {
    const ex = getExamById(req.params.id);
    if (!ex) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const answers = req.body?.answers ?? {}; // { cardId: value }
    const cards = ex.cards ?? [];

    let autoCorrect = 0;
    let autoTotal = 0;

    let hasManual = false;
    const manualCards = [];

    // собираем оценку
    for (const c of cards) {
      if (c.type === "choice") {
        autoTotal += (c.points ?? 1);
        const got = Number(answers[c.id]);
        const ok = Number.isFinite(got) && got === Number(c.correct);
        if (ok) autoCorrect += (c.points ?? 1);
      } else if (c.type === "text") {
        autoTotal += (c.points ?? 1);
        const got = normalizeText(answers[c.id]);
        const accepted = (c.accepted ?? []).map(normalizeText);
        const ok = got && accepted.includes(got);
        if (ok) autoCorrect += (c.points ?? 1);
      } else if (c.type === "manual") {
        hasManual = true;
        manualCards.push(c);
      }
    }

    // процентовка: manual пока не учитываем (будет после review)
    const percentAuto = autoTotal > 0 ? Math.round((autoCorrect / autoTotal) * 100) : 0;

    const attempt = {
      id: crypto.randomBytes(16).toString("hex"),
      userId: req.user.id,
      examId: ex.id,
      topicId: ex.topicId,
      submittedAt: new Date().toISOString(),
      status: hasManual ? "pending_manual" : "graded",
      auto: { correct: autoCorrect, total: autoTotal, percent: percentAuto },
      manual: hasManual ? { cards: manualCards.map((c) => ({ id: c.id, points: c.points ?? 1 })), decisions: {} } : null,
      answers,
      passed: false,
      finalPercent: null,
      assignedLevel: null,
    };

    // если manual нет — считаем финал сразу
    if (!hasManual) {
      attempt.finalPercent = percentAuto;
      attempt.passed = percentAuto >= Number(ex.passPercent ?? 80);

      if (attempt.passed) {
        const topicKey = String(ex.topicId);
        req.user.levels = req.user.levels ?? {};
        const prev = Number(req.user.levels[topicKey]?.level ?? 0);
        const next = Math.max(prev, Number(ex.levelOnPass ?? 1));

        if (next !== prev) {
          req.user.levels[topicKey] = { level: next, confirmedAt: new Date().toISOString() };
          attempt.assignedLevel = next;
          saveUser(req.user);

          // квоты зависят от состава групп -> force=true
          await pushTodayCaps(Number(ex.topicId), { force: true }).catch(() => {});
        } else {
          saveUser(req.user);
        }
      } else {
        saveUser(req.user);
      }
    } else {
      // manual → пока просто сохраняем попытку и ждём ревью
      saveUser(req.user);
    }

    saveExamAttempt(attempt);

    return res.json({
      ok: true,
      status: attempt.status,
      autoPercent: percentAuto,
      passed: attempt.passed,
      assignedLevel: attempt.assignedLevel,
      message: hasManual
        ? "Ответы отправлены. Требуется ручная проверка админом."
        : (attempt.passed ? "Экзамен сдан." : "Экзамен не сдан."),
    });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

/* ===================== ADMIN PANEL API ===================== */
// 1) Users list + manual expert level override
app.get("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
  const db = readDb();
  const out = (db.users ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    verified: u.verified,
    role: u.role,
    walletAddress: u.walletAddress,
    levels: u.levels ?? {},
    eduScore: u.eduScore ?? 0,
    createdAt: u.createdAt,
  }));
  res.json({ ok: true, users: out });
});


// 1b) Bootstrap user: give tokens + ensure ETH for gas + delegate (admin action)
app.post("/api/admin/users/:id/bootstrap", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = getUserById(req.params.id);
    if (!user || !user.walletAddress || !user.encryptedPrivateKey) {
      return res.status(404).json({ ok: false, error: "USER_NO_WALLET" });
    }
    if (!admin) return res.status(500).json({ ok: false, error: "NO_ADMIN_KEY" });

    const { govToken } = getContractsOrThrow();

    const adminAddr = await admin.getAddress();
    const userAddr = user.walletAddress;

    // balances (ETH) - for diagnostics
    const adminEth = await provider.getBalance(adminAddr);
    const userEthBefore = await provider.getBalance(userAddr);

    // if admin has no ETH, we can't top-up users nor pay gas for transfers
    if (adminEth === 0n) {
      return res.status(400).json({
        ok: false,
        error: "ADMIN_NO_ETH_FOR_GAS",
        admin: adminAddr,
      });
    }

    // (optional but useful) ensure governor allowlist for this user
    try {
      await ensureGovernorAllowed(userAddr);
    } catch (e) {
      return res.status(400).json({
        ok: false,
        step: "allowlist",
        error: e?.shortMessage || e?.reason || e?.message || String(e),
        user: userAddr,
      });
    }

    // 1) transfer GOV tokens from admin (if faucet amount is set)
    let tokenTxHash = null;
    if (CFG.GOVTOKEN_FAUCET_AMOUNT) {
      try {
        const dec = Number(await govToken.decimals());
        const amount = ethers.parseUnits(CFG.GOVTOKEN_FAUCET_AMOUNT, dec);
        const tx = await govToken.connect(admin).transfer(userAddr, amount);
        await tx.wait();
        tokenTxHash = tx.hash;
      } catch (e) {
        return res.status(400).json({
          ok: false,
          step: "transfer",
          error: e?.shortMessage || e?.reason || e?.message || String(e),
          admin: adminAddr,
          user: userAddr,
        });
      }
    }

    // 2) ensure user has ETH for gas (so delegate won't fail)
    let toppedUp = false;
    try {
      toppedUp = await ensureEth(userAddr, "0.02"); // will send exactly (min - current) if needed
    } catch (e) {
      return res.status(400).json({
        ok: false,
        step: "ensureEth",
        error: e?.shortMessage || e?.reason || e?.message || String(e),
        admin: adminAddr,
        user: userAddr,
      });
    }

    // 3) delegate self from user wallet
    let delegateTxHash = null;
    try {
      const pk = decryptText(user.encryptedPrivateKey);
      const userWallet = new ethers.Wallet(pk, provider);

      const tx = await govToken.connect(userWallet).delegate(userAddr);
      await tx.wait();
      delegateTxHash = tx.hash;
    } catch (e) {
      return res.status(400).json({
        ok: false,
        step: "delegate",
        error: e?.shortMessage || e?.reason || e?.message || String(e),
        user: userAddr,
      });
    }

    // balances after (ETH) - for diagnostics
    const userEthAfter = await provider.getBalance(userAddr);

    return res.json({
      ok: true,
      user: { id: user.id, walletAddress: userAddr, email: user.email },
      tx: { tokenTxHash, delegateTxHash },
      eth: {
        adminEth: adminEth.toString(),
        userEthBefore: userEthBefore.toString(),
        userEthAfter: userEthAfter.toString(),
        toppedUp,
      },
    });
  } catch (e) {
    return res.status(400).json({
      ok: false,
      error: e?.shortMessage || e?.reason || e?.message || String(e),
    });
  }
});


app.post("/api/admin/users/:id/set-level", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = getUserById(req.params.id);
    if (!user) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const topicId = Number(req.body?.topicId ?? 0);
    const level = Number(req.body?.level ?? 0);

    if (![0,1,2,3].includes(level)) return res.status(400).json({ ok: false, error: "BAD_LEVEL" });

    user.levels = user.levels ?? {};
    user.levels[String(topicId)] = { level, confirmedAt: new Date().toISOString() };
    saveUser(user);

    // force repush caps (квоты/группы)
    await pushTodayCaps(topicId, { force: true }).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// 2) Topics CRUD
app.get("/api/admin/topics", requireAuth, requireAdmin, (req, res) => {
  const db = readDb();
  res.json({ ok: true, topics: db.topics ?? [] });
});

app.post("/api/admin/topics", requireAuth, requireAdmin, (req, res) => {
  const db = readDb();
  db.topics = db.topics ?? [];

  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ ok: false, error: "NAME_REQUIRED" });

  const maxId = db.topics.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0);
  const id = maxId + 1;

  const policy = req.body?.policy ?? defaultPolicy();

  db.topics.push({ id, name, policy, createdAt: new Date().toISOString() });
  writeDb(db);
  res.json({ ok: true, id });
});

app.put("/api/admin/topics/:id", requireAuth, requireAdmin, (req, res) => {
  const db = readDb();
  const id = Number(req.params.id);
  const idx = (db.topics ?? []).findIndex((t) => Number(t.id) === id);
  if (idx < 0) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  const curr = db.topics[idx];
  if (typeof req.body?.name === "string") curr.name = req.body.name.trim();
  if (req.body?.policy) curr.policy = req.body.policy;
  curr.updatedAt = new Date().toISOString();

  db.topics[idx] = curr;
  writeDb(db);

  res.json({ ok: true });
});

// 3) Exams CRUD (admin)
app.get("/api/admin/exams", requireAuth, requireAdmin, (req, res) => {
  const db = readDb();
  res.json({ ok: true, exams: db.exams ?? [] });
});

app.post("/api/admin/exams", requireAuth, requireAdmin, (req, res) => {
  const db = readDb();
  db.exams = db.exams ?? [];

  const id = String(req.body?.id ?? "").trim() || `exam-${crypto.randomBytes(6).toString("hex")}`;
  if (db.exams.find((e) => e.id === id)) return res.status(409).json({ ok: false, error: "EXAM_ID_EXISTS" });

  const topicId = Number(req.body?.topicId ?? 0);
  const title = String(req.body?.title ?? "New exam").trim();

  const exam = {
    id,
    topicId,
    title,
    passPercent: Number(req.body?.passPercent ?? 80),
    levelOnPass: Number(req.body?.levelOnPass ?? 1),
    cards: Array.isArray(req.body?.cards) ? req.body.cards : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.exams.push(exam);
  writeDb(db);
  res.json({ ok: true, id });
});

app.put("/api/admin/exams/:id", requireAuth, requireAdmin, (req, res) => {
  const db = readDb();
  db.exams = db.exams ?? [];
  const idx = db.exams.findIndex((e) => e.id === req.params.id);
  if (idx < 0) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  const curr = db.exams[idx];
  if (typeof req.body?.title === "string") curr.title = req.body.title.trim();
  if (Number.isFinite(Number(req.body?.topicId))) curr.topicId = Number(req.body.topicId);
  if (Number.isFinite(Number(req.body?.passPercent))) curr.passPercent = Number(req.body.passPercent);
  if (Number.isFinite(Number(req.body?.levelOnPass))) curr.levelOnPass = Number(req.body.levelOnPass);
  if (Array.isArray(req.body?.cards)) curr.cards = req.body.cards;

  curr.updatedAt = new Date().toISOString();
  db.exams[idx] = curr;
  writeDb(db);

  res.json({ ok: true });
});

// 4) Manual review queue
app.get("/api/admin/reviews", requireAuth, requireAdmin, (req, res) => {
  const pending = listPendingManualAttempts();
  res.json({ ok: true, pending });
});

app.get("/api/admin/reviews/:attemptId", requireAuth, requireAdmin, (req, res) => {
  const attempt = getAttemptById(req.params.attemptId);
  if (!attempt) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  const exam = getExamById(attempt.examId);
  res.json({ ok: true, attempt, exam });
});

// admin decision: per manual card correctness
app.post("/api/admin/reviews/:attemptId/decision", requireAuth, requireAdmin, async (req, res) => {
  try {
    const attempt = getAttemptById(req.params.attemptId);
    if (!attempt) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    if (attempt.status !== "pending_manual") return res.status(400).json({ ok: false, error: "NOT_PENDING" });

    const exam = getExamById(attempt.examId);
    if (!exam) return res.status(404).json({ ok: false, error: "EXAM_NOT_FOUND" });

    const decisions = req.body?.decisions ?? {}; // { cardId: true|false }
    let manualCorrect = 0;
    let manualTotal = 0;

    for (const c of (exam.cards ?? [])) {
      if (c.type !== "manual") continue;
      const pts = Number(c.points ?? 1);
      manualTotal += pts;
      if (decisions[c.id] === true) manualCorrect += pts;
    }

    // финал: auto + manual
    const autoCorrect = Number(attempt.auto?.correct ?? 0);
    const autoTotal = Number(attempt.auto?.total ?? 0);

    const total = autoTotal + manualTotal;
    const correct = autoCorrect + manualCorrect;

    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = percent >= Number(exam.passPercent ?? 80);

    attempt.status = "reviewed";
    attempt.manual = attempt.manual ?? { cards: [], decisions: {} };
    attempt.manual.decisions = decisions;
    attempt.manual.correct = manualCorrect;
    attempt.manual.total = manualTotal;
    attempt.finalPercent = percent;
    attempt.passed = passed;
    attempt.reviewedAt = new Date().toISOString();
    attempt.reviewedBy = req.user.email;

    // если passed — присваиваем уровень и пушим caps force
    const user = getUserById(attempt.userId);
    if (passed && user) {
      user.levels = user.levels ?? {};
      const topicKey = String(exam.topicId);
      const prev = Number(user.levels[topicKey]?.level ?? 0);
      const next = Math.max(prev, Number(exam.levelOnPass ?? 1));
      if (next !== prev) {
        user.levels[topicKey] = { level: next, confirmedAt: new Date().toISOString() };
        attempt.assignedLevel = next;
        saveUser(user);
      } else {
        saveUser(user);
      }

      await pushTodayCaps(Number(exam.topicId), { force: true }).catch(() => {});
    }

    saveExamAttempt(attempt);

    res.json({ ok: true, percent, passed, assignedLevel: attempt.assignedLevel ?? null });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

/* ===================== ORACLE (admin) ===================== */
app.post("/api/oracle/push-today-missing-caps", requireAuth, requireAdmin, async (req, res) => {
  try {
    const topicId = Number(req.body?.topicId ?? 0);
    const force = Boolean(req.body?.force ?? false);
    const r = await pushTodayCaps(topicId, { force });
    res.json({ ok: true, ...r });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.shortMessage || e?.reason || e?.message || String(e) });
  }
});

/* ===================== PROPOSALS ===================== */
app.get("/api/proposals", requireAuth, async (req, res) => {
  try {
    const list = listProposalsDb();
    const out = [];
    for (const p of list) {
      const onchain = await proposalDetails(p.proposalId);
      out.push({ ...p, onchain });
    }
    res.json({ ok: true, proposals: out });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/proposals/:id", requireAuth, async (req, res) => {
  try {
    const onchain = await proposalDetails(req.params.id);
    res.json({ ok: true, proposal: onchain });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// weight-preview (как в спеках)
app.get("/api/proposals/:id/weight-preview", requireAuth, async (req, res) => {
  try {
    const addr = req.user.walletAddress;
    if (!addr) return res.status(400).json({ ok: false, error: "NO_WALLET" });

    let preview = await previewVotePower(req.params.id, addr);

    // если cap=0 — добиваем caps для topicId
    if (preview.cap === "0") {
      try { await pushTodayCaps(preview.topicId, { force: false }); } catch {}
      preview = await previewVotePower(req.params.id, addr);
    }

    res.json({ ok: true, preview });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// старый алиас
app.get("/api/proposals/:id/preview", requireAuth, async (req, res) => {
  try {
    const addr = req.user.walletAddress;
    if (!addr) return res.status(400).json({ ok: false, error: "NO_WALLET" });

    let preview = await previewVotePower(req.params.id, addr);

    if (preview.cap === "0") {
      try { await pushTodayCaps(preview.topicId, { force: false }); } catch {}
      preview = await previewVotePower(req.params.id, addr);
    }

    res.json({ ok: true, preview });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/proposals/:id/my-vote", requireAuth, async (req, res) => {
  try {
    const addr = req.user.walletAddress;
    if (!addr) return res.status(400).json({ ok: false, error: "NO_WALLET" });
    const receipt = await voteReceipt(req.params.id, addr);
    res.json({ ok: true, receipt });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.post("/api/proposals/create", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!admin) return res.status(500).json({ ok: false, error: "NO_ADMIN_KEY" });

    const { governor, counterAddr } = getContractsOrThrow();

    const topicId = Number(req.body?.topicId ?? 0);
    const title = String(req.body?.title ?? "").trim();
    const description = String(req.body?.description ?? "").trim();
    const incBy = Number(req.body?.counterIncBy ?? 0);

    if (!Number.isFinite(topicId) || topicId < 0 || topicId > 0xffffffff) {
      return res.status(400).json({ ok: false, error: "BAD_TOPIC" });
    }

    // админ должен быть allowed
    await ensureGovernorAllowed(await admin.getAddress()).catch(() => {});

    if (!counterAddr) {
      return res.status(400).json({
        ok: false,
        error: "COUNTER_ADDRESS is not set. Proposal would be empty (GovernorInvalidProposalLength).",
      });
    }

    const targets = [counterAddr];
    const values = [0n];
    const calldatas = [CounterIface.encodeFunctionData("incBy", [BigInt(incBy)])];

    const fullDesc = title ? `${title}\n\n${description}` : description || `Proposal topic=${topicId}`;

    const proposalId = await governor.connect(admin).proposeWithTopic.staticCall(
      topicId, targets, values, calldatas, fullDesc
    );

    const tx = await governor.connect(admin).proposeWithTopic(topicId, targets, values, calldatas, fullDesc);
    const rc = await tx.wait();

    saveProposalDb({
      proposalId: proposalId.toString(),
      topicId,
      title: title || `Proposal #${proposalId.toString()}`,
      description: fullDesc,
      createdTxHash: tx.hash,
      createdAt: new Date().toISOString(),
      createdBlock: rc.blockNumber,
    });

    // пересчитать/пушнуть cap по теме (квоты зависят от состава групп)
    await pushTodayCaps(topicId, { force: true }).catch(() => {});

    const explorer = CFG.EXPLORER_BASE_URL ? `${CFG.EXPLORER_BASE_URL}/tx/${tx.hash}` : null;
    res.json({ ok: true, proposalId: proposalId.toString(), txHash: tx.hash, explorer });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.shortMessage || e?.reason || e?.message || String(e) });
  }
});

app.post("/api/proposals/:id/vote", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user.encryptedPrivateKey || !user.walletAddress) {
      return res.status(400).json({ ok: false, error: "NO_WALLET" });
    }

    const { governor } = getContractsOrThrow();

    const pk = decryptText(user.encryptedPrivateKey);
    const w = new ethers.Wallet(pk, provider);

    const id = req.params.id;
    const support = Number(req.body?.support ?? 1);
    const fractional = req.body?.fractional ?? null;
    const reason = String(req.body?.reason ?? "");

    let usedWeight;

    if (fractional) {
      const params = ethers.solidityPacked(
        ["uint128", "uint128", "uint128"],
        [BigInt(fractional.against), BigInt(fractional.for), BigInt(fractional.abstain)]
      );

      usedWeight = await governor.connect(w).castVoteWithReasonAndParams.staticCall(BigInt(id), 255, reason, params);
      const tx = await governor.connect(w).castVoteWithReasonAndParams(BigInt(id), 255, reason, params);
      const rc = await tx.wait();

      const explorer = CFG.EXPLORER_BASE_URL ? `${CFG.EXPLORER_BASE_URL}/tx/${tx.hash}` : null;
      return res.json({ ok: true, txHash: tx.hash, blockNumber: rc.blockNumber, usedWeight: usedWeight.toString(), explorer });
    } else {
      usedWeight = await governor.connect(w).castVote.staticCall(BigInt(id), support);
      const tx = await governor.connect(w).castVote(BigInt(id), support);
      const rc = await tx.wait();

      const explorer = CFG.EXPLORER_BASE_URL ? `${CFG.EXPLORER_BASE_URL}/tx/${tx.hash}` : null;
      return res.json({ ok: true, txHash: tx.hash, blockNumber: rc.blockNumber, usedWeight: usedWeight.toString(), explorer });
    }
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.shortMessage || e?.reason || e?.message || String(e) });
  }
});

/* ===================== health ===================== */
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(CFG.PORT, "0.0.0.0", () => {
  console.log(`API listening on http://0.0.0.0:${CFG.PORT}`);

  // подстраховка: админ allowed
  (async () => {
    if (!admin) return;
    try {
      const adminAddr = await admin.getAddress();
      await ensureGovernorAllowed(adminAddr);
      console.log(`[INIT] ensured admin allowed: ${adminAddr}`);
    } catch (e) {
      console.warn("[INIT] ensure admin allowed failed:", e?.message ?? e);
    }
  })();
});
