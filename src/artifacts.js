import fs from "fs";
import path from "path";

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
}

export function loadAbi(artifactsDir, contractName) {
  const files = [];
  walk(artifactsDir, files);

  const match = files.find((p) => p.endsWith(`${contractName}.json`) && p.includes("artifacts"));
  if (!match) throw new Error(`ABI not found for ${contractName} in ${artifactsDir}`);

  const json = JSON.parse(fs.readFileSync(match, "utf8"));
  if (!json.abi) throw new Error(`No ABI in artifact ${match}`);
  return json.abi;
}
