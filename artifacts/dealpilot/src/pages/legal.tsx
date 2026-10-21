import { BRAND } from "@workspace/dealpilot-core";
import { Link, useParams } from "wouter";
import { Callout, Card, CardBody } from "@/components/ui/primitives";

const PAGES: Record<string, { title: string; placeholder: boolean; body: string[] }> = {
  disclaimer: {
    title: "Real estate & AI disclaimer",
    placeholder: false,
    body: [
      BRAND.disclaimer,
      "Calculations are deterministic estimates based only on the assumptions you enter. They are not appraisals, broker price opinions, loan offers, or legal, tax or investment advice.",
      "Financing scenarios are illustrative. They do not represent a loan offer, pre-approval or statement of eligibility from any lender or seller.",
      "The AI analyst explains the data you provide. It does not have access to listings, public records, title, zoning or market data. When no AI provider is configured, the analyst runs in a clearly labelled demo mode that uses fixed templates.",
      "Sample properties are fictional and labelled “" + BRAND.sampleLabel + "”.",
      "Offer documents are drafts marked “" + BRAND.draftLabel + "”. The app never submits offers, contacts sellers or creates binding signatures. Use a licensed professional and the forms required in your jurisdiction.",
    ],
  },
  privacy: {
    title: "Privacy notice",
    placeholder: true,
    body: [
      "We store the account details you provide (name, email, and a password hash managed by our authentication library), plus the properties, deals, analyses, tasks, offer drafts and documents you create.",
      "If an AI provider is configured, the property details, assumptions and calculated results for the deal you are analysing are sent to that provider to generate explanations. API keys stay on the server.",
      "You can export all of your data as JSON or permanently delete your account from Settings.",
      "We do not sell personal data and do not collect payment card details.",
    ],
  },
  terms: {
    title: "Terms of use",
    placeholder: true,
    body: [
      "Use the service only with data you have the right to use, and comply with the terms of any data source you import from.",
      "Do not use the service to make automated or unreviewed real estate decisions, to contact sellers on someone else's behalf, or to misrepresent drafts as binding offers.",
      "The service is provided “as is” without warranties. You are responsible for independently verifying all information before acting on it.",
    ],
  },
};

export default function LegalPage() {
  const { page } = useParams<{ page: string }>();
  const content = PAGES[page] ?? PAGES.disclaimer;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-navy-950">{content.title}</h1>
      {content.placeholder && (
        <Callout tone="warning" className="mt-4" title="Placeholder">
          This text is a starting point and has not been reviewed by a lawyer. Replace it before launching publicly.
        </Callout>
      )}
      <Card className="mt-6">
        <CardBody className="space-y-4 text-sm leading-relaxed text-slate-800">
          {content.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </CardBody>
      </Card>
      <p className="mt-6 text-sm">
        <Link href="/" className="text-navy-700 underline">
          Back to {BRAND.name}
        </Link>
      </p>
    </div>
  );
}
