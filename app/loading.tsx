export default function Loading() {
  return (
    <main className="bg-[var(--bg-primary)] min-h-screen theme-transition">
      <div className="pt-32 px-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 w-64 bg-[var(--surface-disabled)] rounded-lg animate-pulse" />
          <div className="h-16 w-96 bg-[var(--surface-disabled)] rounded-lg animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 bg-[var(--surface-disabled)] rounded-2xl animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
