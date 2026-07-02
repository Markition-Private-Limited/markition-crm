export default function ContactsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="mt-3 h-9 w-52 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-10 w-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="grid grid-cols-6 gap-4 px-5 py-4">
              <div className="h-5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
