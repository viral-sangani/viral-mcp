import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// Works from both src/ (tsx) and dist/ (compiled) since both are one level below repo root.
export const REPO_ROOT = path.resolve(here, "..");
export const UPSTREAM_DIR = path.join(REPO_ROOT, "upstream");
export const SKILL_DIR = path.join(UPSTREAM_DIR, "skills", "last30days");
export const SKILL_MD = path.join(SKILL_DIR, "SKILL.md");
export const ENGINE_SCRIPT = path.join(SKILL_DIR, "scripts", "last30days.py");
export const PLUGIN_JSON = path.join(UPSTREAM_DIR, ".claude-plugin", "plugin.json");

export const PORT = Number(process.env.PORT ?? 3030);
export const PYTHON_BIN = process.env.PYTHON_BIN ?? "python3";
export const ENGINE_TIMEOUT_MS = Number(process.env.ENGINE_TIMEOUT_MS ?? 600_000);

export interface TokenEntry {
  name: string;
  token: string;
}

/**
 * AUTH_TOKENS="alice:secret1,bob:secret2" (or bare tokens without a name).
 * Empty/unset means auth is DISABLED — only acceptable for local development.
 */
export function parseAuthTokens(raw = process.env.AUTH_TOKENS ?? ""): TokenEntry[] {
  return raw
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const idx = entry.indexOf(":");
      return idx > 0
        ? { name: entry.slice(0, idx), token: entry.slice(idx + 1) }
        : { name: "default", token: entry };
    });
}

export const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";

/** Keys that unlock --auto-resolve (web-search backed entity resolution). */
export function hasWebSearchKey(): boolean {
  return Boolean(
    process.env.BRAVE_API_KEY ||
      process.env.EXA_API_KEY ||
      process.env.SERPER_API_KEY ||
      process.env.PARALLEL_API_KEY,
  );
}
