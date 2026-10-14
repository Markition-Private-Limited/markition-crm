"use client";

import * as React from "react";
import {
  ChevronLeft, ChevronRight, X, Clock, Coffee,
  AlertTriangle, CheckCircle2, LogIn, LogOut,
} from "lucide-react";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────
type BreakRow = {
  id: string; break_type: string; started_at: string;
  ended_at: string | null; duration_minutes: number | null;
  exceeded_allowance: boolean;
};

type WfhSubmission = {
  id: string; status: "pending" | "approved" | "rejected";
  submitted_at: string; submitted_late: boolean;
  proof_text: string | null; proof_file_path: string | null;
  review_note: string | null;
};

type DayData = {
  status: "present" | "wfh" | "absent" | "pending_wfh" | "future";
  punctuality: "early" | "on_time" | "late" | null;
  check_in_at: string | null; check_out_at: string | null;
  shift_completed: boolean | null;
  breaks: BreakRow[];
  wfh_submission: WfhSubmission | null;
};

type EmployeeCalendar = {
  profile_id: string; full_name: string; email: string;
  employee_code: string | null;
  days: Record<string, DayData>;
};

// ── Status config ────────────────────────────────────────────
const STATUS: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  present:     { label: "Present",    bg: "bg-green-500/15",  text: "text-green-700 dark:text-green-400",  dot: "bg-green-500"  },
  wfh:         { label: "WFH",        bg: "bg-blue-500/15",   text: "text-blue-700 dark:text-blue-400",    dot: "bg-blue-500"   },
  pending_wfh: { label: "Pending",    bg: "bg-orange-400/15", text: "text-orange-700 dark:text-orange-400", dot: "bg-orange-400" },
  absent:      { label: "Absent",     bg: "bg-rose-500/15",   text: "text-rose-700 dark:text-rose-400",    dot: "bg-rose-500"   },
  future:      { label: "",           bg: "",                  text: "",                                    dot: ""              },
};

const LATE_DOT = "bg-amber-500"; // overrides present dot when late

// ── Helpers ──────────────────────────────────────────────────
function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString([], {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function isWeekend(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.getDay() === 0 || d.getDay() === 6;
}

function getDayDot(day: DayData): string {
  if (!day || day.status === "future") return "";
  if (day.status === "present" && day.punctuality === "late") return LATE_DOT;
  return STATUS[day.status]?.dot ?? "";
}

// ── Main component ───────────────────────────────────────────
export default function AttendanceCalendarPage() {
  const { token, appRole } = useSessionProvider();
  const today = new Date();

  const [year, setYear]  = React.useState(today.getFullYear());
  const [month, setMonth] = React.useState(today.getMonth()); // 0-indexed
  const [filterProfile, setFilterProfile] = React.useState("");
  const [data, setData]   = React.useState<EmployeeCalendar[]>([]);
  // Separate list used only for the dropdown — never replaced by a filtered fetch
  const [allEmployees, setAllEmployees] = React.useState<{ profile_id: string; full_name: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError]  = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<{ emp: EmployeeCalendar; date: string } | null>(null);

  // Date range for the selected month
  const dateFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay  = new Date(year, month + 1, 0).getDate();
  const dateTo   = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // All days in the month
  const days = React.useMemo<string[]>(() => {
    const arr: string[] = [];
    for (let d = 1; d <= lastDay; d++) {
      arr.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    return arr;
  }, [year, month, lastDay]);

  React.useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
    if (filterProfile) qs.set("profile_id", filterProfile);
    apiGet(`/api/attendance/calendar?${qs}`, token)
      .then((res) => {
        const data = res as EmployeeCalendar[]
        setData(data)
        // Only update the dropdown list when fetching everyone
        if (!filterProfile) {
          setAllEmployees(data.map((e) => ({ profile_id: e.profile_id, full_name: e.full_name })))
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, dateFrom, dateTo, filterProfile]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelected(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelected(null);
  }
  function goToday() {
    setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(null);
  }

  const MONTH_NAMES = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];

  if (appRole !== "admin") {
    return <p className="text-sm text-muted-foreground">Access restricted to admins.</p>;
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* ── Header bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-[16px] border border-border bg-surface p-1">
          <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-[14px] hover:bg-surface-muted">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-semibold">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-[14px] hover:bg-surface-muted">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={goToday}
          className="rounded-[14px] border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-muted"
        >
          Today
        </button>

        {allEmployees.length > 0 && (
          <select
            value={filterProfile}
            onChange={(e) => { setFilterProfile(e.target.value); setSelected(null); }}
            className="rounded-[14px] border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="">All employees</option>
            {allEmployees.map((e) => (
              <option key={e.profile_id} value={e.profile_id}>{e.full_name}</option>
            ))}
          </select>
        )}

        {/* Legend */}
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {[
            { dot: "bg-green-500",  label: "Present" },
            { dot: LATE_DOT,        label: "Late" },
            { dot: "bg-blue-500",   label: "WFH" },
            { dot: "bg-orange-400", label: "Pending WFH" },
            { dot: "bg-rose-500",   label: "Absent" },
          ].map(({ dot, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {/* ── Calendar table ── */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="flex-1 overflow-auto rounded-[20px] border border-border bg-surface">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : data.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No attendance-enabled employees found.
            </div>
          ) : (
            <table className="min-w-max border-collapse text-xs">
              <thead>
                <tr className="border-b border-border">
                  {/* sticky employee name header */}
                  <th className="sticky left-0 z-10 min-w-[160px] border-r border-border bg-surface px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Employee
                  </th>
                  {days.map((date) => {
                    const d = parseInt(date.split("-")[2], 10);
                    const weekend = isWeekend(date);
                    const isToday = date === today.toISOString().split("T")[0];
                    return (
                      <th
                        key={date}
                        className={`min-w-[40px] border-r border-border/50 px-1 py-2 text-center font-semibold ${
                          weekend ? "bg-surface-muted text-muted-foreground/60" : "text-muted-foreground"
                        } ${isToday ? "bg-accent/10 text-accent" : ""}`}
                      >
                        {d}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.map((emp, ei) => (
                  <tr
                    key={emp.profile_id}
                    className={ei % 2 === 0 ? "" : "bg-surface-muted/30"}
                  >
                    {/* sticky name cell */}
                    <td className="sticky left-0 z-10 border-r border-border bg-inherit px-3 py-2">
                      <div className="font-medium text-foreground leading-snug">{emp.full_name}</div>
                      {emp.employee_code && (
                        <div className="text-[10px] text-muted-foreground">{emp.employee_code}</div>
                      )}
                    </td>
                    {days.map((date) => {
                      const day = emp.days[date] as DayData | undefined;
                      const dot = day ? getDayDot(day) : "";
                      const weekend = isWeekend(date);
                      const isActive = selected?.emp.profile_id === emp.profile_id && selected.date === date;

                      return (
                        <td
                          key={date}
                          onClick={() => day && day.status !== "future" && setSelected({ emp, date })}
                          className={`border-r border-border/50 px-1 py-1 text-center transition ${
                            weekend ? "bg-surface-muted/40" : ""
                          } ${
                            day && day.status !== "future"
                              ? "cursor-pointer hover:bg-accent/5"
                              : ""
                          } ${isActive ? "bg-accent/10" : ""}`}
                        >
                          {dot && (
                            <span className={`mx-auto block h-3 w-3 rounded-full ${dot}`} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Detail panel ── */}
        {selected && (() => {
          const day = selected.emp.days[selected.date] as DayData;
          const cfg = STATUS[day.status] ?? STATUS.absent;
          return (
            <aside className="w-72 shrink-0 overflow-y-auto rounded-[20px] border border-border bg-surface p-4">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground leading-snug">{selected.emp.full_name}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(selected.date)}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-surface-muted"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* Status badge */}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                {day.punctuality === "late" && day.status === "present" ? "Late" : cfg.label}
              </span>

              {/* Check-in / Check-out */}
              {(day.check_in_at || day.check_out_at) && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <LogIn className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground">Check-in:</span>
                    <span className="font-medium text-foreground">{fmtTime(day.check_in_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <LogOut className="h-4 w-4 text-rose-500" />
                    <span className="text-muted-foreground">Check-out:</span>
                    <span className="font-medium text-foreground">{fmtTime(day.check_out_at)}</span>
                  </div>
                </div>
              )}

              {/* Punctuality + shift completed */}
              {day.check_in_at && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-[12px] bg-surface-muted p-2 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Punctuality</p>
                    <p className="mt-0.5 text-sm font-semibold capitalize text-foreground">
                      {day.punctuality?.replace("_", " ") ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-[12px] bg-surface-muted p-2 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Shift Done</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                      {day.shift_completed === null ? "—" : day.shift_completed ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
              )}

              {/* Breaks */}
              {day.breaks.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Breaks ({day.breaks.length})
                  </p>
                  <div className="space-y-1.5">
                    {day.breaks.map((b) => (
                      <div
                        key={b.id}
                        className={`flex items-center gap-2 rounded-[12px] px-3 py-2 text-xs ${
                          b.exceeded_allowance ? "bg-amber-500/10" : "bg-surface-muted"
                        }`}
                      >
                        <Coffee className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1">
                          <span className="font-medium">
                            {b.break_type === "long_break" ? "Long" : "Short"}
                          </span>
                          <span className="ml-1 text-muted-foreground">
                            {fmtTime(b.started_at)} – {fmtTime(b.ended_at)}
                          </span>
                          {b.duration_minutes != null && (
                            <span className="ml-1">({b.duration_minutes} min)</span>
                          )}
                        </div>
                        {b.exceeded_allowance && (
                          <span title="Exceeded allowance"><AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" /></span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WFH submission */}
              {day.wfh_submission && (
                <div className="mt-4 rounded-[14px] border border-border p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    WFH Submission
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Status:</span>
                      <span className={`font-medium capitalize ${
                        day.wfh_submission.status === "approved" ? "text-green-600 dark:text-green-400"
                        : day.wfh_submission.status === "rejected" ? "text-rose-600 dark:text-rose-400"
                        : "text-orange-600 dark:text-orange-400"
                      }`}>
                        {day.wfh_submission.status}
                      </span>
                      {day.wfh_submission.submitted_late && (
                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">
                          Late submission
                        </span>
                      )}
                    </div>
                    {day.wfh_submission.proof_text && (
                      <p className="line-clamp-3 text-muted-foreground italic">
                        "{day.wfh_submission.proof_text}"
                      </p>
                    )}
                    {day.wfh_submission.proof_file_path && (
                      <p className="flex items-center gap-1 text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        File attached
                      </p>
                    )}
                    {day.wfh_submission.review_note && (
                      <p className="rounded-[10px] bg-surface-muted px-2 py-1.5 text-muted-foreground">
                        Note: {day.wfh_submission.review_note}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Absent with no data */}
              {day.status === "absent" && !day.check_in_at && !day.wfh_submission && (
                <p className="mt-4 text-xs text-muted-foreground">
                  No attendance record found for this day.
                </p>
              )}
            </aside>
          );
        })()}
      </div>
    </div>
  );
}
