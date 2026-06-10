import fs from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SKILL_MD } from "./config.js";
import { runDiagnose, runEngine } from "./engine.js";
import { loadInstructions, synthesisInstructions } from "./instructions.js";

export function buildServer(): McpServer {
  const { version } = loadInstructions();

  const server = new McpServer({
    name: "viral-mcp-last30days",
    version,
  });

  server.registerTool(
    "last30days_research",
    {
      title: "last30days research",
      description:
        "Research what real people said about a topic in the last 30 days across Reddit, X/Twitter, YouTube, TikTok, Hacker News, Polymarket, GitHub, Bluesky and the web, scored by actual engagement (upvotes, likes, views, prediction-market money). " +
        "Works for people, companies, products, markets, crypto and finance topics. " +
        "Returns ranked evidence clusters PLUS a synthesis contract: follow the contract exactly when writing the final brief for the user. " +
        "Typical runtime is 1-5 minutes.",
      inputSchema: {
        topic: z.string().min(2).describe('Research topic, e.g. "Peter Steinberger", "Solana ETF", "OpenAI vs Anthropic"'),
        sources: z
          .string()
          .optional()
          .describe("Optional comma-separated source filter, e.g. 'reddit,x,youtube,polymarket'. Omit to let the engine pick."),
        depth: z.enum(["quick", "default", "deep"]).optional().describe("quick = lower latency, deep = higher recall. Default: default."),
        github_user: z.string().optional().describe("GitHub username for person-mode search (what are they shipping?)"),
        x_handle: z.string().optional().describe("Known X handle for targeted supplemental search (without @)"),
        subreddits: z.string().optional().describe("Comma-separated subreddits to prioritize, e.g. 'CryptoCurrency,wallstreetbets'"),
        include_instructions: z
          .boolean()
          .optional()
          .describe("Prefix the result with the synthesis contract (default true). Set false if you already have it in context."),
        mock: z.boolean().optional().describe("Run against bundled fixtures instead of live APIs (connectivity testing only)."),
      },
    },
    async args => {
      const result = await runEngine({
        topic: args.topic,
        sources: args.sources,
        depth: args.depth ?? "default",
        emit: "context",
        githubUser: args.github_user,
        xHandle: args.x_handle,
        subreddits: args.subreddits,
        mock: args.mock ?? false,
      });

      const sections: string[] = [];
      if (args.include_instructions !== false) sections.push(synthesisInstructions());
      sections.push(`<engine-output topic=${JSON.stringify(args.topic)} duration_ms="${result.durationMs}">\n${result.stdout.trim()}\n</engine-output>`);
      if (result.exitCode !== 0) {
        sections.push(`<engine-warnings exit_code="${result.exitCode}">\n${result.stderr.slice(-3000)}\n</engine-warnings>`);
      }

      return { content: [{ type: "text", text: sections.join("\n\n") }] };
    },
  );

  server.registerTool(
    "last30days_diagnose",
    {
      title: "last30days diagnose",
      description:
        "Print the engine's per-source availability report: which API keys are configured on the server, which sources are reachable, which CLIs are installed. Use to debug missing sources in research results.",
      inputSchema: {},
    },
    async () => ({ content: [{ type: "text", text: await runDiagnose() }] }),
  );

  server.registerResource(
    "skill-md",
    "last30days://skill.md",
    {
      title: "Upstream SKILL.md",
      description: "The full upstream last30days SKILL.md instruction contract (current synced version).",
      mimeType: "text/markdown",
    },
    async uri => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: fs.readFileSync(SKILL_MD, "utf8") }],
    }),
  );

  server.registerResource(
    "synthesis-contract",
    "last30days://synthesis-contract",
    {
      title: "Synthesis contract",
      description: "The extracted output contract (badge + LAWs) consumers should follow when synthesizing engine evidence.",
      mimeType: "text/markdown",
    },
    async uri => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: synthesisInstructions() }],
    }),
  );

  server.registerPrompt(
    "last30days-synthesis",
    {
      title: "last30days synthesis contract",
      description: "System guidance for synthesizing last30days engine evidence into the canonical brief.",
    },
    async () => ({
      messages: [{ role: "user", content: { type: "text", text: synthesisInstructions() } }],
    }),
  );

  return server;
}
