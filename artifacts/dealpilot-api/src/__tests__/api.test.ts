import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AnalystError, DemoAnalyst, type AnalystProvider } from "../llm/provider";
import { binaryParser, buildApp, json, ORIGIN, setupDatabase, signUp, teardownDatabase, TEST_DB_URL, type Agent } from "./helpers";
import type { DpDb } from "@workspace/dealpilot-db";

const suite = TEST_DB_URL ? describe : describe.skip;

suite("DealPilot API (PostgreSQL integration)", () => {
  let db: DpDb;
  let app: ReturnType<typeof buildApp>;
  let alice: Agent;
  let bob: Agent;
  let dealId: string;
  let samplePropertyId: string;

  beforeAll(async () => {
    db = await setupDatabase();
    app = buildApp(db);
    alice = await signUp(app, "alice@example.com");
    bob = await signUp(app, "bob@example.com");
  });
  afterAll(teardownDatabase);

  describe("public and auth boundaries", () => {
    it("reports health", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "ok", database: "ok" });
    });
    it("exposes demo AI mode in meta", async () => {
      const res = await request(app).get("/api/meta");
      expect(res.body.aiMode).toBe("demo");
      expect(res.body.brand.name).toBe("DealPilot AI");
    });
    it("rejects unauthenticated access to private routes", async () => {
      expect((await request(app).get("/api/deals")).status).toBe(401);
      expect((await request(app).get("/api/properties")).status).toBe(401);
    });
    it("rejects state-changing requests from untrusted origins and non-JSON bodies", async () => {
      const evil = await alice.post("/api/properties").set("Origin", "https://evil.example").send({});
      expect(evil.status).toBe(403);
      const form = await alice.post("/api/properties").set("Origin", ORIGIN).type("form").send("title=x");
      expect(form.status).toBe(415);
    });
    it("rejects weak passwords via Better Auth", async () => {
      const res = await request(app).post("/api/auth/sign-up/email").set("Origin", ORIGIN).send({ email: "weak@example.com", password: "short", name: "w" });
      expect(res.status).toBe(400);
    });
    it("creates isolated anonymous demo workspaces", async () => {
      const agent = request.agent(app);
      const res = await agent.post("/api/auth/sign-in/anonymous").set("Origin", ORIGIN).send({});
      expect(res.status).toBe(200);
      const me = await agent.get("/api/me");
      expect(me.body.user.isAnonymous).toBe(true);
      expect((await agent.get("/api/deals")).body.items).toEqual([]);
    });
  });

  describe("properties", () => {
    it("lists the labelled sample catalog with pagination", async () => {
      const res = await json(alice).get("/api/properties?pageSize=4");
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(10);
      expect(res.body.items).toHaveLength(4);
      expect(res.body.totalPages).toBe(3);
      expect(res.body.items.every((p: { isSample: boolean; sourceStatus: string }) => p.isSample && p.sourceStatus === "demo")).toBe(true);
      samplePropertyId = res.body.items[0].id;
    });
    it("filters by category, price and text search and sorts", async () => {
      const land = await json(alice).get("/api/properties?propertyType=land");
      expect(land.body.total).toBe(2);
      const cheap = await json(alice).get("/api/properties?maxPrice=50000&sort=price_asc");
      expect(cheap.body.items.map((p: { listPrice: number }) => p.listPrice)).toEqual([4500, 38000]);
      const search = await json(alice).get("/api/properties?q=duplex");
      expect(search.body.total).toBe(1);
      const bad = await json(alice).get("/api/properties?sort=nope");
      expect(bad.status).toBe(400);
    });
    it("validates manual entry", async () => {
      const res = await json(alice).post("/api/properties", { title: "" });
      expect(res.status).toBe(400);
      expect(res.body.details.fieldErrors).toHaveProperty("title");
    });
    it("creates, edits and archives a manual property visible only to its owner", async () => {
      const created = await json(alice).post("/api/properties", {
        title: "Alice lead",
        addressLine: "5 Real St",
        city: "Akron",
        state: "OH",
        category: "motivated_seller",
        propertyType: "single_family",
        listPrice: 120000,
        estimatedRentMonthly: 1400,
        sourceName: "Driving for dollars",
      });
      expect(created.status).toBe(201);
      expect(created.body.sourceStatus).toBe("manual_entry");
      expect(created.body.latestSource.sourceName).toBe("Driving for dollars");
      const id = created.body.id;
      expect((await json(bob).get(`/api/properties/${id}`)).status).toBe(404);
      expect((await json(bob).patch(`/api/properties/${id}`, { title: "pwned" })).status).toBe(404);
      const edited = await json(alice).patch(`/api/properties/${id}`, { title: "Alice lead (edited)" });
      expect(edited.body.title).toBe("Alice lead (edited)");
      await json(alice).post(`/api/properties/${id}/archive`);
      const list = await json(alice).get("/api/properties?sourceStatus=manual_entry");
      expect(list.body.total).toBe(0);
      const withArchived = await json(alice).get("/api/properties?sourceStatus=manual_entry&includeArchived=true");
      expect(withArchived.body.total).toBe(1);
    });
    it("keeps the sample catalog read-only", async () => {
      const res = await json(alice).patch(`/api/properties/${samplePropertyId}`, { title: "edited" });
      expect(res.status).toBe(403);
    });
    it("imports CSV with a dry run and row errors", async () => {
      const csv = "address,city,state,price,rent,category\n10 A St,Canton,OH,90000,1100,probate\n,Canton,OH,1,1,on_market\n";
      const dry = await json(alice).post("/api/properties/import", { csv, dryRun: true });
      expect(dry.body).toMatchObject({ validCount: 1, createdIds: [] });
      expect(dry.body.errors[0].row).toBe(3);
      const real = await json(alice).post("/api/properties/import", { csv });
      expect(real.status).toBe(201);
      expect(real.body.createdIds).toHaveLength(1);
      const imported = await json(alice).get(`/api/properties/${real.body.createdIds[0]}`);
      expect(imported.body.sourceStatus).toBe("user_imported");
    });
    it("rejects malformed ids as not found", async () => {
      expect((await json(alice).get("/api/properties/not-a-uuid")).status).toBe(404);
    });
  });

  describe("deals, underwriting and financing", () => {
    it("saving a sample creates a private editable copy and default scenarios", async () => {
      const res = await json(alice).post("/api/deals", { propertyId: samplePropertyId });
      expect(res.status).toBe(201);
      dealId = res.body.id;
      const detail = await json(alice).get(`/api/deals/${dealId}`);
      expect(detail.status).toBe(200);
      expect(detail.body.property.isSample).toBe(true);
      expect(detail.body.property.id).not.toBe(samplePropertyId);
      expect(detail.body.assumptionVersion).toBe(1);
      expect(detail.body.underwriting.formulas.length).toBeGreaterThan(5);
      expect(detail.body.scenarios.length).toBeGreaterThanOrEqual(1);
      expect(detail.body.evidenceGaps[0].key).toBe("sample_data");
    });
    it("isolates deals between users", async () => {
      expect((await json(bob).get(`/api/deals/${dealId}`)).status).toBe(404);
      expect((await json(bob).put(`/api/deals/${dealId}/assumptions`, {})).status).toBe(404);
      expect((await json(bob).get(`/api/deals/${dealId}/tasks`)).status).toBe(404);
      expect((await json(bob).get("/api/deals")).body.items).toEqual([]);
    });
    it("versions assumptions and validates input", async () => {
      const current = (await json(alice).get(`/api/deals/${dealId}`)).body.assumptions;
      const bad = await json(alice).put(`/api/deals/${dealId}/assumptions`, { ...current, vacancyRatePct: 150 });
      expect(bad.status).toBe(400);
      expect(bad.body.details.fieldErrors).toHaveProperty("vacancyRatePct");
      const ok = await json(alice).put(`/api/deals/${dealId}/assumptions`, { ...current, insuranceAnnual: 1500, monthlyRent: 2400 });
      expect(ok.status).toBe(200);
      expect(ok.body.version).toBe(2);
      expect(ok.body.underwriting.operating.expenses.insuranceMonthly).toBe(125);
      const history = await json(alice).get(`/api/deals/${dealId}/underwriting`);
      expect(history.body.items.length).toBe(2);
    });
    it("creates, updates and deletes financing scenarios", async () => {
      const created = await json(alice).post(`/api/deals/${dealId}/financing-scenarios`, {
        kind: "seller",
        name: "Seller carry",
        downPaymentPct: 10,
        interestRatePct: 5,
        termYears: 5,
        amortizationYears: 30,
        balloonYears: 5,
      });
      expect(created.status).toBe(201);
      const list = await json(alice).get(`/api/deals/${dealId}/financing-scenarios`);
      const seller = list.body.items.find((s: { id: string }) => s.id === created.body.id);
      expect(seller.result.loans[0].balloonBalance).toBeGreaterThan(0);
      expect(seller.result.disclaimer).toMatch(/not a loan offer/);
      const updated = await json(alice).put(`/api/deals/${dealId}/financing-scenarios/${created.body.id}`, { ...seller.params, name: "Seller carry 6%", interestRatePct: 6 });
      expect(updated.body.name).toBe("Seller carry 6%");
      expect((await json(bob).delete(`/api/deals/${dealId}/financing-scenarios/${created.body.id}`)).status).toBe(404);
      expect((await json(alice).delete(`/api/deals/${dealId}/financing-scenarios/${created.body.id}`)).status).toBe(204);
    });
    it("moves stages and archives/restores", async () => {
      await json(alice).patch(`/api/deals/${dealId}`, { stage: "under_contract" });
      await json(alice).post(`/api/deals/${dealId}/archive`);
      expect((await json(alice).get("/api/deals")).body.items).toHaveLength(0);
      expect((await json(alice).get("/api/deals?archived=true")).body.items).toHaveLength(1);
      await json(alice).post(`/api/deals/${dealId}/restore`);
      const items = (await json(alice).get("/api/deals")).body.items;
      expect(items[0].stage).toBe("under_contract");
      expect(items[0].headline.purchasePrice).toBeGreaterThan(0);
    });
  });

  describe("workflow, AI, tasks, offers and documents", () => {
    it("runs the workflow to review, then completes on approval", async () => {
      const run = await json(alice).post(`/api/deals/${dealId}/analyze`);
      expect(run.status).toBe(201);
      expect(run.body.status).toBe("needs_review");
      expect(run.body.aiMode).toBe("demo");
      const statuses = Object.fromEntries(run.body.steps.map((s: { key: string; status: string }) => [s.key, s.status]));
      expect(statuses).toMatchObject({ validate_inputs: "completed", gather_sources: "completed", run_calculations: "completed", ai_explanation: "completed", create_tasks: "completed", present_review: "waiting", save_report: "pending" });
      const tasks = await json(alice).get(`/api/deals/${dealId}/tasks`);
      expect(tasks.body.items.length).toBeGreaterThan(5);
      const ai = await json(alice).get(`/api/deals/${dealId}/ai-messages`);
      expect(ai.body.items[0]).toMatchObject({ kind: "review", mode: "demo" });
      const approved = await json(alice).post(`/api/workflow-runs/${run.body.id}/approve`);
      expect(approved.body.status).toBe("completed");
      const docs = await json(alice).get(`/api/deals/${dealId}/documents`);
      expect(docs.body.items[0].kind).toBe("investment_report");
      expect((await json(bob).get(`/api/workflow-runs/${run.body.id}`)).status).toBe(404);
      expect((await json(alice).post(`/api/workflow-runs/${run.body.id}/approve`)).status).toBe(409);
    });
    it("re-running does not duplicate generated tasks", async () => {
      const before = (await json(alice).get(`/api/deals/${dealId}/tasks`)).body.items.length;
      await json(alice).post(`/api/deals/${dealId}/analyze`);
      expect((await json(alice).get(`/api/deals/${dealId}/tasks`)).body.items.length).toBe(before);
    });
    it("stops at Needs Input when required inputs are missing", async () => {
      const current = (await json(alice).get(`/api/deals/${dealId}`)).body.assumptions;
      await json(alice).put(`/api/deals/${dealId}/assumptions`, { ...current, monthlyRent: 0 });
      const run = await json(alice).post(`/api/deals/${dealId}/analyze`);
      expect(run.body.status).toBe("needs_input");
      expect(run.body.steps[0].output.missing[0].field).toBe("monthlyRent");
      await json(alice).put(`/api/deals/${dealId}/assumptions`, { ...current });
      const retried = await json(alice).post(`/api/workflow-runs/${run.body.id}/retry`);
      expect(retried.body.status).toBe("needs_review");
      expect(retried.body.attempts).toBe(2);
    });
    it("answers questions in demo mode without inventing external facts", async () => {
      const res = await json(alice).post(`/api/deals/${dealId}/ai-chat`, { question: "What zoning applies here?" });
      expect(res.status).toBe(201);
      expect(res.body.answer.content.basis).toBe("unverified_hypothesis");
      expect(res.body.answer.mode).toBe("demo");
      expect((await json(alice).post(`/api/deals/${dealId}/ai-chat`, { question: "x" })).status).toBe(400);
    });
    it("manages tasks", async () => {
      const created = await json(alice).post(`/api/deals/${dealId}/tasks`, { title: "Call the county", priority: "high", dueDate: "2026-11-01" });
      expect(created.status).toBe(201);
      const done = await json(alice).patch(`/api/deals/${dealId}/tasks/${created.body.id}`, { status: "done" });
      expect(done.body.status).toBe("done");
      expect((await json(alice).patch(`/api/deals/${dealId}/tasks/${created.body.id}`, { dueDate: "soon" })).status).toBe(400);
      expect((await json(alice).delete(`/api/deals/${dealId}/tasks/${created.body.id}`)).status).toBe(204);
    });
    it("versions offer drafts and exports PDF and DOCX", async () => {
      const first = await json(alice).get(`/api/deals/${dealId}/offer-drafts`);
      expect(first.body.items).toEqual([]);
      const terms = first.body.suggestedTerms;
      expect(terms.buyerName).toBe("[Buyer name]");
      const v1 = await json(alice).post(`/api/deals/${dealId}/offer-drafts`, { terms, checklist: { numbers_reviewed: true } });
      expect(v1.body.version).toBe(1);
      const v2 = await json(alice).post(`/api/deals/${dealId}/offer-drafts`, { terms: { ...terms, proposedPrice: terms.proposedPrice - 5000 } });
      expect(v2.body.version).toBe(2);
      expect((await json(alice).post(`/api/deals/${dealId}/offer-drafts`, { terms: { ...terms, closingDate: "tomorrow" } })).status).toBe(400);

      const pdfDoc = await json(alice).post(`/api/offer-drafts/${v2.body.id}/documents`, { format: "pdf" });
      const pdf = await alice.get(`/api/documents/${pdfDoc.body.id}/download`).buffer(true).parse(binaryParser);
      expect(pdf.status).toBe(200);
      expect(pdf.headers["content-type"]).toBe("application/pdf");
      expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");

      const docxDoc = await json(alice).post(`/api/offer-drafts/${v2.body.id}/documents`, { format: "docx" });
      const docx = await alice.get(`/api/documents/${docxDoc.body.id}/download`).buffer(true).parse(binaryParser);
      expect((docx.body as Buffer).subarray(0, 2).toString()).toBe("PK");

      const report = await json(alice).post(`/api/deals/${dealId}/reports`, { format: "docx" });
      expect(report.status).toBe(201);
      expect((await json(bob).get(`/api/documents/${report.body.id}/download`)).status).toBe(404);
      expect((await json(bob).post(`/api/offer-drafts/${v2.body.id}/documents`, { format: "pdf" })).status).toBe(404);

      const snapshot = await json(alice).get(`/api/documents/${pdfDoc.body.id}`);
      expect(snapshot.body.snapshot.version).toBe(2);
    });
  });

  describe("AI provider failures", () => {
    it("fails the workflow with a clear message and resumes on retry", async () => {
      const failing: AnalystProvider = {
        mode: "live",
        provider: "test",
        model: "test-model",
        review: async () => {
          throw new AnalystError("The AI provider timed out. Try again.", true);
        },
        answer: async () => {
          throw new AnalystError("The AI provider timed out. Try again.", true);
        },
      };
      const failingApp = buildApp(db, failing);
      const carol = await signUp(failingApp, "carol@example.com");
      const props = await json(carol).get("/api/properties?q=duplex");
      const deal = await json(carol).post("/api/deals", { propertyId: props.body.items[0].id });
      const run = await json(carol).post(`/api/deals/${deal.body.id}/analyze`);
      expect(run.body.status).toBe("failed");
      expect(run.body.error).toMatch(/timed out/);
      expect(run.body.steps.find((s: { key: string }) => s.key === "ai_explanation").status).toBe("failed");
      const chat = await json(carol).post(`/api/deals/${deal.body.id}/ai-chat`, { question: "Explain the cap rate" });
      expect(chat.status).toBe(503);

      // Same database, working analyst: retry resumes at the failed step.
      const okApp = buildApp(db, new DemoAnalyst());
      const carolOk = request.agent(okApp);
      await carolOk.post("/api/auth/sign-in/email").set("Origin", ORIGIN).send({ email: "carol@example.com", password: "correct-horse-battery" });
      const retried = await json(carolOk).post(`/api/workflow-runs/${run.body.id}/retry`);
      expect(retried.body.status).toBe("needs_review");
      expect(retried.body.steps.find((s: { key: string }) => s.key === "validate_inputs").status).toBe("completed");
    });
  });

  describe("account", () => {
    it("exposes integration status honestly", async () => {
      const res = await json(alice).get("/api/integrations/status");
      const byId = Object.fromEntries(res.body.integrations.map((i: { id: string; state: string }) => [i.id, i.state]));
      expect(byId).toMatchObject({ database: "connected", llm: "not_configured", listings: "not_configured", billing: "not_configured" });
    });
    it("saves preferences and hides samples when disabled", async () => {
      const prefs = await json(bob).put("/api/preferences", { showSampleData: false, defaultVacancyRatePct: 8, defaultInterestRatePct: 7, defaultDownPaymentPct: 20 });
      expect(prefs.body.showSampleData).toBe(false);
      expect((await json(bob).get("/api/properties")).body.total).toBe(0);
    });
    it("supports saved searches", async () => {
      const created = await json(alice).post("/api/saved-searches", { name: "Cheap land", filters: { propertyType: "land", maxPrice: 50000 } });
      expect(created.status).toBe(201);
      expect((await json(bob).delete(`/api/saved-searches/${created.body.id}`)).status).toBe(404);
      expect((await json(alice).get("/api/saved-searches")).body.items).toHaveLength(1);
    });
    it("summarises the dashboard", async () => {
      const res = await json(alice).get("/api/dashboard");
      expect(res.body.savedDeals).toBe(1);
      expect(res.body.sampleDeals).toBe(1);
      expect(res.body.draftOffers).toBe(2);
      expect(res.body.recentActivity.length).toBeGreaterThan(0);
    });
    it("exports and then deletes all user data", async () => {
      const exp = await json(alice).get("/api/account/export");
      expect(exp.body.deals).toHaveLength(1);
      expect(exp.body.offerDrafts).toHaveLength(2);
      expect(JSON.stringify(exp.body)).not.toMatch(/password/i);
      expect((await json(alice).delete("/api/account", { confirm: "nope" })).status).toBe(400);
      expect((await json(alice).delete("/api/account", { confirm: "DELETE" })).status).toBe(204);
      expect((await json(alice).get("/api/deals")).status).toBe(401);
      // The shared catalog survives.
      expect((await json(bob).put("/api/preferences", { showSampleData: true })).status).toBe(200);
      expect((await json(bob).get("/api/properties")).body.total).toBe(10);
    });
  });
});
