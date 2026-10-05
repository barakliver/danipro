/** Editor skeleton: header, tabs and the first field, so opening a piece feels immediate. */
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 pt-4 sm:px-6" aria-busy="true" aria-label="טוען את העורך">
      <div className="h-11 w-64 max-w-full animate-pulse rounded-field bg-paper-deep" />
      <div className="mt-4 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-20 animate-pulse rounded-chip bg-paper-deep/70" />
        ))}
      </div>
      <div className="mt-6 h-32 animate-pulse rounded-card bg-paper-deep/70" />
      <div className="mt-4 h-64 animate-pulse rounded-card bg-paper-deep/50" />
    </main>
  );
}
