/** Shown instantly while a screen's data loads, so a tap always answers right away. */
export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:pt-10" aria-busy="true" aria-label="טוען">
      <div className="h-8 w-48 animate-pulse rounded-field bg-paper-deep" />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded-field bg-paper-deep/70" />
      <div className="mt-8 flex flex-col gap-4">
        <div className="h-56 animate-pulse rounded-card bg-paper-deep/80" />
        <div className="h-24 animate-pulse rounded-card bg-paper-deep/60" />
        <div className="h-24 animate-pulse rounded-card bg-paper-deep/40" />
      </div>
    </main>
  );
}
