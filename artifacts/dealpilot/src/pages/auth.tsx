import { BRAND } from "@workspace/dealpilot-core";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Bot, FileText, ListChecks } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Redirect, useLocation, useSearch } from "wouter";
import { useMeta } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Callout } from "@/components/ui/primitives";
import { authClient, useSession } from "@/lib/auth-client";

function safeNext(search: string): string {
  const next = new URLSearchParams(search).get("next") ?? "/";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") && !next.startsWith("/signup") ? next : "/";
}

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { data: session, isPending } = useSession();
  const { data: meta } = useMeta();
  const search = useSearch();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"form" | "demo" | null>(null);
  const next = safeNext(search);

  if (!isPending && session?.user) return <Redirect to={next} />;

  const finish = () => {
    qc.clear();
    navigate(next);
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("form");
    const res =
      mode === "login"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: name.trim() || email.split("@")[0] });
    setBusy(null);
    if (res.error) {
      setError(res.error.message ?? "Sign-in failed. Check your details and try again.");
      return;
    }
    finish();
  }

  async function startDemo() {
    setError(null);
    setBusy("demo");
    const res = await authClient.signIn.anonymous();
    setBusy(null);
    if (res.error) {
      setError(res.error.message ?? "Could not start a demo workspace.");
      return;
    }
    finish();
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-navy-950 p-10 text-white lg:flex">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="size-9" />
          <span className="text-xl font-semibold">{BRAND.name}</span>
        </div>
        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-semibold leading-tight">{BRAND.tagline}</h1>
          <ul className="space-y-4 text-sm text-navy-100">
            <li className="flex gap-3">
              <BarChart3 className="size-5 shrink-0 text-accent-400" aria-hidden /> Deterministic, tested underwriting with every formula shown.
            </li>
            <li className="flex gap-3">
              <Bot className="size-5 shrink-0 text-accent-400" aria-hidden /> An AI analyst that explains your numbers and labels what is calculated, assumed or unverified.
            </li>
            <li className="flex gap-3">
              <ListChecks className="size-5 shrink-0 text-accent-400" aria-hidden /> Due-diligence checklists tailored to probate, foreclosure, auction, tax-sale and land deals.
            </li>
            <li className="flex gap-3">
              <FileText className="size-5 shrink-0 text-accent-400" aria-hidden /> Draft-only offer summaries and reports you can export to PDF or Word.
            </li>
          </ul>
        </div>
        <p className="max-w-lg text-xs leading-relaxed text-navy-200">{BRAND.disclaimer}</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <img src="/favicon.svg" alt="" className="size-8" />
            <span className="text-lg font-semibold text-navy-950">{BRAND.name}</span>
          </div>
          <h2 className="text-2xl font-semibold text-navy-950">{mode === "login" ? "Sign in" : "Create your account"}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {mode === "login" ? (
              <>
                New here?{" "}
                <Link href={`/signup${search ? `?${search}` : ""}`} className="font-medium text-navy-700 underline">
                  Create an account
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link href={`/login${search ? `?${search}` : ""}`} className="font-medium text-navy-700 underline">
                  Sign in
                </Link>
              </>
            )}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            {mode === "signup" && (
              <Field label="Name" htmlFor="name">
                <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            )}
            <Field label="Email" htmlFor="email" required>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" htmlFor="password" required hint={mode === "signup" ? "At least 10 characters." : undefined}>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "signup" ? 10 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={mode === "signup" ? "password-hint" : undefined}
              />
            </Field>
            {error && <Callout tone="error">{error}</Callout>}
            <Button type="submit" className="w-full" loading={busy === "form"} disabled={!email || !password || busy !== null}>
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {meta?.allowDemoAccounts !== false && (
            <div className="mt-6 border-t border-slate-200 pt-6">
              <Button variant="secondary" className="w-full" onClick={startDemo} loading={busy === "demo"} disabled={busy !== null}>
                Try a demo workspace
              </Button>
              <p className="mt-2 text-xs text-slate-500">Creates a private, temporary workspace with fictional sample properties. No email needed. Data is not linked to a real account.</p>
            </div>
          )}
          <p className="mt-8 text-xs text-slate-500">
            By continuing you agree to the{" "}
            <Link href="/public/legal/terms" className="underline">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/public/legal/privacy" className="underline">
              privacy notice
            </Link>{" "}
            (placeholders until reviewed by counsel).
          </p>
        </div>
      </section>
    </div>
  );
}
