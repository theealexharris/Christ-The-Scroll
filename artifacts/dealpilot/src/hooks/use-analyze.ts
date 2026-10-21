import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { api, errorMessage } from "@/lib/api";
import type { Deal, Property } from "@/lib/types";

/** Saves a property as a deal (copying samples into the workspace) and opens it. */
export function useAnalyzeProperty() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  return useMutation({
    mutationFn: (p: Property) => api.post<Deal>("/api/deals", { propertyId: p.id }),
    onSuccess: (deal, p) => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(p.isSample ? "Sample saved to your workspace as a deal" : "Deal created");
      navigate(`/deals/${deal.id}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}
