import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");
const lines = readFileSync(envPath, "utf8").split("\n");
for (const line of lines) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY }
});
const spec = await res.json();
const cols = spec?.definitions?.projects?.properties;
if (!cols) { console.error("projects not in spec"); process.exit(1); }
console.log("projects columns:\n" + Object.keys(cols).map(k => `  ${k}: ${cols[k].type ?? cols[k].format ?? JSON.stringify(cols[k])}`).join("\n"));
