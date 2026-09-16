import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";

const MODEL = "claude-sonnet-5";

let client: Anthropic | null | undefined;

function getClient(): Anthropic | null {
  if (client !== undefined) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  client = apiKey ? new Anthropic({ apiKey }) : null;
  return client;
}

function firstTextBlock(message: Anthropic.Message): string | null {
  const block = message.content.find((item) => item.type === "text");
  return block?.type === "text" ? block.text : null;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export type ExplainPassageResult = {
  simpleWords: string;
  whyItMatters: string;
};

export async function explainPassage(reference: string, passage: string): Promise<ExplainPassageResult | null> {
  const anthropic = getClient();
  if (!anthropic) return null;
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system:
        'You help readers understand Bible passages. Respond ONLY with strict JSON matching {"simpleWords": string, "whyItMatters": string}, ' +
        'and nothing else. "simpleWords" restates the passage in plain, modern language in 2-3 sentences. ' +
        '"whyItMatters" explains its significance in 1-2 sentences.',
      messages: [{ role: "user", content: `Reference: ${reference}\nPassage: ${passage}` }],
    });
    const text = firstTextBlock(message);
    const parsed = text && parseJsonObject(text);
    if (!parsed || typeof parsed.simpleWords !== "string" || typeof parsed.whyItMatters !== "string") return null;
    return { simpleWords: parsed.simpleWords, whyItMatters: parsed.whyItMatters };
  } catch (err) {
    logger.error({ err }, "Anthropic explainPassage call failed");
    return null;
  }
}

export type AskPassageResult = {
  shortAnswer: string;
  context: string;
  explanation: string;
  exploreNext: string[];
};

export async function askPassage(question: string, reference: string, passage: string): Promise<AskPassageResult | null> {
  const anthropic = getClient();
  if (!anthropic) return null;
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      system:
        "You answer a reader's question about a Bible passage they are currently viewing. Respond ONLY with strict JSON matching " +
        '{"shortAnswer": string, "context": string, "explanation": string, "exploreNext": string[]}, and nothing else. ' +
        '"shortAnswer" is a 1-sentence direct answer. "context" gives 1-2 sentences of historical or narrative context. ' +
        '"explanation" answers the question in 2-4 sentences, grounded in the passage rather than presented as a Scripture quotation. ' +
        '"exploreNext" lists 2-4 short names of people, places, or events worth exploring next.',
      messages: [{ role: "user", content: `Passage: ${reference}\n${passage}\n\nQuestion: ${question}` }],
    });
    const text = firstTextBlock(message);
    const parsed = text && parseJsonObject(text);
    if (
      !parsed ||
      typeof parsed.shortAnswer !== "string" ||
      typeof parsed.context !== "string" ||
      typeof parsed.explanation !== "string" ||
      !Array.isArray(parsed.exploreNext) ||
      !parsed.exploreNext.every((item): item is string => typeof item === "string")
    ) {
      return null;
    }
    return { shortAnswer: parsed.shortAnswer, context: parsed.context, explanation: parsed.explanation, exploreNext: parsed.exploreNext };
  } catch (err) {
    logger.error({ err }, "Anthropic askPassage call failed");
    return null;
  }
}
