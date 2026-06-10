import fs from "node:fs";
import { PLUGIN_JSON, SKILL_MD } from "./config.js";

const CONTRACT_START = /^# OUTPUT CONTRACT/m;
const CONTRACT_END = /^End of OUTPUT CONTRACT\./m;

// Used only if upstream restructures SKILL.md and the anchors disappear.
const FALLBACK_CONTRACT = `### Synthesis contract (fallback summary)
- First line of output: \`🌐 last30days v{VERSION} · synced {YYYY-MM-DD}\` badge, verbatim, then a blank line.
- General topics: start the body with the literal label \`What I learned:\`, then bold-lead-in prose paragraphs. No invented title, no \`##\` section headers.
- Comparison topics ("X vs Y"): use \`# {A} vs {B}: What the Community Says (/Last30Days)\` with \`## Quick Verdict\`, one \`## {Entity}\` per side, \`## Head-to-Head\`, \`## The Bottom Line\`.
- Every cited handle/subreddit/publication is an inline markdown link \`[name](url)\` at first mention. Never raw URLs, never a trailing Sources/References block.
- No em-dashes; use " - ".
- The engine's emoji-tree footer (between PASS-THROUGH FOOTER comments) must be included verbatim after the analysis.
- The engine's "Ranked Evidence Clusters" blocks are raw evidence for you to read, never to emit verbatim — transform them into prose.
- End with KEY PATTERNS from the research: numbered list, then the footer.`;

export interface SkillInstructions {
  version: string;
  contract: string;
  usedFallback: boolean;
}

let cache: SkillInstructions | null = null;

export function loadInstructions(force = false): SkillInstructions {
  if (cache && !force) return cache;

  let version = "unknown";
  try {
    version = JSON.parse(fs.readFileSync(PLUGIN_JSON, "utf8")).version ?? "unknown";
  } catch {
    // keep "unknown"
  }

  let contract = FALLBACK_CONTRACT;
  let usedFallback = true;
  try {
    const skill = fs.readFileSync(SKILL_MD, "utf8");
    const start = skill.search(CONTRACT_START);
    const endMatch = CONTRACT_END.exec(skill);
    if (start >= 0 && endMatch && endMatch.index > start) {
      contract = skill.slice(start, endMatch.index + endMatch[0].length).trim();
      usedFallback = false;
    } else {
      console.error("[instructions] OUTPUT CONTRACT anchors not found in SKILL.md — using fallback summary. Check upstream changes.");
    }
  } catch (err) {
    console.error(`[instructions] Cannot read SKILL.md: ${err}`);
  }

  cache = { version, contract, usedFallback };
  return cache;
}

/**
 * The preamble adapts the upstream contract (written for an interactive harness
 * that invokes the engine itself) to MCP consumers, where the server already ran
 * the engine and the caller only synthesizes.
 */
export function synthesisInstructions(): string {
  const { version, contract } = loadInstructions();
  return `# How to use the research evidence below

You called the last30days research engine (v${version}) through an MCP server. The engine already searched Reddit, X, YouTube, Hacker News, Polymarket, GitHub and other sources, scored everything by real engagement, and ranked it. Your job now is ONLY synthesis: turn the evidence into the canonical /last30days brief for the user.

Rules that concern engine invocation, query planning, --plan flags, WebSearch steps, or setup wizards in the contract below are handled server-side — ignore them. Everything about OUTPUT SHAPE (the badge, the LAWs, citations, footer pass-through) applies to you verbatim.

---

${contract}`;
}
