"use client";

import * as React from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useSessionProvider } from "@/src/providers/SessionProvider";
import { apiGet } from "@/lib/api";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

// ── Types ────────────────────────────────────────────────────
type Summary = {
  attendance_rate: number; total_late: number; total_wfh: number;
  break_violations: number; expected_days: number; present_days: number; absent_days: number;
};
type EmpRow = {
  profile_id: string; full_name: string;
  days_present: number; days_late: number; days_wfh: number;
  days_absent: number; total_break_minutes: number; break_violations: number;
};
type TrendPoint = { date: string; present: number; wfh: number; absent: number };
type LateByEmp  = { profile_id: string; full_name: string; late_count: number };
type AnalyticsData = {
  summary: Summary; employees: EmpRow[];
  trend: TrendPoint[]; late_by_employee: LateByEmp[];
};

type SortKey = keyof Pick<EmpRow, "days_present"|"days_late"|"days_wfh"|"days_absent"|"total_break_minutes"|"break_violations">;

// ── Preset date ranges ────────────────────────────────────────
function monthRange(offset: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  const from = d.toISOString().split("T")[0];
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from, to: last.toISOString().split("T")[0] };
}
const PRESETS = [
  { label: "This month",  ...monthRange(0)  },
  { label: "Last month",  ...monthRange(-1) },
  { label: "Last 3 months", from: monthRange(-2).from, to: monthRange(0).to },
];

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[20px] border border-border bg-surface p-5 shadow-sm shadow-black/5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-3xl font-bold ${accent ?? "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Sort header ───────────────────────────────────────────────
function SortTh({ label, col, sortKey, sortDir, onSort }: {
  label: string; col: SortKey; sortKey: SortKey; sortDir: "asc"|"desc"; onSort: (k: SortKey) => void;
}) {
  const active = col === sortKey;
  return (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        {active
          ? sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
          : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
      </span>
    </th>
  );
}

// ── Short date label for chart x-axis ─────────────────────────
function shortDate(d: string) {
  const parts = d.split("-");
  return `${parts[2]}/${parts[1]}`;
}

// ── Main page ─────────────────────────────────────────────────
export default function AttendanceAnalyticsPage() {
  const { token, appRole } = useSessionProvider();

  const [preset, setPreset]     = React.useState(0);
  const [customFrom, setFrom]   = React.useState("");
  const [customTo, setTo]       = React.useState("");
  const [data, setData]         = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading]   = React.useState(false);
  const [error, setError]       = React.useState<string | null>(null);
  const [sortKey, setSortKey]   = React.useState<SortKey>("days_absent");
  const [sortDir, setSortDir]   = React.useState<"asc"|"desc">("desc");

  const dateFrom = preset < PRESETS.length ? PRESETS[preset].from : customFrom;
  const dateTo   = preset < PRESETS.length ? PRESETS[preset].to   : customTo;

  function handleSort(col: SortKey) {
    setSortDir(sortKey === col && sortDir === "desc" ? "asc" : "desc");
    setSortKey(col);
  }

  const sortedEmployees = React.useMemo(() => {
    if (!data) return [];
    return [...data.employees].sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "asc" ? diff : -diff;
    });
  }, [data, sortKey, sortDir]);

  React.useEffect(() => {
    if (!token || !dateFrom || !dateTo) return;
    setLoading(true); setError(null);
    apiGet(`/api/attendance/analytics?date_from=${dateFrom}&date_to=${dateTo}`, token)
      .then((d: AnalyticsData) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, dateFrom, dateTo]);

  if (appRole !== "admin") return <p className="text-sm text-muted-foreground">Access restricted.</p>;

  const sum = data?.summary;

  return (
    <div className="space-y-6">
      {/* ── Header + range selector ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Attendance Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : "Select a date range"}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPreset(i)}
              className={`rounded-[14px] border px-3 py-1.5 text-sm transition ${
                preset === i
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-surface text-muted-foreground hover:bg-surface-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setPreset(PRESETS.length)}
            className={`rounded-[14px] border px-3 py-1.5 text-sm transition ${
              preset === PRESETS.length
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface text-muted-foreground hover:bg-surface-muted"
            }`}
          >
            Custom
          </button>
          {preset === PRESETS.length && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={(e) => setFrom(e.target.value)}
                className="rounded-[14px] border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20" />
              <span className="text-muted-foreground">→</span>
              <input type="date" value={customTo} onChange={(e) => setTo(e.target.value)}
                className="rounded-[14px] border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20" />
            </div>
          )}
        </div>
      </div>

      {error && <p className="rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1,2,3,4].map((i) => <div key={i} className="h-24 animate-pulse rounded-[20px] bg-surface" />)}
        </div>
      )}

      {!loading && sum && (
        <>
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Attendance Rate"
              value={`${sum.attendance_rate}%`}
              sub={`${sum.present_days + sum.total_wfh} of ${sum.expected_days} expected days`}
              accent={sum.attendance_rate >= 80 ? "text-green-600 dark:text-green-400" : "text-rose-600 dark:text-rose-400"}
            />
            <StatCard label="Late Arrivals"  value={sum.total_late}   sub="Total across team" accent={sum.total_late > 0 ? "text-amber-600 dark:text-amber-400" : undefined} />
            <StatCard label="WFH Days"       value={sum.total_wfh}    sub="Approved WFH days" accent="text-blue-600 dark:text-blue-400" />
            <StatCard label="Break Overruns" value={sum.break_violations} sub="exceeded_allowance flags" accent={sum.break_violations > 0 ? "text-amber-600 dark:text-amber-400" : undefined} />
          </div>

          {/* ── Charts ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Attendance trend */}
            <div className="rounded-[20px] border border-border bg-surface p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Daily Attendance Trend</h2>
              {data!.trend.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No data in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data!.trend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v, n) => [v, String(n).charAt(0).toUpperCase() + String(n).slice(1)]}
                      labelFormatter={shortDate}
                      contentStyle={{ borderRadius: 12, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="present" name="Present" stackId="a" fill="#22c55e" radius={[0,0,0,0]} />
                    <Bar dataKey="wfh"     name="WFH"     stackId="a" fill="#3b82f6" radius={[0,0,0,0]} />
                    <Bar dataKey="absent"  name="Absent"  stackId="a" fill="#f43f5e" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Late by employee */}
            <div className="rounded-[20px] border border-border bg-surface p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Late Arrivals by Employee</h2>
              {data!.late_by_employee.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No late arrivals in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data!.late_by_employee}
                    layout="vertical"
                    margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="full_name" width={90} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v) => [v, "Late days"]}
                      contentStyle={{ borderRadius: 12, fontSize: 12 }}
                    />
                    <Bar dataKey="late_count" name="Late days" fill="#f59e0b" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Per-employee table ── */}
          <div className="rounded-[20px] border border-border bg-surface">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Employee Breakdown</h2>
              <p className="text-xs text-muted-foreground">Click a column header to sort. Defaults to most absences first.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-wider">Employee</th>
                    <SortTh label="Present"   col="days_present"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Late"      col="days_late"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="WFH"       col="days_wfh"            sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Absent"    col="days_absent"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Break min" col="total_break_minutes" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Overruns"  col="break_violations"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sortedEmployees.map((emp, i) => (
                    <tr
                      key={emp.profile_id}
                      className={`border-b border-border/50 last:border-0 ${i % 2 !== 0 ? "bg-surface-muted/30" : ""}`}
                    >
                      <td className="px-5 py-3 font-medium text-foreground">{emp.full_name}</td>
                      <td className="px-3 py-3 text-right text-green-600 dark:text-green-400">{emp.days_present}</td>
                      <td className={`px-3 py-3 text-right ${emp.days_late > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>{emp.days_late}</td>
                      <td className="px-3 py-3 text-right text-blue-600 dark:text-blue-400">{emp.days_wfh}</td>
                      <td className={`px-3 py-3 text-right ${emp.days_absent > 0 ? "text-rose-600 dark:text-rose-400 font-medium" : "text-muted-foreground"}`}>{emp.days_absent}</td>
                      <td className="px-3 py-3 text-right text-muted-foreground">{emp.total_break_minutes}</td>
                      <td className={`px-3 py-3 text-right ${emp.break_violations > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{emp.break_violations}</td>
                    </tr>
                  ))}
                  {sortedEmployees.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">No data found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
