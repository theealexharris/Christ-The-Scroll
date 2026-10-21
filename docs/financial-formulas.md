# Financial formulas

Source of truth: `lib/dealpilot-core/src/underwriting.ts`, `amortization.ts` and `financing.ts`. Tests: `lib/dealpilot-core/src/__tests__/`.

## Units and conventions

- All money is **USD**. A field's name says whether it is monthly (`…Monthly`) or annual (`…Annual`). The UI shows both.
- Percentages are entered as 0–100 (`6.5` means 6.5%). Rates are nominal annual rates, compounded monthly.
- Stored results are rounded to cents. Ratios and percentages are rounded to 2 decimals after the calculation.
- A metric that can't be calculated (its denominator is zero or missing) is returned as `null` and shown as "—", never as NaN or Infinity.

## Acquisition

| Output | Formula |
|---|---|
| Total acquisition cost | purchase price + closing costs + renovation costs |
| Loan amount | purchase price × (1 − down payment %) when financing is on, else 0 |
| Down payment | purchase price − loan amount |
| Total cash required | down payment + closing costs + renovation costs + loan fees |

Renovation is assumed to be paid in cash (it is not financed).

## Income and expenses (monthly)

| Output | Formula |
|---|---|
| Gross scheduled income (GSI) | monthly rent + other monthly income |
| Vacancy loss | GSI × vacancy % |
| Effective gross income (EGI) | GSI − vacancy loss |
| Taxes | annual taxes ÷ 12 |
| Insurance | annual insurance ÷ 12 |
| Maintenance | **rent** × maintenance % |
| Capex reserve | **rent** × capex % |
| Management | **EGI** × management % |
| Operating expenses | taxes + insurance + HOA + maintenance + capex + management + utilities + other |
| NOI | EGI − operating expenses (before debt service). Annual NOI = monthly × 12 |

## Debt

Fully amortizing payment: `P × r / (1 − (1 + r)^−n)`, where `r` = annual rate ÷ 12 and `n` = amortization years × 12. At 0% the payment is `P ÷ n`. Interest-only payment is `P × r`.

Remaining balance after `k` payments: `P(1+r)^k − pmt × ((1+r)^k − 1) ÷ r` (straight-line at 0%). `k` is capped at `n`.

When the loan term is shorter than the amortization, the balance at maturity is reported as a balloon payment.

## Returns

| Metric | Formula | Null when |
|---|---|---|
| Cash flow | NOI − debt service (monthly and annual) | — |
| Cap rate | annual NOI ÷ purchase price | price ≤ 0 |
| Cap rate on cost | annual NOI ÷ total acquisition cost | cost ≤ 0 |
| Cash-on-cash | annual cash flow ÷ total cash required | cash required ≤ 0 |
| DSCR | annual NOI ÷ annual debt service | no debt |
| Break-even occupancy | (operating expenses − management + debt service) ÷ (GSI × (1 − management %)) | GSI ≤ 0 or management ≥ 100% |
| Expense ratio | operating expenses ÷ EGI | EGI ≤ 0 |
| Gross rent multiplier | price ÷ (rent × 12) | rent ≤ 0 |

Break-even occupancy treats management as the only expense that scales with collected rent. Maintenance and capex are budgeted on scheduled rent, so they count as fixed. A result above 100% raises a warning.

## Exit scenario (illustrative)

- Base value = after-repair value if entered, else purchase price
- Projected value = base × (1 + appreciation %)^hold years
- Equity at exit = projected value − selling costs (projected value × selling %) − remaining loan balance
- Total profit = equity at exit + (annual cash flow × hold years) − total cash required

Rents and expenses are held flat. This is not a forecast.

## Financing scenarios

Every scenario reuses the deal's NOI, closing costs and renovation costs.

| Kind | Structure |
|---|---|
| Cash | No loans. Cash to close = price + closing + renovation |
| Conventional | One loan of price × (1 − down %). Lender fees = loan × fee % |
| DSCR-style | Same as conventional, with an optional illustrative minimum DSCR. A warning appears when DSCR is below it |
| Seller | One seller note of price × (1 − down %), optional balloon, no lender fees |
| Hybrid | Bank first lien of price × (1 − down % − seller carry %), plus a seller second lien of price × carry %. Fees apply to the bank loan only. Down + carry > 100% is an error |

Outputs: each loan's payment and balloon balance, down payment, fees, cash to close, monthly and annual debt service, cash flow, DSCR and cash-on-cash. Every scenario carries the disclaimer: *not a loan offer, pre-approval or statement of eligibility.*

## Validation and warnings

Inputs are checked by Zod (`DealAssumptionsSchema`): non-negative money, 0–100%, rates up to 30%, terms up to 50 years.

Soft warnings:

- **error** (blocks the workflow at *Needs Input*): price is 0, rent is 0, financing has no amortization.
- **warning**: price under $10k, rent over 3% of price, taxes or insurance at $0, vacancy over 50%, rate over 15% or 0%, negative cash flow, DSCR below 1.0, cap rate over 15%, break-even over 100%.
- **info**: 0% vacancy, no reserves, DSCR below 1.20, balloon due, ARV below cost.
