"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Plus, Trash2, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet, apiPost, apiDelete } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type Category = { id: string; name: string };
type ContactDraft = { first_name: string; last_name: string; email: string; phone: string; title: string; is_primary: boolean };
type ProspectDraft = { notes: string; status: "new" | "contacted"; convertToLead: boolean; leadTitle: string };

const PROSPECT_STATUSES = ["new", "contacted"] as const;
const STEPS = ["Client Info", "Add Contacts", "Add Prospects"] as const;

// ─── Validation helpers ───────────────────────────────────────────────────────

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_PHONE = /^[+\d][\d\s\-().]{6,19}$/;
const RE_URL   = /^https?:\/\/.+\..+/i;

function validateEmail(v: string) {
  if (!v) return null;
  return RE_EMAIL.test(v) ? null : "Invalid email address";
}
function validatePhone(v: string) {
  if (!v) return null;
  return RE_PHONE.test(v) ? null : "Invalid phone number";
}
function validateUrl(v: string) {
  if (!v) return null;
  return RE_URL.test(v) ? null : "Must start with http:// or https://";
}

function FieldError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-danger">{msg}</p>;
}

function emptyContact(): ContactDraft {
  return { first_name: "", last_name: "", email: "", phone: "", title: "", is_primary: false };
}
function emptyProspect(): ProspectDraft {
  return { notes: "", status: "new", convertToLead: false, leadTitle: "" };
}

// ─── Step indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
              i < current ? "bg-accent text-white" : i === current ? "bg-foreground text-background" : "bg-surface-muted text-muted-foreground"
            }`}>
              {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`hidden text-sm sm:block ${i === current ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Category combobox ───────────────────────────────────────────────────────

function CategoryCombobox({
  selected, categories, canCreate, onSelect, onDeselect, onCreate, onDelete,
}: {
  selected: Category[];
  categories: Category[];
  canCreate: boolean;
  onSelect: (cat: Category) => void;
  onDeselect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  const filtered = categories.filter(
    (c) => c.name.toLowerCase().includes(query.toLowerCase()) && !selected.find((s) => s.id === c.id),
  );
  const exactMatch = categories.some((c) => c.name.toLowerCase() === query.toLowerCase());

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreate = async () => {
    if (!query.trim()) return;
    setCreating(true);
    await onCreate(query.trim());
    setQuery("");
    setCreating(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-foreground">Service Categories</label>
        {canCreate && <span className="text-xs text-muted-foreground">Type a new name to create one</span>}
      </div>
      <div ref={ref} className="relative">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={canCreate ? "Search or type to create a new category…" : "Search or select categories…"}
          className="h-10 w-full rounded-[16px] border border-border bg-surface px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
        {open && (filtered.length > 0 || (canCreate && query && !exactMatch)) && (
          <div className="absolute z-10 bottom-full mb-1 w-full rounded-[16px] border border-border bg-surface shadow-xl shadow-black/10">
            <div className="p-1">
              {filtered.map((cat) => (
                <div key={cat.id} className="flex items-center gap-1 rounded-[12px] hover:bg-surface-muted">
                  <button
                    type="button"
                    onClick={() => { onSelect(cat); setQuery(""); setOpen(false); }}
                    className="flex-1 px-3 py-2 text-left text-sm text-foreground"
                  >
                    {cat.name}
                  </button>
                  {canCreate && (
                    <button
                      type="button"
                      disabled={deletingId === cat.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setDeletingId(cat.id);
                        await onDelete(cat.id);
                        setDeletingId(null);
                      }}
                      className="mr-2 shrink-0 rounded p-1 text-muted-foreground hover:text-danger disabled:opacity-40"
                      title="Delete category"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {canCreate && query && !exactMatch && (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {creating ? "Creating…" : `Create "${query}"`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((cat) => (
            <span key={cat.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-3 py-1 text-sm text-foreground">
              {cat.name}
              <button type="button" onClick={() => onDeselect(cat.id)} className="text-muted-foreground hover:text-danger">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function NewCompanyPage() {
  const router = useRouter();
  const { token, appRole } = useSessionProvider();
  const [step, setStep] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Step 1 state
  const [name, setName] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [selectedCats, setSelectedCats] = React.useState<Category[]>([]);

  // Step 1 validation errors
  const [nameErr, setNameErr] = React.useState<string | null>(null);
  const [websiteErr, setWebsiteErr] = React.useState<string | null>(null);
  const [phoneErr, setPhoneErr] = React.useState<string | null>(null);

  // Step 2 state
  const [contacts, setContacts] = React.useState<ContactDraft[]>([emptyContact()]);
  // contact field errors: array of { email, phone } errors
  const [contactErrs, setContactErrs] = React.useState<Array<{ email: string | null; phone: string | null }>>([{ email: null, phone: null }]);

  // Step 3 state
  const [prospects, setProspects] = React.useState<ProspectDraft[]>([emptyProspect()]);

  const isAdmin = appRole === "admin";
  const canConvert = appRole === "admin" || appRole === "sales";

  React.useEffect(() => {
    if (!token) return;
    apiGet("/api/service-categories", token)
      .then(setCategories)
      .catch(() => {});
  }, [token]);

  // ── Category handlers ──────────────────────────────────────────────────────

  const handleCreateCategory = async (catName: string) => {
    if (!token) return;
    try {
      const created = await apiPost("/api/service-categories", token, { name: catName });
      setCategories((prev) => [...prev, created]);
      setSelectedCats((prev) => [...prev, created]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create category");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!token) return;
    try {
      await apiDelete(`/api/service-categories/${id}`, token);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setSelectedCats((prev) => prev.filter((c) => c.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete category");
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  const validateStep1 = () => {
    const nErr = name.trim() ? null : "Client name is required";
    const pErr = validatePhone(phone);
    setNameErr(nErr);
    setWebsiteErr(null);
    setPhoneErr(pErr);
    return !nErr && !pErr;
  };

  const validateStep2 = () => {
    const errs = contacts.map((c) => ({
      email: validateEmail(c.email),
      phone: validatePhone(c.phone),
    }));
    setContactErrs(errs);
    return errs.every((e) => !e.email && !e.phone);
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goToStep2 = () => {
    if (validateStep1()) setStep(1);
  };

  const goToStep3 = () => {
    if (validateStep2()) setStep(2);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!token || !name.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const company = await apiPost("/api/companies", token, {
        name: name.trim(), industry: industry || undefined, website: website || undefined,
        phone: phone || undefined, address: address || undefined,
      });

      for (const cat of selectedCats) {
        await apiPost(`/api/companies/${company.id}/categories`, token, { service_category_id: cat.id });
      }

      for (const c of contacts) {
        if (!c.first_name.trim()) continue;
        await apiPost("/api/contacts", token, {
          company_id: company.id, first_name: c.first_name, last_name: c.last_name || undefined,
          email: c.email || undefined, phone: c.phone || undefined,
          title: c.title || undefined, is_primary: c.is_primary,
        });
      }

      for (const p of prospects) {
        if (!p.notes.trim() && !p.convertToLead) continue;
        const created = await apiPost("/api/prospects", token, {
          company_id: company.id, notes: p.notes || undefined, status: p.status,
        });
        if (p.convertToLead && canConvert) {
          await apiPost(`/api/prospects/${created.id}/convert`, token, {
            title: p.leadTitle.trim() || `Lead from ${name.trim()}`,
          });
        }
      }

      router.push(`/companies/${company.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  const updateContact = (i: number, field: keyof ContactDraft, value: string | boolean) => {
    setContacts((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };

  const updateContactErr = (i: number, field: "email" | "phone", value: string) => {
    const err = field === "email" ? validateEmail(value) : validatePhone(value);
    setContactErrs((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: err } : e));
  };

  const updateProspect = (i: number, field: keyof ProspectDraft, value: string | boolean) => {
    setProspects((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">New Client</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set up a client in three steps.</p>
      </div>

      <StepIndicator current={step} />

      {error && <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {/* ── Step 1: Company Info ──────────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-5 rounded-[24px] border border-border bg-surface p-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Client Name <span className="text-danger">*</span></label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameErr(null); }}
              onBlur={() => setNameErr(name.trim() ? null : "Client name is required")}
              placeholder="Acme Corp"
              className={`field ${nameErr ? "border-danger" : ""}`}
            />
            <FieldError msg={nameErr} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Industry</label>
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Technology" className="field" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Phone</label>
              <input
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setPhoneErr(validatePhone(e.target.value)); }}
                onBlur={() => setPhoneErr(validatePhone(phone))}
                placeholder="+1-555-0100"
                className={`field ${phoneErr ? "border-danger" : ""}`}
              />
              <FieldError msg={phoneErr} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Website</label>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://acme.com"
                className={`field ${websiteErr ? "border-danger" : ""}`}
              />
              <FieldError msg={websiteErr} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" className="field" />
            </div>
          </div>
          <CategoryCombobox
            selected={selectedCats}
            categories={categories}
            canCreate={isAdmin}
            onSelect={(cat) => setSelectedCats((prev) => [...prev, cat])}
            onDeselect={(id) => setSelectedCats((prev) => prev.filter((c) => c.id !== id))}
            onCreate={handleCreateCategory}
            onDelete={handleDeleteCategory}
          />
          <div className="flex justify-end">
            <Button onClick={goToStep2}>
              Next: Add Contacts <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Contacts ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5 rounded-[24px] border border-border bg-surface p-6">
          <p className="text-sm text-muted-foreground">Add contacts for this client. You can skip this step.</p>
          {contacts.map((c, i) => (
            <div key={i} className="space-y-3 rounded-[18px] border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Contact {i + 1}</p>
                {contacts.length > 1 && (
                  <button type="button" onClick={() => {
                    setContacts((prev) => prev.filter((_, idx) => idx !== i));
                    setContactErrs((prev) => prev.filter((_, idx) => idx !== i));
                  }} className="text-muted-foreground hover:text-danger">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">First Name</label>
                  <input value={c.first_name} onChange={(e) => updateContact(i, "first_name", e.target.value)} placeholder="Jane" className="field" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Last Name</label>
                  <input value={c.last_name} onChange={(e) => updateContact(i, "last_name", e.target.value)} placeholder="Doe" className="field" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <input
                    value={c.email}
                    onChange={(e) => { updateContact(i, "email", e.target.value); updateContactErr(i, "email", e.target.value); }}
                    onBlur={() => updateContactErr(i, "email", c.email)}
                    placeholder="jane@acme.com"
                    className={`field ${contactErrs[i]?.email ? "border-danger" : ""}`}
                  />
                  <FieldError msg={contactErrs[i]?.email ?? null} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Phone</label>
                  <input
                    value={c.phone}
                    onChange={(e) => { updateContact(i, "phone", e.target.value); updateContactErr(i, "phone", e.target.value); }}
                    onBlur={() => updateContactErr(i, "phone", c.phone)}
                    placeholder="+1-555-0101"
                    className={`field ${contactErrs[i]?.phone ? "border-danger" : ""}`}
                  />
                  <FieldError msg={contactErrs[i]?.phone ?? null} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Title</label>
                  <input value={c.title} onChange={(e) => updateContact(i, "title", e.target.value)} placeholder="CEO" className="field" />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id={`primary-${i}`} checked={c.is_primary} onChange={(e) => updateContact(i, "is_primary", e.target.checked)} className="h-4 w-4 rounded border-border" />
                  <label htmlFor={`primary-${i}`} className="text-sm text-foreground">Primary contact</label>
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => {
            setContacts((prev) => [...prev, emptyContact()]);
            setContactErrs((prev) => [...prev, { email: null, phone: null }]);
          }} className="flex items-center gap-2 text-sm text-accent hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add another contact
          </button>
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={goToStep3}>Next: Add Prospects <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Prospects ────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5 rounded-[24px] border border-border bg-surface p-6">
          <p className="text-sm text-muted-foreground">Add prospects for this client. You can also convert them to leads immediately.</p>
          {prospects.map((p, i) => (
            <div key={i} className="space-y-3 rounded-[18px] border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Prospect {i + 1}</p>
                {prospects.length > 1 && (
                  <button type="button" onClick={() => setProspects((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-danger">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea value={p.notes} onChange={(e) => updateProspect(i, "notes", e.target.value)} placeholder="Initial outreach notes…" rows={3} className="field resize-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select value={p.status} onChange={(e) => updateProspect(i, "status", e.target.value)} className="field">
                  {PROSPECT_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setProspects((prev) => [...prev, emptyProspect()])} className="flex items-center gap-2 text-sm text-accent hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add another prospect
          </button>
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Creating…" : "Skip & Create"}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Creating…" : "Create Client"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .field {
          width: 100%;
          height: 2.5rem;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--surface);
          padding: 0 1rem;
          font-size: 0.875rem;
          color: var(--foreground);
          outline: none;
          transition: border-color 0.15s;
        }
        .field:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent);
        }
        .field.border-danger {
          border-color: var(--danger);
        }
        textarea.field {
          height: auto;
          padding: 0.5rem 1rem;
        }
        select.field {
          appearance: auto;
        }
        .field::placeholder { color: var(--muted-foreground); }
      `}</style>
    </div>
  );
}
