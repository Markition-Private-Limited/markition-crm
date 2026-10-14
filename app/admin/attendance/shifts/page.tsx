"use client";

import * as React from "react";
import { Clock, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet, apiPost } from "@/lib/api";

type Shift = {
  id: string;
  start_time: string;
  end_time: string;
  effective_from: string;
  created_at: string;
};

type Employee = {
  id: string;
  full_name: string | null;
  email: string;
  staff_profile: { employee_code: string | null; attendance_enabled: boolean } | null;
  current_shift: Shift | null;
};

function fmt12(t: string) {
  // "HH:MM:SS" or "HH:MM" → "h:MM AM/PM"
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return `${h12}:${mStr} ${suffix}`;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ShiftsPage() {
  const { token, appRole } = useSessionProvider();
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState<string | null>(null);

  const [target, setTarget] = React.useState<Employee | null>(null);
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("17:00");
  const [effectiveFrom, setEffectiveFrom] = React.useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    if (!token) return;
    setLoading(true);
    apiGet("/api/attendance/shifts", token)
      .then((data) => setEmployees(data as Employee[]))
      .catch((e: unknown) => setPageError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const openModal = (emp: Employee) => {
    setTarget(emp);
    setStartTime(emp.current_shift?.start_time.slice(0, 5) ?? "09:00");
    setEndTime(emp.current_shift?.end_time.slice(0, 5) ?? "17:00");
    setEffectiveFrom(new Date().toISOString().split("T")[0]);
    setFormError(null);
  };

  const closeModal = () => {
    setTarget(null);
    setFormError(null);
  };

  const submit = async () => {
    if (!token || !target) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await apiPost("/api/attendance/shifts", token, {
        profile_id: target.id,
        start_time: startTime,
        end_time: endTime,
        effective_from: effectiveFrom,
      });
      closeModal();
      load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to save shift");
    } finally {
      setSubmitting(false);
    }
  };

  if (appRole !== "admin") {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="font-semibold text-foreground">Access denied</p>
        <p className="text-sm text-muted-foreground">Only admins can manage shift assignments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Shift Assignments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Assign or change work shift timings for each employee.
        </p>
      </div>

      {pageError && (
        <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{pageError}</p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[14px] bg-surface-muted" />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border py-16 text-center">
          <UserCog className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-foreground">No employees found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Employee</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Current Shift</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Effective From</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map((emp) => (
                <tr key={emp.id} className="bg-surface hover:bg-surface-muted/40 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{emp.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{emp.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {emp.current_shift ? (
                      <span className="flex items-center gap-1.5 text-foreground">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {fmt12(emp.current_shift.start_time)} – {fmt12(emp.current_shift.end_time)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">No shift assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {emp.current_shift ? fmtDate(emp.current_shift.effective_from) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="secondary" onClick={() => openModal(emp)}>
                      {emp.current_shift ? "Change Shift" : "Assign Shift"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!target}
        title={target?.current_shift ? "Change Shift" : "Assign Shift"}
        onClose={closeModal}
      >
        {target && (
          <div className="space-y-4">
            <div className="rounded-[12px] bg-surface-muted px-4 py-3">
              <p className="text-sm font-medium text-foreground">{target.full_name ?? target.email}</p>
              {target.current_shift && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Current: {fmt12(target.current_shift.start_time)} – {fmt12(target.current_shift.end_time)}{" "}
                  (since {fmtDate(target.current_shift.effective_from)})
                </p>
              )}
            </div>

            {target.current_shift && (
              <p className="text-xs text-muted-foreground">
                The current shift will be closed and preserved in history. The new shift takes effect from the date below.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  Start Time <span className="text-danger">*</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-10 w-full rounded-[12px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  End Time <span className="text-danger">*</span>
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-10 w-full rounded-[12px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                Effective From <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="h-10 w-full rounded-[12px] border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
              />
              {target.current_shift && (
                <p className="text-xs text-muted-foreground">
                  Must be after {fmtDate(target.current_shift.effective_from)}.
                </p>
              )}
            </div>

            {formError && (
              <p className="rounded-[12px] bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button onClick={submit} disabled={submitting || !startTime || !endTime || !effectiveFrom}>
                {submitting ? "Saving…" : target.current_shift ? "Change Shift" : "Assign Shift"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
