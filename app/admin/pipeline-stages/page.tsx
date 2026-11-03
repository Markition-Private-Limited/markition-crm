"use client";

import * as React from "react";
import {
  Layers, Plus, Check, X, ChevronUp, ChevronDown,
  AlertTriangle, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";

type Stage = {
  id: string;
  name: string;
  display_order: number;
  default_probability: number;
  is_won: boolean;
  is_lost: boolean;
  is_active: boolean;
};

export default function PipelineStagesPage() {
  const { token, appRole } = useSessionProvider();
  const [stages,  setStages]  = React.useState<Stage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error,   setError]   = React.useState<string | null>(null);
  const [saving,  setSaving]  = React.useState(false);

  const [showModal, setShowModal] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Stage | null>(null);
  const [form, setForm] = React.useState({
    name: "", default_probability: "0", is_won: false, is_lost: false,
  });

  const [deactivateTarget, setDeactivateTarget] = React.useState<Stage | null>(null);
  const [deactivateError,  setDeactivateError]  = React.useState<string | null>(null);

  if (appRole !== "admin") {
    return <p className="text-muted-foreground">Access denied.</p>;
  }

  const load = () => {
    if (!token) return;
    setLoading(true);
    apiGet("/api/pipeline-stages", token)
      .then((d) => setStages(d as Stage[]))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => {
    setEditTarget(null);
    const maxOrder = Math.max(0, ...stages.map((s) => s.display_order));
    setForm({ name: "", default_probability: "0", is_won: false, is_lost: false });
    setShowModal(true);
  };

  const openEdit = (s: Stage) => {
    setEditTarget(s);
    setForm({
      name: s.name,
      default_probability: String(s.default_probability),
      is_won: s.is_won,
      is_lost: s.is_lost,
    });
    setShowModal(true);
  };

  const saveStage = async () => {
    if (!token || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        default_probability: Number(form.default_probability),
        is_won:  form.is_won,
        is_lost: form.is_lost,
      };
      if (editTarget) {
        const updated = await apiPut(`/api/pipeline-stages/${editTarget.id}`, token, payload);
        setStages((prev) => prev.map((s) => s.id === editTarget.id ? updated as Stage : s));
      } else {
        const maxOrder = Math.max(0, ...stages.map((s) => s.display_order));
        const created = await apiPost("/api/pipeline-stages", token, {
          ...payload,
          display_order: maxOrder + 1,
        });
        setStages((prev) => [...prev, created as Stage]);
      }
      setShowModal(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save stage");
    } finally {
      setSaving(false);
    }
  };

  const reorder = async (stage: Stage, direction: "up" | "down") => {
    if (!token) return;
    const sorted = [...stages].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((s) => s.id === stage.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const other = sorted[swapIdx];
    const tempOrder = sorted[idx].display_order;

    try {
      // Swap using a temp value to avoid UNIQUE conflict
      await apiPut(`/api/pipeline-stages/${stage.id}`, token, { display_order: 99999 });
      await apiPut(`/api/pipeline-stages/${other.id}`, token, { display_order: tempOrder });
      await apiPut(`/api/pipeline-stages/${stage.id}`, token, { display_order: other.display_order });

      setStages((prev) =>
        prev.map((s) => {
          if (s.id === stage.id) return { ...s, display_order: other.display_order };
          if (s.id === other.id) return { ...s, display_order: tempOrder };
          return s;
        })
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reorder failed");
    }
  };

  const confirmDeactivate = async () => {
    if (!token || !deactivateTarget) return;
    setSaving(true);
    setDeactivateError(null);
    try {
      const updated = await apiDelete(`/api/pipeline-stages/${deactivateTarget.id}`, token);
      setStages((prev) => prev.map((s) => s.id === deactivateTarget.id ? updated as Stage : s));
      setDeactivateTarget(null);
    } catch (e: unknown) {
      setDeactivateError(e instanceof Error ? e.message : "Failed to deactivate");
    } finally {
      setSaving(false);
    }
  };

  const reactivate = async (stage: Stage) => {
    if (!token) return;
    try {
      const updated = await apiPut(`/api/pipeline-stages/${stage.id}`, token, { is_active: true });
      setStages((prev) => prev.map((s) => s.id === stage.id ? updated as Stage : s));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to reactivate");
    }
  };

  const sorted = [...stages].sort((a, b) => a.display_order - b.display_order);

  const inputCls = "h-10 w-full rounded-[14px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pipeline Stages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure the stages prospects move through. Reordering or editing a stage does not affect existing prospects.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Add Stage</Button>
      </div>

      {error && (
        <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-[18px] bg-surface-muted" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border py-16 text-center">
          <Layers className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-foreground">No pipeline stages</p>
          <Button onClick={openNew}><Plus className="h-4 w-4" /> Add Stage</Button>
        </div>
      ) : (
        <div className="rounded-[24px] border border-border bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left w-12">Order</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left w-28">Probability</th>
                <th className="px-4 py-3 text-left w-20">Type</th>
                <th className="px-4 py-3 text-left w-20">Status</th>
                <th className="px-4 py-3 text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((s, idx) => (
                <tr key={s.id} className={`transition ${s.is_active ? "" : "opacity-50"}`}>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{s.display_order}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-surface-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${s.default_probability}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{s.default_probability}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {s.is_won  && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Won</span>}
                    {s.is_lost && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Lost</span>}
                    {!s.is_won && !s.is_lost && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Active</span>}
                  </td>
                  <td className="px-4 py-3">
                    {s.is_active
                      ? <span className="text-xs text-green-600 font-medium">Active</span>
                      : <span className="text-xs text-muted-foreground">Inactive</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => reorder(s, "up")}
                        disabled={idx === 0}
                        className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-30 transition"
                        title="Move up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => reorder(s, "down")}
                        disabled={idx === sorted.length - 1}
                        className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-30 transition"
                        title="Move down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
                        title="Edit"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      {s.is_active ? (
                        <button
                          onClick={() => { setDeactivateTarget(s); setDeactivateError(null); }}
                          className="rounded-lg p-1 text-muted-foreground hover:text-danger hover:bg-surface-muted transition"
                          title="Deactivate"
                        >
                          <EyeOff className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => reactivate(s)}
                          className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
                          title="Reactivate"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={showModal}
        title={editTarget ? `Edit: ${editTarget.name}` : "Add Stage"}
        onClose={() => setShowModal(false)}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Stage Name <span className="text-danger">*</span></label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Technical Review"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Default Probability (%)</label>
            <input
              type="number" min="0" max="100"
              value={form.default_probability}
              onChange={(e) => setForm((f) => ({ ...f, default_probability: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_won}
                onChange={(e) => setForm((f) => ({ ...f, is_won: e.target.checked, is_lost: e.target.checked ? false : f.is_lost }))}
                className="h-4 w-4"
              />
              Marks as Won
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_lost}
                onChange={(e) => setForm((f) => ({ ...f, is_lost: e.target.checked, is_won: e.target.checked ? false : f.is_won }))}
                className="h-4 w-4"
              />
              Marks as Lost
            </label>
          </div>
          {(form.is_won || form.is_lost) && (
            <div className="flex items-center gap-2 rounded-[12px] bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {form.is_won ? "Moving a prospect to this stage will require a close date and final amount." : "Moving a prospect to this stage will require a loss reason."}
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={saveStage} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : editTarget ? "Save Changes" : "Add Stage"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Deactivate confirm */}
      <Modal
        open={!!deactivateTarget}
        title="Deactivate Stage"
        onClose={() => setDeactivateTarget(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Deactivating <strong>{deactivateTarget?.name}</strong> will hide it from the stage picker. Prospects currently in this stage are unaffected.
          </p>
          {deactivateError && (
            <div className="flex items-center gap-2 rounded-[12px] bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {deactivateError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeactivateTarget(null)}>Cancel</Button>
            <Button onClick={confirmDeactivate} disabled={saving}>
              {saving ? "Deactivating…" : "Deactivate"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
