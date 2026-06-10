import { execFile } from "node:child_process";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ADMIN_TOKEN, PORT, UPSTREAM_DIR, parseAuthTokens } from "./config.js";
import { loadInstructions } from "./instructions.js";
import { buildServer } from "./server.js";

const tokens = parseAuthTokens();
if (tokens.length === 0) {
  console.warn("[viral-mcp] AUTH_TOKENS is not set — the /mcp endpoint is UNAUTHENTICATED. Only do this locally.");
}

const app = express();
app.use(express.json({ limit: "4mb" }));

app.get("/healthz", (_req, res) => {
  const { version, usedFallback } = loadInstructions();
  res.json({ ok: true, upstreamVersion: version, contractExtraction: usedFallback ? "fallback" : "ok" });
});

// One-click upstream sync: pulls the submodule to origin/main and re-extracts
// the synthesis contract, no restart needed.
app.post("/admin/sync", (req, res) => {
  if (!ADMIN_TOKEN || req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  execFile(
    "git",
    ["-C", UPSTREAM_DIR, "pull", "--ff-only", "origin", "main"],
    { timeout: 120_000 },
    (error, stdout, stderr) => {
      if (error) {
        res.status(500).json({ error: String(error), stderr });
        return;
      }
      const { version, usedFallback } = loadInstructions(true);
      res.json({ ok: true, git: stdout.trim(), upstreamVersion: version, contractExtraction: usedFallback ? "fallback" : "ok" });
    },
  );
});

app.post("/mcp", async (req, res) => {
  if (tokens.length > 0) {
    const auth = req.headers.authorization ?? "";
    const presented = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const entry = tokens.find(t => t.token === presented);
    if (!entry) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized: missing or invalid bearer token" },
        id: null,
      });
      return;
    }
    console.log(`[viral-mcp] ${entry.name} → ${req.body?.method ?? "?"}`);
  }

  // Stateless mode: a fresh server+transport per request, no session tracking.
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[viral-mcp] request error:", err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});

// Stateless servers don't support GET (SSE notification streams) or DELETE (sessions).
const methodNotAllowed = (_req: express.Request, res: express.Response) => {
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
};
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

const { version, usedFallback } = loadInstructions();
app.listen(PORT, () => {
  console.log(`[viral-mcp] listening on :${PORT} — upstream last30days v${version} (contract extraction: ${usedFallback ? "FALLBACK" : "ok"})`);
});
