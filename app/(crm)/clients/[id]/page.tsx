"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Building2, ChevronLeft, Edit2, Globe, MapPin, Phone, Plus,
  Target, CheckSquare, Users, X, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet, apiPost, apiPut } from "@/lib/api";

type Company = {
  id: string; name: string; industry: string | null; website: string | null;
  phone: string | null; address: string | null; created_at: string;
  company_service_categories?: Array<{ service_category_id: string; service_categories: { id: string; name: string } | null }>;
  contacts?: Array<{ count: number }>;
  prospects?: Array<{ count: number }>;
  tasks?: Array<{ count: number }>;
};
type Contact = { id: string; first_name: string; last_name: string | null; email: string; phone: string | null; title: string | null; is_primary: boolean };
type Prospect = { id: string; company_id: string; notes: string | null; status: string; created_at: string };
type Task = { id: string; title: string; status: string; due_date: string | null; created_at: string };

const STATUS_COLORS: Record<string, string> = {
  first_contact:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  follow_up:      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  discovery_call: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  closing:        "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  closed_won:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed:         "bg-surface-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status] ?? "bg-surface-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[14px] px-4 py-2 text-sm font-medium transition ${active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, appRole } = useSessionProvider();
  const [tab, setTab] = React.useState<"info" | "contacts" | "prospects" | "tasks">("info");
  const [company, setCompany] = React.useState<Company | null>(null);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [prospects, setProspects] = React.useState<Prospect[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tabLoading, setTabLoading] = React.useState(false);
  const loadedTabsRef = React.useRef<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editIndustry, setEditIndustry] = React.useState("");
  const [editWebsite, setEditWebsite] = React.useState("");
  const [editPhone, setEditPhone] = React.useState("");
  const [editAddress, setEditAddress] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Add contact state
  const [showAddContact, setShowAddContact] = React.useState(false);
  const [newContact, setNewContact] = React.useState({ first_name: "", last_name: "", email: "", phone: "", title: "", is_primary: false });
  const [addingContact, setAddingContact] = React.useState(false);

  const canEdit = appRole === "admin" || appRole === "project_manager";
  const canManageProspects = appRole === "admin" || appRole === "sales";

  // Load only company on mount — tab data loads lazily on first tab visit
  React.useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    loadedTabsRef.current = new Set();
    apiGet(`/api/companies/${id}`, token)
      .then((data) => setCompany(data as Company))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, id]);

  // Lazy-load tab data on first visit to that tab
  React.useEffect(() => {
    if (!token || !id || loading) return;
    if (tab === "info" || loadedTabsRef.current.has(tab)) return;
    loadedTabsRef.current.add(tab);
    setTabLoading(true);
    const req =
      tab === "contacts" ? apiGet(`/api/contacts?company_id=${id}`, token).then((d) => setContacts(d as Contact[])) :
      tab === "prospects" ? apiGet(`/api/prospects?company_id=${id}`, token).then((d) => setProspects(d as Prospect[])) :
      tab === "tasks" ? apiGet(`/api/tasks?company_id=${id}`, token).then((d) => setTasks(d as Task[])) :
      Promise.resolve();
    req.catch(() => {}).finally(() => setTabLoading(false));
  }, [token, id, tab, loading]);

  const startEdit = () => {
    if (!company) return;
    setEditName(company.name);
    setEditIndustry(company.industry ?? "");
    setEditWebsite(company.website ?? "");
    setEditPhone(company.phone ?? "");
    setEditAddress(company.address ?? "");
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!token || !company || !editName.trim()) return;
    setSaving(true);
    try {
      const updated = await apiPut(`/api/companies/${company.id}`, token, {
        name: editName, industry: editIndustry || null, website: editWebsite || null,
        phone: editPhone || null, address: editAddress || null,
      });
      setCompany(updated as Company);
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const addContact = async () => {
    if (!token || !newContact.first_name.trim()) return;
    setAddingContact(true);
    try {
      const created = await apiPost("/api/contacts", token, { ...newContact, company_id: id });
      setContacts((prev) => [...prev, created as Contact]);
      setNewContact({ first_name: "", last_name: "", email: "", phone: "", title: "", is_primary: false });
      setShowAddContact(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add contact");
    } finally {
      setAddingContact(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" /></div>;
  }
  if (error) return <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>;
  if (!company) return <p className="text-muted-foreground">Client not found.</p>;

  const cats = company.company_service_categories?.map((csc) => csc.service_categories?.name).filter(Boolean) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button type="button" onClick={() => router.push("/clients")} className="mt-1 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-accent/10 text-accent">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">{company.name}</h1>
                {company.industry && <p className="text-sm text-muted-foreground">{company.industry}</p>}
              </div>
            </div>
            {cats.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {cats.map((cat) => (
                  <span key={cat} className="rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs text-muted-foreground">{cat}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        {canEdit && !editing && (
          <Button variant="secondary" onClick={startEdit}><Edit2 className="h-4 w-4" /> Edit</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-[18px] border border-border bg-surface p-1">
        {(["info", "contacts", "prospects", "tasks"] as const).map((t) => (
          <Tab key={t} active={tab === t} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "contacts" && (company?.contacts?.[0]?.count ?? 0) > 0 && <span className="ml-1 text-xs opacity-60">({company?.contacts?.[0]?.count})</span>}
            {t === "prospects" && (company?.prospects?.[0]?.count ?? 0) > 0 && <span className="ml-1 text-xs opacity-60">({company?.prospects?.[0]?.count})</span>}
            {t === "tasks" && (company?.tasks?.[0]?.count ?? 0) > 0 && <span className="ml-1 text-xs opacity-60">({company?.tasks?.[0]?.count})</span>}
          </Tab>
        ))}
      </div>

      {/* Tab content */}
      {tabLoading && (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      )}

      {!tabLoading && tab === "info" && (
        <div className="rounded-[24px] border border-border bg-surface p-6">
          {editing ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: "Client Name *", value: editName, set: setEditName, placeholder: "Acme Corp",        max: 100 },
                  { label: "Industry",      value: editIndustry, set: setEditIndustry, placeholder: "Technology", max: 100 },
                  { label: "Website",       value: editWebsite, set: setEditWebsite, placeholder: "https://acme.com", max: 255 },
                  { label: "Address",       value: editAddress, set: setEditAddress, placeholder: "123 Main St",  max: 255 },
                ].map(({ label, value, set, placeholder, max }) => (
                  <div key={label} className="space-y-1">
                    <label className="text-sm font-medium text-foreground">{label}</label>
                    <input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} maxLength={max} className="h-10 w-full rounded-[14px] border border-border bg-background px-3 text-sm text-foreground focus:border-accent focus:outline-none" />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Phone</label>
                  <PhoneInput value={editPhone} onChange={setEditPhone} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveEdit} disabled={saving || !editName.trim()}><Check className="h-4 w-4" />{saving ? "Saving…" : "Save"}</Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { icon: Globe, label: "Website", value: company.website, href: company.website ?? undefined },
                { icon: Phone, label: "Phone", value: company.phone },
                { icon: MapPin, label: "Address", value: company.address },
              ].map(({ icon: Icon, label, value, href }) => value ? (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">{value}</a>
                    ) : (
                      <p className="text-sm text-foreground">{value}</p>
                    )}
                  </div>
                </div>
              ) : null)}
            </div>
          )}
        </div>
      )}

      {!tabLoading && tab === "contacts" && (
        <div className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={() => setShowAddContact(true)}><Plus className="h-4 w-4" /> Add Contact</Button>
            </div>
          )}
          {showAddContact && (
            <div className="rounded-[20px] border border-border bg-surface p-5 space-y-3">
              <p className="font-semibold text-foreground text-sm">New Contact</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  { f: "first_name", label: "First Name", max: 50  },
                  { f: "last_name",  label: "Last Name",  max: 50  },
                  { f: "email",      label: "Email",      max: 255 },
                  { f: "title",      label: "Title",      max: 100 },
                ] as const).map(({ f, label, max }) => (
                  <div key={f} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                    <input value={newContact[f]} onChange={(e) => setNewContact((p) => ({ ...p, [f]: e.target.value }))} maxLength={max} className="h-9 w-full rounded-[12px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none" />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Phone</label>
                  <PhoneInput
                    value={newContact.phone}
                    onChange={(v) => setNewContact((p) => ({ ...p, phone: v }))}
                    className="h-9 rounded-[12px] text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input type="checkbox" id="new-primary" checked={newContact.is_primary} onChange={(e) => setNewContact((p) => ({ ...p, is_primary: e.target.checked }))} className="h-4 w-4 rounded" />
                  <label htmlFor="new-primary" className="text-sm text-foreground">Primary contact</label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={addContact} disabled={addingContact || !newContact.first_name.trim()}>{addingContact ? "Adding…" : "Add"}</Button>
                <Button variant="secondary" onClick={() => setShowAddContact(false)}>Cancel</Button>
              </div>
            </div>
          )}
          {contacts.length === 0 && !showAddContact ? (
            <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border py-12 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No contacts yet.</p>
            </div>
          ) : (
            contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-4 rounded-[18px] border border-border bg-surface px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                  {c.first_name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-muted-foreground">{[c.title, c.email].filter(Boolean).join(" · ")}</p>
                </div>
                {c.is_primary && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">Primary</span>}
              </div>
            ))
          )}
        </div>
      )}

      {!tabLoading && tab === "prospects" && (
        <div className="space-y-3">
          {canManageProspects && (
            <div className="flex justify-end">
              <Button href={`/prospects?company_id=${id}`}><Target className="h-4 w-4" /> View All Prospects</Button>
            </div>
          )}
          {prospects.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border py-12 text-center">
              <Target className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No prospects for this client.</p>
            </div>
          ) : (
            prospects.map((p) => (
              <Link key={p.id} href={`/prospects/${p.id}`} className="flex items-start gap-4 rounded-[18px] border border-border bg-surface px-4 py-3 hover:border-accent/40 hover:bg-surface-elevated transition">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={p.status} />
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  {p.notes && <p className="mt-1 text-sm text-foreground">{p.notes}</p>}
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {!tabLoading && tab === "tasks" && (
        <div className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <Button href={`/tasks?company_id=${id}`}><CheckSquare className="h-4 w-4" /> View All Tasks</Button>
            </div>
          )}
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border py-12 text-center">
              <CheckSquare className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No tasks linked to this client.</p>
            </div>
          ) : (
            tasks.map((t) => (
              <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center gap-4 rounded-[18px] border border-border bg-surface px-4 py-3 hover:border-accent/40 hover:bg-surface-elevated transition">
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">{t.title}</p>
                  {t.due_date && <p className="text-xs text-muted-foreground">Due {new Date(t.due_date).toLocaleDateString()}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">{t.status}</span>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Activity Feed */}
      {company && (
        <div className="rounded-[20px] border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Activity</h2>
          <ActivityFeed entityType="company" entityId={company.id} />
        </div>
      )}
    </div>
  );
}
