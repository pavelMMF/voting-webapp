import "dotenv/config";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 1337);
const ADMIN_PK = (process.env.ADMIN_PRIVATE_KEY ?? "").trim();
const GOVERNOR = (process.env.GOVERNOR_ADDRESS ?? "").trim();

if (!ADMIN_PK) throw new Error("ADMIN_PRIVATE_KEY missing");
if (!ethers.isAddress(GOVERNOR)) throw new Error("GOVERNOR_ADDRESS invalid");

const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
const admin = new ethers.Wallet(ADMIN_PK, provider);

const govAbi = [
  "function allowed(address) view returns (bool)",
  "function setAllowed(address,bool)",
];

const gov = new ethers.Contract(GOVERNOR, govAbi, admin);

const dbPath = path.resolve(process.cwd(), "data", "db.json");
const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));

const addrs = new Set();
addrs.add(admin.address.toLowerCase());

for (const u of (db.users ?? [])) {
  if (u.verified && u.walletAddress) addrs.add(String(u.walletAddress).toLowerCase());
}

console.log("Governor:", GOVERNOR);
console.log("Admin   :", admin.address);
console.log("Users   :", addrs.size - 1);

for (const a of addrs) {
  const addr = ethers.getAddress(a);
  const ok = await gov.allowed(addr);
  if (!ok) {
    console.log("setAllowed", addr);
    await (await gov.setAllowed(addr, true)).wait();
  }
}

console.log("DONE");
