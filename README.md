# viral-mcp

Team MCP server wrapping the [last30days-skill](https://github.com/mvanhorn/last30days-skill) research engine.

- **One server, central API keys.** All provider keys (ScrapeCreators, xAI, Brave, Gemini, …) live on the server. Teammates get a bearer token, never the keys.
- **Any agent can use it** — Claude Code, Cursor, Codex, or programmatically via the AI SDK — over Streamable HTTP MCP.
- **The skill's instructions travel with the data.** Every `last30days_research` result is prefixed with the upstream SKILL.md synthesis contract (badge + LAWs), extracted live from the synced upstream, so the calling model writes the canonical brief.
- **Always up to date.** Upstream is a git submodule. A daily GitHub Action bumps it; `POST /admin/sync` pulls it into a running server with zero downtime. We hold no diffs against upstream, so sync can never conflict.

## Architecture

```
agent (Claude Code / Cursor / AI SDK)
   │  Streamable HTTP MCP + bearer token
   ▼
viral-mcp (Express + @modelcontextprotocol/sdk)
   │  spawns per request
   ▼
upstream/skills/last30days/scripts/last30days.py   ← git submodule, synced daily
   │  server-side API keys (.env)
   ▼
Reddit · X · YouTube · TikTok · HN · Polymarket · GitHub · Bluesky · web
```

The tool returns `synthesis contract + ranked evidence`; the *caller's* model does the final synthesis. This mirrors how the skill works in Claude Code, where the host model is the synthesizer.

## MCP surface

| Kind | Name | Purpose |
|---|---|---|
| tool | `last30days_research` | Run the engine: topic, optional `sources`, `depth`, `github_user`, `x_handle`, `subreddits`, `mock` |
| tool | `last30days_diagnose` | Per-source availability report (which keys/CLIs the server has) |
| resource | `last30days://skill.md` | Full upstream SKILL.md |
| resource | `last30days://synthesis-contract` | Extracted output contract |
| prompt | `last30days-synthesis` | Same contract as a prompt |

## Run it

```bash
cp .env.template .env   # fill in keys + AUTH_TOKENS + ADMIN_TOKEN
docker compose up -d --build
curl localhost:3030/healthz
```

Local dev (needs Python ≥ 3.12 and Node ≥ 20):

```bash
npm install
git submodule update --init
PYTHON_BIN=python3.13 AUTH_TOKENS=me:dev npm run dev
```

Put a TLS reverse proxy (Caddy is two lines) in front of port 3030 in production.

## Connect

**Claude Code**

```bash
claude mcp add --transport http last30days https://research.example.com/mcp \
  --header "Authorization: Bearer <your-token>"
```

**AI SDK** — see [`examples/ai-sdk-client.ts`](examples/ai-sdk-client.ts):

```ts
import { createMCPClient } from "@ai-sdk/mcp";
const mcp = await createMCPClient({
  transport: { type: "http", url: "https://research.example.com/mcp",
               headers: { Authorization: "Bearer <token>" } },
});
const tools = await mcp.tools();
```

## Upstream sync

- **Daily**: `.github/workflows/sync-upstream.yml` bumps the submodule, verifies the contract anchors still extract, smoke-tests the engine with `--mock`, commits.
- **One click**: `curl -X POST https://research.example.com/admin/sync -H "Authorization: Bearer $ADMIN_TOKEN"` — pulls upstream main and re-extracts the contract in-process.
- **Rule**: never edit files under `upstream/`. All adaptation happens at runtime in `src/instructions.ts`. If upstream renames the `# OUTPUT CONTRACT` section, `/healthz` reports `contractExtraction: "fallback"` and the CI anchor check fails loudly.

## Keys (`.env`)

See `.env.template`. Minimum useful set: one reasoning key (`GOOGLE_API_KEY`), one web-search key (`BRAVE_API_KEY` or `PARALLEL_API_KEY`), `XAI_API_KEY` for X, `SCRAPECREATORS_API_KEY` for TikTok/Instagram. Reddit, Hacker News, Polymarket and GitHub work with no keys.
