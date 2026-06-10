/**
 * Consume viral-mcp from an AI SDK v6 agent.
 *
 *   npm i ai @ai-sdk/mcp
 *   MCP_URL=https://research.example.com/mcp MCP_TOKEN=... npx tsx examples/ai-sdk-client.ts "Solana ETF"
 */
import { generateText, stepCountIs } from "ai";
import { createMCPClient } from "@ai-sdk/mcp";

const topic = process.argv[2] ?? "OpenAI";

const mcp = await createMCPClient({
  transport: {
    type: "http",
    url: process.env.MCP_URL ?? "http://localhost:3030/mcp",
    headers: { Authorization: `Bearer ${process.env.MCP_TOKEN ?? ""}` },
  },
});

try {
  const tools = await mcp.tools();

  const { text } = await generateText({
    model: "anthropic/claude-sonnet-4.6", // via Vercel AI Gateway; any provider works
    tools,
    stopWhen: stepCountIs(3),
    prompt: `Research "${topic}" with the last30days_research tool, then write the brief following the synthesis contract the tool returns.`,
  });

  console.log(text);
} finally {
  await mcp.close();
}
