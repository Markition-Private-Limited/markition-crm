"use client";

import * as React from "react";
import { Users, Eye, EyeOff, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet, apiPost } from "@/lib/api";

type Employee = {
  id: string;
  full_name: string | null;
  email: string;
  role: string | null;
  created_at: string;
};

type CreatedEmployee = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

const ROLE_OPTIONS = [
  { value: "Sales", label: "Sales" },
  { value: "Project Manager", label: "Project Manager" },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}


export default function EmployeesPage() {
  const { token, appRole } = useSessionProvider();

  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState<string | null>(null);

  // Create form state
  const [showForm, setShowForm] = React.useState(false);
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [roleName, setRoleName] = React.useState("Sales");
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Success reveal state — shown once after creation
  const [created, setCreated] = React.useState<CreatedEmployee | null>(null);

  const load = React.useCallback(() => {
    if (!token) return;
    setLoading(true);
    apiGet("/api/employees", token)
      .then((data) => setEmployees(data as Employee[]))
      .catch((e: unknown) =>
        setPageError(e instanceof Error ? e.message : "Failed to load employees")
      )
      .finally(() => setLoading(false));
  }, [token]);

  React.useEffect(() => {
    load();
  }, [load]);

  const openForm = () => {
    setFullName("");
    setEmail("");
    setRoleName("Sales");
    setPassword("");
    setShowPw(false);
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormError(null);
  };

  const submit = async () => {
    if (!token) return;
    if (!fullName.trim()) {
      setFormError("Full name is required.");
      return;
    }
    if (!email.trim()) {
      setFormError("Email is required.");
      return;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email.trim())) {
      setFormError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await apiPost("/api/employees", token, {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        role_name: roleName,
        password,
      });
      closeForm();
      setCreated(result as CreatedEmployee);
      load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to create employee");
    } finally {
      setSubmitting(false);
    }
  };

  if (appRole !== "admin") {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="font-semibold text-foreground">Access denied</p>
        <p className="text-sm text-muted-foreground">
          Only admins can manage employee accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create new employee accounts and manage their roles.
          </p>
        </div>
        <Button onClick={openForm}>
          <UserPlus className="h-4 w-4" />
          Add Employee
        </Button>
      </div>

      {pageError && (
        <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">
          {pageError}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[14px] bg-surface-muted" />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-foreground">No employees yet</p>
          <p className="text-sm text-muted-foreground">
            Add the first employee to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Role
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map((emp) => (
                <tr
                  key={emp.id}
                  className="bg-surface transition hover:bg-surface-muted/40"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {emp.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.email}</td>
                  <td className="px-4 py-3">
                    {emp.role ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {emp.role}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">No role</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {emp.created_at ? fmtDate(emp.created_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create employee form modal */}
      <Modal
        open={showForm}
        title="Add New Employee"
        description="Creates a login account, profile, and role assignment."
        onClose={closeForm}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Full Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              className="h-10 w-full rounded-[12px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Email Address <span className="text-danger">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="h-10 w-full rounded-[12px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Role <span className="text-danger">*</span>
            </label>
            <select
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="h-10 w-full rounded-[12px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Initial Password <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="h-10 w-full rounded-[12px] border border-border bg-background px-3 pr-10 text-sm focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this with the employee — they can change it after first login.
            </p>
          </div>

          {formError && (
            <p className="rounded-[12px] bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || !fullName.trim() || !email.trim() || !password}
            >
              {submitting ? "Creating…" : "Create Employee"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Success modal — shows temporary password once */}
      <Modal
        open={!!created}
        title="Employee Created"
        onClose={() => setCreated(null)}
      >
        {created && (
          <div className="space-y-4">
            <div className="rounded-[14px] border border-border bg-surface-muted px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-foreground">{created.full_name}</p>
              <p className="text-xs text-muted-foreground">{created.email}</p>
              <p className="text-xs text-muted-foreground">Role: {created.role}</p>
            </div>

            <p className="text-sm text-muted-foreground">
              Account created successfully. The employee can now log in with their email
              and the password you set. They can change it from the profile menu after signing in.
            </p>

            <div className="flex justify-end">
              <Button onClick={() => setCreated(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
