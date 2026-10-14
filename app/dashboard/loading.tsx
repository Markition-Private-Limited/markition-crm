import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Skeleton className="h-52 rounded-[20px]" />
        <Skeleton className="h-52 rounded-[20px]" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-[20px]" />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Skeleton className="h-72 rounded-[20px]" />
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-[20px]" />
          <Skeleton className="h-36 rounded-[20px]" />
        </div>
      </section>
    </div>
  );
}
