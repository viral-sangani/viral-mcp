import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ENGINE_SCRIPT, ENGINE_TIMEOUT_MS, PYTHON_BIN, hasWebSearchKey } from "./config.js";

export interface ResearchOptions {
  topic: string;
  /** Comma-separated source list, e.g. "reddit,x,youtube". Default: engine decides. */
  sources?: string;
  depth?: "quick" | "default" | "deep";
  emit?: "context" | "md" | "json" | "compact";
  githubUser?: string;
  xHandle?: string;
  subreddits?: string;
  /** Run against bundled mock fixtures instead of live APIs (testing only). */
  mock?: boolean;
}

export interface EngineResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export async function runEngine(opts: ResearchOptions): Promise<EngineResult> {
  // Each run gets its own scratch dir so concurrent requests never collide on
  // the engine's saved-output files.
  const saveDir = fs.mkdtempSync(path.join(os.tmpdir(), "last30days-"));

  const args = [ENGINE_SCRIPT, opts.topic, `--emit=${opts.emit ?? "context"}`, "--save-dir", saveDir];
  if (hasWebSearchKey() && !opts.mock) args.push("--auto-resolve");
  if (opts.sources) args.push(`--search=${opts.sources}`);
  if (opts.depth === "quick") args.push("--quick");
  if (opts.depth === "deep") args.push("--deep");
  if (opts.githubUser) args.push(`--github-user=${opts.githubUser}`);
  if (opts.xHandle) args.push(`--x-handle=${opts.xHandle}`);
  if (opts.subreddits) args.push(`--subreddits=${opts.subreddits}`);
  if (opts.mock) args.push("--mock");

  const started = Date.now();
  try {
    return await new Promise<EngineResult>((resolve, reject) => {
      execFile(
        PYTHON_BIN,
        args,
        {
          timeout: ENGINE_TIMEOUT_MS,
          maxBuffer: 64 * 1024 * 1024,
          env: { ...process.env, LAST30DAYS_MEMORY_DIR: saveDir },
        },
        (error, stdout, stderr) => {
          const durationMs = Date.now() - started;
          if (error && !stdout) {
            reject(new Error(`engine failed (${error.message}):\n${stderr.slice(-4000)}`));
            return;
          }
          resolve({
            stdout,
            stderr,
            exitCode: error ? Number((error as { code?: number | string }).code ?? 1) || 1 : 0,
            durationMs,
          });
        },
      );
    });
  } finally {
    fs.rm(saveDir, { recursive: true, force: true }, () => {});
  }
}

export async function runDiagnose(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON_BIN,
      [ENGINE_SCRIPT, "--diagnose"],
      { timeout: 60_000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env } },
      (error, stdout, stderr) => {
        const out = `${stdout}\n${stderr}`.trim();
        if (error && !out) reject(new Error(`diagnose failed: ${error.message}`));
        else resolve(out);
      },
    );
  });
}
