export default function Loading() {
  return (
    <main className="messenger-stage">
      <div className="messenger-app">
        <section className="hidden xl:block" />
        <section className="flex min-h-0 flex-col overflow-hidden border-r border-[color:var(--line)] bg-[color:var(--sidebar)]">
          <div className="border-b border-[color:var(--line)] px-5 py-4">
            <div className="h-8 w-20 animate-pulse rounded-xl bg-[var(--sidebar-selected)]" />
            <div className="mt-4 h-12 animate-pulse rounded-2xl bg-[var(--search-bg)]" />
          </div>
          <div className="messenger-scroll flex-1 space-y-3 px-4 py-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[200px] animate-pulse rounded-[24px] bg-[var(--sidebar-selected)]"
              />
            ))}
          </div>
        </section>
        <section className="flex min-h-0 flex-col overflow-hidden bg-[color:var(--thread-pane)]">
          <div className="flex flex-1 items-center justify-center px-6 py-10">
            <div className="w-full max-w-3xl space-y-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className={`h-16 animate-pulse rounded-[22px] bg-[var(--card-surface)] ${
                    index % 2 === 0 ? "mr-auto w-2/3" : "ml-auto w-1/2"
                  }`}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
