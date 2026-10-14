export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 rounded-3xl bg-surface-muted" />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-48 rounded-3xl bg-surface-muted" />
        <div className="h-48 rounded-3xl bg-surface-muted" />
      </div>
      <div className="h-64 rounded-3xl bg-surface-muted" />
    </div>
  );
}
