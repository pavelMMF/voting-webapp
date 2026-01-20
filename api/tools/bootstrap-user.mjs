import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 1337);
const ADMIN_PK = (process.env.ADMIN_PRIVATE_KEY ?? "").trim();
const ENC_SECRET = (process.env.ENCRYPTION_SECRET ?? "").trim();

const GOVTOKEN = (process.env.GOVTOKEN_ADDRESS ?? "").trim();
const ORACLE = (process.env.ORACLE_ADDRESS ?? "").trim();

if (!ADMIN_PK || !ENC_SECRET) throw new Error("Need ADMIN_PRIVATE_KEY and ENCRYPTION_SECRET");
if (!ethers.isAddress(GOVTOKEN) || !ethers.isAddress(ORACLE)) throw new Error("Need GOVTOKEN_ADDRESS and ORACLE_ADDRESS");

function arg(name, def = "") {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? (process.argv[idx + 1] ?? def) : def;
}

const walletAddr = arg("--wallet", "");
const email = arg("--email", "");
const topicId = Number(arg("--topic", "1"));
const cap = BigInt(arg("--cap", "100"));
const tokens = arg("--tokens", "100"); // в “человеческих” единицах, учитывая decimals токена

// --- decrypt (AES-256-GCM), как у тебя в API ---
function keyFromSecret(secret) {
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}
function decryptText(b64) {
  const raw = Buffer.from(b64, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const key = keyFromSecret(ENC_SECRET);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
const admin = new ethers.Wallet(ADMIN_PK, provider);

const GovTokenAbi = [
  "function decimals() view returns(uint8)",
  "function balanceOf(address) view returns(uint256)",
  "function transfer(address,uint256) returns(bool)",
  "function delegate(address)",
  "function getVotes(address) view returns(uint256)",
];

const OracleAbi = [
  "function currentDay() view returns(uint48)",
  "function pushDailyTopicWeights(uint48 day, uint32 topicId, address[] voters, uint192[] weights, bytes32 contextHash)",
  "function weightAtTopic(address voter, uint256 ts, uint32 topicId) view returns(uint256)",
];

const token = new ethers.Contract(GOVTOKEN, GovTokenAbi, admin);
const oracle = new ethers.Contract(ORACLE, OracleAbi, admin);

function loadUserFromDb() {
  const dbPath = path.resolve(process.cwd(), "data", "db.json");
  const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  let u = null;

  if (walletAddr) {
    u = db.users.find((x) => (x.walletAddress ?? "").toLowerCase() === walletAddr.toLowerCase()) ?? null;
  } else if (email) {
    u = db.users.find((x) => (x.email ?? "").toLowerCase() === email.toLowerCase()) ?? null;
  }
  if (!u) throw new Error("User not found in data/db.json (use --wallet or --email)");
  if (!u.encryptedPrivateKey || !u.walletAddress) throw new Error("User has no wallet yet");
  return u;
}

const u = loadUserFromDb();
const userPk = decryptText(u.encryptedPrivateKey);
const userWallet = new ethers.Wallet(userPk, provider);
const userAddress = await userWallet.getAddress();

console.log("RPC:", RPC_URL, "chainId:", CHAIN_ID);
console.log("Admin:", admin.address);
console.log("User :", userAddress);

const dec = await token.decimals();
const amt = ethers.parseUnits(tokens, dec);

console.log("Admin GovToken bal:", (await token.balanceOf(admin.address)).toString());
console.log("User  GovToken bal:", (await token.balanceOf(userAddress)).toString());

console.log("1) Transfer tokens to user...");
await (await token.transfer(userAddress, amt)).wait();

console.log("2) Delegate self from USER wallet...");
await (await token.connect(userWallet).delegate(userAddress)).wait();

console.log("User getVotes:", (await token.getVotes(userAddress)).toString());

console.log("3) Push cap to Oracle...");
const day = await oracle.currentDay();
const ctx = ethers.keccak256(ethers.toUtf8Bytes(`bootstrap:${Date.now()}`));
await (await oracle.pushDailyTopicWeights(day, topicId, [userAddress], [cap], ctx)).wait();

const ts = Math.floor(Date.now() / 1000);
console.log("Cap now:", (await oracle.weightAtTopic(userAddress, ts, topicId)).toString());
console.log("DONE. Now create a NEW proposal with topicId =", topicId);
