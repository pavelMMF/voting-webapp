import "dotenv/config";
import express from "express";
import session from "express-session";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import cors from "cors";

import { DB } from "./db.js";
import { encryptText, decryptText } from "./crypto.js";
import { makeChain } from "./chain.js";

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  session({
    name: "voting.sid",
    secret: process.env.SESSION_SECRET ?? "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // на хостинге станет true (https)
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

const CFG = {
  PORT: process.env.PORT ?? "3001",
  RPC_URL: process.env.RPC_URL,
  CHAIN_ID: process.env.CHAIN_ID,
  ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY,
  GOVTOKEN_ADDRESS: process.env.GOVTOKEN_ADDRESS,
  ORACLE_ADDRESS: process.env.ORACLE_ADDRESS,
  GOVERNOR_ADDRESS: process.env.GOVERNOR_ADDRESS,
  ALLOWLIST_ADDRESS: process.env.ALLOWLIST_ADDRESS || "",
  NI99A_ARTIFACTS_DIR: process.env.NI99A_ARTIFACTS_DIR,
  ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET,
  DEV_EXPOSE_EMAIL_TOKEN: process.env.DEV_EXPOSE_EMAIL_TOKEN === "1",
  EXPLORER_BASE_URL: process.env.EXPLORER_BASE_URL || "",
};

for (const k of ["RPC_URL","CHAIN_ID","ADMIN_PRIVATE_KEY","GOVTOKEN_ADDRESS","ORACLE_ADDRESS","GOVERNOR_ADDRESS","NI99A_ARTIFACTS_DIR","ENCRYPTION_SECRET"]) {
  if (!CFG[k]) throw new Error(`Missing env ${k}`);
}

const chain = makeChain(CFG);

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: "UNAUTH" });
  const user = DB.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ ok: false, error: "UNAUTH" });
  req.user = user;
  next();
}

function isEmail(s) {
  return typeof s === "string" && s.includes("@") && s.length <= 200;
}

function makeId() {
  return crypto.randomBytes(16).toString("hex");
}

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}

/* ===================== AUTH ===================== */

app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!isEmail(email) || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ ok: false, error: "INVALID_INPUT" });
  }

  if (DB.getUserByEmail(email)) {
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
    role: "user", // позже можно admin
    walletAddress: null,
    encryptedPrivateKey: null,
    createdAt: new Date().toISOString(),
  };

  DB.saveUser(user);

  // DEV: вместо реального письма — отдаём токен (или логируем)
  const verifyUrl = `/verify-email?token=${verifyToken}`;
  console.log(`[DEV] verify email for ${email}: ${verifyUrl}`);

  return res.json({
    ok: true,
    ...(CFG.DEV_EXPOSE_EMAIL_TOKEN ? { verifyUrl } : {}),
  });
});

app.post("/api/auth/verify-email", async (req, res) => {
  const { token } = req.body ?? {};
  if (typeof token !== "string" || token.length < 10) {
    return res.status(400).json({ ok: false, error: "INVALID_TOKEN" });
  }

  const user = DB.getUserByVerifyToken(token);
  if (!user) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

  if (!user.verified) {
    user.verified = true;
    user.verifyToken = null;

    // 1) создаём кошелёк
    const wallet = crypto.randomBytes(32).toString("hex"); // raw pk (no 0x)
    const pk = "0x" + wallet;
    const userWallet = chain.userSignerFromPrivateKey(pk);
    const addr = await userWallet.getAddress();

    user.walletAddress = addr;
    user.encryptedPrivateKey = encryptText(pk, CFG.ENCRYPTION_SECRET);

    DB.saveUser(user);

    // 2) выдаём газ (ETH)
    await chain.fundUser(addr, "0.05");

    // 3) hard allowlist (если контракт задан)
    await chain.allowUser(addr);

    // 4) delegate(self) чтобы baseVotes работали (если GovToken ERC20Votes-like)
    try {
      await chain.delegateSelf(userWallet);
    } catch (e) {
      console.warn("delegateSelf failed (maybe token not minted yet?)", e?.message ?? e);
    }
  }

  return res.json({ ok: true });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = DB.getUserByEmail(email);
  if (!user) return res.status(401).json({ ok: false, error: "BAD_CREDENTIALS" });
  const ok = await bcrypt.compare(String(password ?? ""), user.passwordHash);
  if (!ok) return res.status(401).json({ ok: false, error: "BAD_CREDENTIALS" });
  if (!user.verified) return res.status(403).json({ ok: false, error: "EMAIL_NOT_VERIFIED" });

  req.session.userId = user.id;
  return res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ ok: false });
  const user = DB.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ ok: false });

  return res.json({
    ok: true,
    user: {
      email: user.email,
      role: user.role,
      walletAddress: user.walletAddress,
    },
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

/* ===================== PROPOSALS ===================== */

app.get("/api/proposals", requireAuth, async (req, res) => {
  const list = DB.listProposals();
  // Обновляем состояние/голоса “живьём” с чейна
  const enriched = [];
  for (const p of list) {
    const d = await chain.proposalDetails(p.proposalId);
    enriched.push({ ...p, onchain: d });
  }
  res.json({ ok: true, proposals: enriched });
});

app.get("/api/proposals/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  const d = await chain.proposalDetails(id);
  res.json({ ok: true, proposal: d });
});

app.get("/api/proposals/:id/preview", requireAuth, async (req, res) => {
  const id = req.params.id;
  const user = req.user;
  const addr = user.walletAddress;
  if (!addr) return res.status(400).json({ ok: false, error: "NO_WALLET" });

  const pv = await chain.previewVotePower(id, addr);
  res.json({ ok: true, preview: pv });
});

app.get("/api/proposals/:id/my-vote", requireAuth, async (req, res) => {
  const id = req.params.id;
  const addr = req.user.walletAddress;
  if (!addr) return res.status(400).json({ ok: false, error: "NO_WALLET" });

  const receipt = await chain.voteReceipt(id, addr);
  res.json({ ok: true, receipt });
});

app.post("/api/proposals/:id/vote", requireAuth, async (req, res) => {
  const id = req.params.id;
  const { support, fractional, reason } = req.body ?? {};

  const user = req.user;
  if (!user.encryptedPrivateKey || !user.walletAddress) {
    return res.status(400).json({ ok: false, error: "NO_WALLET" });
  }

  const pk = decryptText(user.encryptedPrivateKey, CFG.ENCRYPTION_SECRET);
  const w = chain.userSignerFromPrivateKey(pk);

  try {
    let result;
    if (fractional) {
      result = await chain.castVoteFractional(w, id, fractional, String(reason ?? ""));
    } else {
      result = await chain.castVoteSimple(w, id, Number(support));
    }

    const explorer = CFG.EXPLORER_BASE_URL
      ? `${CFG.EXPLORER_BASE_URL}/tx/${result.txHash}`
      : null;

    res.json({ ok: true, ...result, explorer });
  } catch (e) {
    // здесь поймаешь revert от hard allowlist или недостатка газа
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.listen(Number(CFG.PORT), "0.0.0.0", () => {
  console.log(`API listening on http://0.0.0.0:${CFG.PORT}`);
});
