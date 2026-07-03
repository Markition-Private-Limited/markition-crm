export default function QuotationsLoading() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
          <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="mt-3 h-9 w-72 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="mt-3 h-8 w-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
          <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-5">
        <div className="h-11 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-9 w-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800"><div className="h-4 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" /></div>
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-6">
          <div className="h-4 w-36 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
