import * as React from "react";
import { cn } from "@/lib/utils";

const controlBase =
  "block w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 disabled:cursor-not-allowed disabled:bg-slate-100";

type FieldProps = {
  label: React.ReactNode;
  htmlFor: string;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** Label + control + hint/error with ARIA wiring handled by the caller via ids. */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
        {required && (
          <span className="text-red-700" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, error?: string, hint?: unknown) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(({ className, invalid, ...props }, ref) => (
  <input ref={ref} aria-invalid={invalid || undefined} className={cn(controlBase, "h-10", invalid ? "border-red-500" : "border-slate-300", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(({ className, invalid, ...props }, ref) => (
  <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(controlBase, "min-h-24 py-2", invalid ? "border-red-500" : "border-slate-300", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(({ className, invalid, children, ...props }, ref) => (
  <select ref={ref} aria-invalid={invalid || undefined} className={cn(controlBase, "h-10 pr-8", invalid ? "border-red-500" : "border-slate-300", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export function Checkbox({ id, label, checked, onChange, description, disabled }: { id: string; label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; description?: React.ReactNode; disabled?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-slate-300 text-navy-900 accent-navy-900"
      />
      <label htmlFor={id} className="text-sm text-slate-800">
        {label}
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </label>
    </div>
  );
}

/** Numeric input bound to a number (or null). Keeps the raw text while typing. */
export function NumberInput({
  id,
  value,
  onValueChange,
  prefix,
  suffix,
  invalid,
  step,
  min,
  max,
  allowNull,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "prefix"> & {
  id: string;
  value: number | null;
  onValueChange: (v: number | null) => void;
  prefix?: string;
  suffix?: string;
  invalid?: boolean;
  allowNull?: boolean;
}) {
  const [text, setText] = React.useState(value === null || value === undefined ? "" : String(value));
  React.useEffect(() => {
    const parsed = text.trim() === "" ? null : Number(text);
    if (parsed !== value) setText(value === null || value === undefined ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">{prefix}</span>}
      <Input
        id={id}
        inputMode="decimal"
        type="number"
        step={step ?? "any"}
        min={min}
        max={max}
        value={text}
        invalid={invalid}
        className={cn("tabular", prefix && "pl-7", suffix && "pr-12")}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim() === "") onValueChange(allowNull ? null : 0);
          else {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onValueChange(n);
          }
        }}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">{suffix}</span>}
    </div>
  );
}
