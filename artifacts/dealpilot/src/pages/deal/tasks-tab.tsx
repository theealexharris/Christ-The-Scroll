import { TASK_PRIORITIES, TASK_STATUSES } from "@workspace/dealpilot-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Task["status"], string> = { open: "Open", in_progress: "In progress", done: "Done", not_applicable: "N/A" };

export function TasksTab({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const key = ["tasks", dealId];
  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => api.get<{ items: Task[] }>(`/api/deals/${dealId}/tasks`) });
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [category, setCategory] = useState("General");
  const [dueDate, setDueDate] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const create = useMutation({
    mutationFn: () => api.post<Task>(`/api/deals/${dealId}/tasks`, { title, priority, category, dueDate: dueDate || null }),
    onSuccess: () => {
      setTitle("");
      setDueDate("");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Task> }) => api.patch<Task>(`/api/deals/${dealId}/tasks/${id}`, patch),
    // Optimistic so checkboxes respond immediately; rolled back on error.
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<{ items: Task[] }>(key);
      if (previous) qc.setQueryData(key, { items: previous.items.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(errorMessage(err));
    },
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/deals/${dealId}/tasks/${id}`),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <LoadingBlock rows={4} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const items = data.items.filter((t) => (filter === "all" ? true : filter === "done" ? t.status === "done" || t.status === "not_applicable" : t.status === "open" || t.status === "in_progress"));
  const doneCount = data.items.filter((t) => t.status === "done" || t.status === "not_applicable").length;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (title.trim()) create.mutate();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Due-diligence checklist"
          description="Generated items come from the analysis workflow based on property type, opportunity category and missing evidence. Add your own as needed."
          actions={
            <span className="text-sm text-slate-600">
              {doneCount} of {data.items.length} complete
            </span>
          }
        />
        <CardBody className="space-y-4">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
            <Field label="New task" htmlFor="task-title">
              <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Call the county about permits" />
            </Field>
            <Field label="Category" htmlFor="task-cat">
              <Input id="task-cat" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} className="sm:w-36" />
            </Field>
            <Field label="Priority" htmlFor="task-priority">
              <Select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due" htmlFor="task-due">
              <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Button type="submit" disabled={!title.trim()} loading={create.isPending}>
              <Plus /> Add
            </Button>
          </form>
          <div className="flex gap-1" role="group" aria-label="Filter tasks">
            {(["open", "done", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn("rounded-md px-3 py-1 text-sm capitalize", filter === f ? "bg-navy-900 text-white" : "text-slate-700 hover:bg-slate-100")}
              >
                {f}
              </button>
            ))}
          </div>
          {items.length === 0 ? (
            <EmptyState
              icon={<ListChecks />}
              title={data.items.length === 0 ? "No tasks yet" : "Nothing here"}
              description={data.items.length === 0 ? "Run the analysis workflow to generate a checklist, or add tasks above." : "Change the filter to see other tasks."}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((t) => (
                <li key={t.id} className="flex flex-wrap items-start gap-3 py-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-navy-900"
                    checked={t.status === "done"}
                    aria-label={`Mark “${t.title}” ${t.status === "done" ? "not done" : "done"}`}
                    onChange={(e) => update.mutate({ id: t.id, patch: { status: e.target.checked ? "done" : "open" } })}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", t.status === "done" ? "text-slate-500 line-through" : "text-slate-900")}>{t.title}</p>
                    {t.detail && <p className="mt-0.5 text-xs text-slate-600">{t.detail}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <Badge tone="slate">{t.category}</Badge>
                      <Badge tone={t.priority === "high" ? "red" : t.priority === "medium" ? "amber" : "slate"}>{t.priority}</Badge>
                      {t.source === "workflow" && <Badge tone="navy">Generated</Badge>}
                      {t.dueDate && <span className="text-slate-500">Due {t.dueDate}</span>}
                    </div>
                  </div>
                  <label htmlFor={`status-${t.id}`} className="sr-only">
                    Status for {t.title}
                  </label>
                  <Select id={`status-${t.id}`} className="h-8 w-36 text-xs" value={t.status} onChange={(e) => update.mutate({ id: t.id, patch: { status: e.target.value as Task["status"] } })}>
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                    aria-label={`Delete task ${t.title}`}
                    onClick={() => {
                      if (window.confirm(`Delete “${t.title}”?`)) remove.mutate(t.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
