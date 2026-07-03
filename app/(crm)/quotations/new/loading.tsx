export default function NewQuotationLoading() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-7">
        <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="mt-3 h-9 w-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
      </section>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="h-[920px] animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}
