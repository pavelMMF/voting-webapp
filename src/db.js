import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify({ users: [], proposals: [] }, null, 2),
      "utf8"
    );
  }
}
init();

function read() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function write(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export const DB = {
  getUserByEmail(email) {
    const db = read();
    return db.users.find((u) => u.email === email) ?? null;
  },
  getUserById(id) {
    const db = read();
    return db.users.find((u) => u.id === id) ?? null;
  },
  getUserByVerifyToken(token) {
    const db = read();
    return db.users.find((u) => u.verifyToken === token) ?? null;
  },
  saveUser(user) {
    const db = read();
    const idx = db.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) db.users[idx] = user;
    else db.users.push(user);
    write(db);
  },

  listProposals() {
    const db = read();
    return db.proposals ?? [];
  },
  saveProposal(p) {
    const db = read();
    db.proposals = db.proposals ?? [];
    const idx = db.proposals.findIndex((x) => String(x.proposalId) === String(p.proposalId));
    if (idx >= 0) db.proposals[idx] = p;
    else db.proposals.push(p);
    write(db);
  },
};
