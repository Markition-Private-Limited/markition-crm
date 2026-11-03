"use client";

import * as React from "react";
import {
  Plus, Pencil, Power, PowerOff, AlertTriangle, FileText, Save, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

type Template = {
  id: string;
  name: string;
  description: string | null;
  customer_type: string | null;
  jurisdiction: string | null;
  is_mandatory: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

type FormState = {
  name: string;
  description: string;
  customer_type: string;
  jurisdiction: string;
  is_mandatory: boolean;
  sort_order: string;
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  customer_type: "",
  jurisdiction: "",
  is_mandatory: true,
  sort_order: "0",
});

const inputCls =
  "h-10 w-full rounded-[14px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentTemplatesPage() {
  const { token, appRole } = useSessionProvider();

  const isAdmin = appRole === "admin" || appRole === "super_admin";

  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showInactive, setShowInactive] = React.useState(false);

  const [modal, setModal] = React.useState<{ mode: "create" | "edit"; template?: Template } | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm());
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet("/api/admin/document-templates", token);
      setTemplates((data as Template[]) ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  React.useEffect(() => { if (token) load(); }, [token, load]);

  const openCreate = () => {
    setForm(emptyForm());
    setSaveError("");
    setModal({ mode: "create" });
  };

  const openEdit = (t: Template) => {
    setForm({
      name: t.name,
      description: t.description ?? "",
      customer_type: t.customer_type ?? "",
      jurisdiction: t.jurisdiction ?? "",
      is_mandatory: t.is_mandatory,
      sort_order: String(t.sort_order),
    });
    setSaveError("");
    setModal({ mode: "edit", template: t });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setSaveError("Name is required"); return; }
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        customer_type: form.customer_type.trim() || null,
        jurisdiction: form.jurisdiction.trim() || null,
        is_mandatory: form.is_mandatory,
        sort_order: parseInt(form.sort_order) || 0,
      };
      if (modal?.mode === "create") {
        await apiPost("/api/admin/document-templates", token, payload);
      } else if (modal?.template) {
        await apiPatch(`/api/admin/document-templates/${modal.template.id}`, token, payload);
      }
      setModal(null);
      await load();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  };

  const toggleActive = async (t: Template) => {
    try {
      if (t.is_active) {
        await apiDelete(`/api/admin/document-templates/${t.id}`, token);
      } else {
        await apiPatch(`/api/admin/document-templates/${t.id}`, token, { is_active: true });
      }
      await load();
    } catch { /* ignore */ }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Administrator access required.
      </div>
    );
  }

  const visible = templates.filter((t) => showInactive || t.is_active);

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6 px-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Document Templates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define required documents for onboarding checklist generation
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Template</Button>
      </div>

      {/* Show-inactive toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowInactive((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          {showInactive ? "Hide inactive" : "Show inactive"}
        </button>
        <span className="text-xs text-muted-foreground">
          ({templates.filter((t) => !t.is_active).length} inactive)
        </span>
      </div>

      {/* Legend */}
      <div className="rounded-[14px] border border-border bg-surface-muted px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p>
          <strong className="text-foreground">customer_type / jurisdiction</strong> — leave blank to match all values.
          A template applies to an onboarding case if its type/jurisdiction matches (or the field is blank).
        </p>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border py-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No templates yet</p>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add First Template</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((t) => (
            <div
              key={t.id}
              className={`rounded-[16px] border border-border p-4 flex items-start gap-4 ${
                t.is_active ? "bg-surface" : "bg-surface-muted opacity-60"
              }`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{t.name}</span>
                  {t.is_mandatory ? (
                    <span className="text-[10px] font-bold uppercase text-rose-400 rounded-full bg-rose-500/10 px-2 py-0.5">Required</span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase text-muted-foreground rounded-full bg-surface-muted px-2 py-0.5">Optional</span>
                  )}
                  {!t.is_active && (
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Inactive</span>
                  )}
                </div>
                {t.description && (
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  {t.customer_type ? (
                    <span>Type: <strong className="text-foreground">{t.customer_type}</strong></span>
                  ) : (
                    <span className="italic">All customer types</span>
                  )}
                  <span>·</span>
                  {t.jurisdiction ? (
                    <span>Jurisdiction: <strong className="text-foreground">{t.jurisdiction}</strong></span>
                  ) : (
                    <span className="italic">All jurisdictions</span>
                  )}
                  {t.sort_order !== 0 && <span>· Order: {t.sort_order}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  title="Edit"
                  onClick={() => openEdit(t)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  title={t.is_active ? "Deactivate" : "Activate"}
                  onClick={() => toggleActive(t)}
                  className={`rounded-lg p-1.5 transition ${
                    t.is_active
                      ? "text-muted-foreground hover:text-danger hover:bg-surface-muted"
                      : "text-emerald-400 hover:text-emerald-300 hover:bg-surface-muted"
                  }`}
                >
                  {t.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ───────────────────────────────────────────────── */}
      <Modal
        open={!!modal}
        title={modal?.mode === "create" ? "New Document Template" : "Edit Template"}
        onClose={() => setModal(null)}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Document name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Business Registration Certificate"
              className={inputCls}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional note shown to the team"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Customer Type</label>
              <input
                type="text"
                value={form.customer_type}
                onChange={(e) => setForm((f) => ({ ...f, customer_type: e.target.value }))}
                placeholder="Leave blank = all"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Jurisdiction</label>
              <input
                type="text"
                value={form.jurisdiction}
                onChange={(e) => setForm((f) => ({ ...f, jurisdiction: e.target.value }))}
                placeholder="Leave blank = all"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Required?</label>
              <select
                value={form.is_mandatory ? "1" : "0"}
                onChange={(e) => setForm((f) => ({ ...f, is_mandatory: e.target.value === "1" }))}
                className={inputCls}
              >
                <option value="1">Required (mandatory)</option>
                <option value="0">Optional</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Sort Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                placeholder="0"
                className={inputCls}
              />
            </div>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 rounded-[12px] bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {saveError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal(null)}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
