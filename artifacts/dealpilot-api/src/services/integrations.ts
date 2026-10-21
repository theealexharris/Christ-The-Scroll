import type { AppConfig } from "../config";

export type IntegrationState = "connected" | "not_configured" | "error";

export type IntegrationStatus = {
  id: string;
  name: string;
  purpose: string;
  state: IntegrationState;
  detail: string;
  envVars: string[];
  fallback: string;
};

/**
 * Reports configuration honestly. "connected" means the adapter is configured
 * *and* implemented in this build; credentials alone for an unimplemented
 * adapter are reported as not configured with an explanation.
 */
export function integrationStatuses(config: AppConfig, health: { databaseOk: boolean; databaseError?: string }): IntegrationStatus[] {
  return [
    {
      id: "database",
      name: "PostgreSQL",
      purpose: "Stores accounts, properties, deals, analyses and documents.",
      state: health.databaseOk ? "connected" : "error",
      detail: health.databaseOk ? "Connected and migrations applied." : `Database check failed: ${health.databaseError ?? "unknown error"}`,
      envVars: ["DATABASE_URL"],
      fallback: "None — the app requires a database.",
    },
    {
      id: "auth",
      name: "Authentication (Better Auth)",
      purpose: "Email/password accounts and isolated demo workspaces.",
      state: config.authSecretIsEphemeral ? "error" : "connected",
      detail: config.authSecretIsEphemeral
        ? "BETTER_AUTH_SECRET is not set; a temporary secret is in use and sessions reset when the server restarts. Set it before deploying."
        : `Enabled. Demo workspaces are ${config.allowDemoAccounts ? "allowed" : "disabled"}. Email verification and password reset email are not configured.`,
      envVars: ["BETTER_AUTH_SECRET", "DEALPILOT_APP_URL", "DEALPILOT_ALLOW_DEMO_ACCOUNTS"],
      fallback: "Development only: an ephemeral secret.",
    },
    {
      id: "llm",
      name: "AI analyst (Anthropic Claude)",
      purpose: "Explains underwriting results, compares financing and flags missing evidence.",
      state: config.llm.apiKey ? "connected" : "not_configured",
      detail: config.llm.apiKey
        ? `Configured with model ${config.llm.model}. Calls happen server-side only. The key has not been verified until the first AI request succeeds.`
        : "No ANTHROPIC_API_KEY set. The AI panel runs in clearly labelled demo mode with deterministic, template-based explanations.",
      envVars: ["ANTHROPIC_API_KEY", "DEALPILOT_LLM_MODEL"],
      fallback: "Deterministic demo analyst (labelled “Demo mode”).",
    },
    {
      id: "listings",
      name: "Property listings / public records / auctions",
      purpose: "Live on-market, probate, foreclosure, auction and tax-sale data.",
      state: "not_configured",
      detail: "No licensed listing or public-records provider adapter is implemented in this build. Use manual entry or CSV import of data you are permitted to use.",
      envVars: [],
      fallback: "Manual entry, CSV import and fictional sample data.",
    },
    {
      id: "rent_comps",
      name: "Rent & comparable-sales data",
      purpose: "Rent estimates and sales comparables to support assumptions.",
      state: "not_configured",
      detail: config.integrationKeys.rentcast
        ? "RENTCAST_API_KEY is set, but no rent-data adapter is implemented yet, so it is not used."
        : "No provider adapter implemented. Enter rent and comps evidence manually.",
      envVars: ["RENTCAST_API_KEY (reserved)"],
      fallback: "User-entered rent with evidence level tracking.",
    },
    {
      id: "maps",
      name: "Geocoding & maps",
      purpose: "Map display and address normalization.",
      state: "not_configured",
      detail: config.integrationKeys.mapbox ? "MAPBOX_TOKEN is set, but the map adapter is not implemented yet." : "Not implemented in this build.",
      envVars: ["MAPBOX_TOKEN (reserved)"],
      fallback: "Addresses are shown as entered.",
    },
    {
      id: "email",
      name: "Email",
      purpose: "Password reset, verification and notifications.",
      state: "not_configured",
      detail: config.integrationKeys.resend ? "RESEND_API_KEY is set, but email sending is not implemented yet." : "Not implemented in this build. Offers are never emailed automatically.",
      envVars: ["RESEND_API_KEY (reserved)"],
      fallback: "No email is sent.",
    },
    {
      id: "billing",
      name: "Billing (Stripe)",
      purpose: "Subscriptions, when pricing is approved.",
      state: "not_configured",
      detail: "Billing is disabled by default and not implemented. No payment details are collected or stored.",
      envVars: ["STRIPE_SECRET_KEY (reserved)", "STRIPE_WEBHOOK_SECRET (reserved)"],
      fallback: "All features available without billing.",
    },
  ];
}
