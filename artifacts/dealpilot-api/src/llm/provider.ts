import Anthropic from "@anthropic-ai/sdk";
import {
  AiAnswerSchema,
  AiReviewSchema,
  answerQuestionDemo,
  BRAND,
  buildDemoReview,
  serializeContextForModel,
  STATEMENT_BASES,
  type AiAnswer,
  type AiReview,
  type AnalystContext,
} from "@workspace/dealpilot-core";
import type { AppConfig } from "../config";
import { logger } from "../lib/logger";

export type AnalystMode = "demo" | "live";

export interface AnalystProvider {
  readonly mode: AnalystMode;
  readonly provider: string;
  readonly model: string | null;
  review(ctx: AnalystContext): Promise<AiReview>;
  answer(question: string, ctx: AnalystContext): Promise<AiAnswer>;
}

/** Raised when a live provider call fails; the message is safe to show users. */
export class AnalystError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export class DemoAnalyst implements AnalystProvider {
  readonly mode = "demo" as const;
  readonly provider = "deterministic-demo";
  readonly model = null;
  async review(ctx: AnalystContext) {
    return buildDemoReview(ctx);
  }
  async answer(question: string, ctx: AnalystContext) {
    return answerQuestionDemo(question, ctx);
  }
}

const basisEnum = { type: "string", enum: [...STATEMENT_BASES] };
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const str = { type: "string" };

const REVIEW_JSON_SCHEMA = obj({
  summary: str,
  metricExplanations: { type: "array", items: obj({ metric: str, explanation: str, basis: basisEnum }) },
  financingNotes: str,
  risks: { type: "array", items: obj({ title: str, detail: str, severity: { type: "string", enum: ["high", "medium", "low"] }, basis: basisEnum }) },
  missingEvidence: { type: "array", items: obj({ item: str, whyItMatters: str }) },
  checklist: { type: "array", items: obj({ title: str, category: str }) },
  plainLanguageSummary: str,
});

const ANSWER_JSON_SCHEMA = obj({
  answer: str,
  basis: basisEnum,
  followUps: { type: "array", items: str },
});

const SYSTEM_PROMPT = `You are the investment analyst inside ${BRAND.name}, a decision-support tool for real estate investors.

You receive a JSON object containing the only facts you may rely on: user-supplied property details, the user's underwriting assumptions, results computed by a deterministic calculation engine, illustrative financing scenarios, and a list of evidence gaps.

Rules:
- Explain and interpret the provided numbers; never recalculate them differently or contradict the engine's results.
- Never invent property facts, comparable sales, rents, ownership, liens, title findings, zoning, taxes, crime, schools, flood zones, market trends or financing eligibility. If the user asks about something not in the data, say it is not in the data and name the kind of source that could verify it (county records, a licensed appraiser or agent, a title company, a lender, an attorney).
- Label every metric explanation, risk and answer with a basis: "calculated" (comes from the engine output), "user_supplied" (a user-entered fact), "assumption" (a user assumption that could be wrong), or "unverified_hypothesis" (your reasoning that has not been checked).
- If property.isSample is true, state that the data is fictional sample data.
- Financing scenarios are illustrative, not loan offers or approvals. Projections are not guarantees.
- Do not give legal, tax or lending advice; recommend the appropriate licensed professional instead.
- Write plainly for a newer investor. Keep each field concise. Return at most 8 metric explanations, 10 risks, 12 missing-evidence items and 15 checklist items.`;

export class AnthropicAnalyst implements AnalystProvider {
  readonly mode = "live" as const;
  readonly provider = "anthropic";
  private client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 2 });
  }

  private async callJson(userContent: string, schema: Record<string, unknown>): Promise<unknown> {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: { type: "json_schema", schema } },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        throw new AnalystError("The AI provider rejected the configured API key. Check ANTHROPIC_API_KEY.", false);
      }
      if (err instanceof Anthropic.NotFoundError) throw new AnalystError(`The configured model "${this.model}" was not found. Check DEALPILOT_LLM_MODEL.`, false);
      if (err instanceof Anthropic.BadRequestError) {
        logger.error({ err }, "Anthropic rejected the request");
        throw new AnalystError("The AI provider rejected the request.", false);
      }
      if (err instanceof Anthropic.RateLimitError) throw new AnalystError("The AI provider is rate limiting requests. Try again shortly.", true);
      if (err instanceof Anthropic.APIConnectionTimeoutError) throw new AnalystError("The AI provider timed out. Try again.", true);
      if (err instanceof Anthropic.APIConnectionError) throw new AnalystError("Could not reach the AI provider. Try again.", true);
      if (err instanceof Anthropic.APIError) throw new AnalystError(`The AI provider returned an error (${err.status ?? "unknown"}).`, true);
      throw err;
    }
    if (response.stop_reason === "refusal") throw new AnalystError("The AI provider declined to answer this request.", false);
    if (response.stop_reason === "max_tokens") throw new AnalystError("The AI response was cut off before it finished. Try again.", true);
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    try {
      return JSON.parse(text);
    } catch {
      throw new AnalystError("The AI response was not valid JSON.", true);
    }
  }

  async review(ctx: AnalystContext): Promise<AiReview> {
    const raw = await this.callJson(`Review this deal and fill every field.\n\nDATA:\n${serializeContextForModel(ctx)}`, REVIEW_JSON_SCHEMA);
    const parsed = AiReviewSchema.safeParse(trimLists(raw));
    if (!parsed.success) throw new AnalystError("The AI response did not match the expected structure.", true);
    return parsed.data;
  }

  async answer(question: string, ctx: AnalystContext): Promise<AiAnswer> {
    const raw = await this.callJson(`DATA:\n${serializeContextForModel(ctx)}\n\nUSER QUESTION:\n${question}`, ANSWER_JSON_SCHEMA);
    const parsed = AiAnswerSchema.safeParse(trimLists(raw));
    if (!parsed.success) throw new AnalystError("The AI response did not match the expected structure.", true);
    return parsed.data;
  }
}

/** Caps array lengths so a verbose model response still validates. */
function trimLists(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const limits: Record<string, number> = { metricExplanations: 12, risks: 15, missingEvidence: 15, checklist: 20, followUps: 4 };
  const out: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  for (const [k, n] of Object.entries(limits)) if (Array.isArray(out[k])) out[k] = (out[k] as unknown[]).slice(0, n);
  return out;
}

export function createAnalyst(config: AppConfig): AnalystProvider {
  return config.llm.apiKey ? new AnthropicAnalyst(config.llm.apiKey, config.llm.model) : new DemoAnalyst();
}
