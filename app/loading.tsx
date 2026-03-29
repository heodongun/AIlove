function RoomCardSkeleton() {
  return (
    <div className="glass-panel animate-pulse rounded-[30px] p-5">
      <div className="mb-4 h-5 w-28 rounded-full bg-white/55 dark:bg-white/8" />
      <div className="mb-3 h-7 w-3/4 rounded-full bg-white/70 dark:bg-white/12" />
      <div className="mb-2 h-4 w-full rounded-full bg-white/60 dark:bg-white/8" />
      <div className="mb-4 h-4 w-2/3 rounded-full bg-white/55 dark:bg-white/8" />
      <div className="flex gap-2">
        <div className="h-8 w-8 rounded-full bg-white/70 dark:bg-white/10" />
        <div className="h-8 w-8 rounded-full bg-white/55 dark:bg-white/8" />
        <div className="h-8 w-20 rounded-full bg-white/55 dark:bg-white/8" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <main className="shell-wrap">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <section className="space-y-6">
          <div className="glass-panel rounded-[36px] p-7">
            <div className="mb-4 h-4 w-44 animate-pulse rounded-full bg-white/55 dark:bg-white/8" />
            <div className="mb-4 h-10 w-2/3 animate-pulse rounded-full bg-white/65 dark:bg-white/12" />
            <div className="h-5 w-full animate-pulse rounded-full bg-white/55 dark:bg-white/8" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <RoomCardSkeleton key={index} />
            ))}
          </div>
        </section>
        <aside className="glass-panel hidden rounded-[36px] p-6 lg:block">
          <div className="mb-4 h-4 w-28 animate-pulse rounded-full bg-white/55 dark:bg-white/8" />
          <div className="mb-5 h-8 w-3/4 animate-pulse rounded-full bg-white/65 dark:bg-white/12" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-[26px] bg-white/60 dark:bg-white/8"
              />
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
