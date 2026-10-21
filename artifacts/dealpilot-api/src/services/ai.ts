import { asc, eq } from "drizzle-orm";
import type { AiReview } from "@workspace/dealpilot-core";
import { dpAiMessage, type DpDb } from "@workspace/dealpilot-db";
import type { AnalystProvider } from "../llm/provider";
import { logActivity } from "./activity";
import type { DealContext } from "./deals";

export async function listAiMessages(db: DpDb, dealId: string) {
  return db.select().from(dpAiMessage).where(eq(dpAiMessage.dealId, dealId)).orderBy(asc(dpAiMessage.createdAt)).limit(200);
}

export async function createReview(db: DpDb, analyst: AnalystProvider, ctx: DealContext, userId: string, workflowRunId: string | null = null) {
  const review: AiReview = await analyst.review(ctx.analyst);
  const [row] = await db
    .insert(dpAiMessage)
    .values({
      dealId: ctx.deal.id,
      kind: "review",
      mode: analyst.mode,
      provider: analyst.provider,
      model: analyst.model,
      content: { ...review, assumptionVersion: ctx.assumptionVersion },
      workflowRunId,
    })
    .returning();
  await logActivity(db, {
    ownerId: userId,
    dealId: ctx.deal.id,
    type: "ai.review",
    message: `${analyst.mode === "live" ? "AI analyst" : "Demo analyst"} reviewed "${ctx.deal.name}".`,
  });
  return row;
}

export async function askQuestion(db: DpDb, analyst: AnalystProvider, ctx: DealContext, question: string) {
  const answer = await analyst.answer(question, ctx.analyst);
  return db.transaction(async (tx) => {
    const [q] = await tx.insert(dpAiMessage).values({ dealId: ctx.deal.id, kind: "question", mode: analyst.mode, provider: analyst.provider, model: analyst.model, content: { question } }).returning();
    const [a] = await tx
      .insert(dpAiMessage)
      .values({ dealId: ctx.deal.id, kind: "answer", mode: analyst.mode, provider: analyst.provider, model: analyst.model, content: { ...answer, assumptionVersion: ctx.assumptionVersion } })
      .returning();
    return { question: q, answer: a };
  });
}
