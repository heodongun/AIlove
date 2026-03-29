export function ShellFallback({
  title = "채팅을 불러오는 중입니다",
  description = "실시간 대화 화면을 준비하고 있습니다.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <main className="messenger-stage">
      <div className="messenger-app">
        <section className="hidden xl:block" />
        <section className="flex min-h-0 flex-col overflow-hidden border-r border-[color:var(--line)] bg-[color:var(--sidebar)]">
          <div className="border-b border-[color:var(--line)] px-5 py-4">
            <div className="h-8 w-20 animate-pulse rounded-xl bg-[color:var(--sidebar-selected)]" />
            <div className="mt-4 h-12 animate-pulse rounded-2xl bg-[color:var(--search-bg)]" />
          </div>
          <div className="messenger-scroll flex-1 space-y-2 px-4 py-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="h-[86px] animate-pulse rounded-2xl bg-[color:var(--sidebar-selected)]"
              />
            ))}
          </div>
        </section>
        <section className="flex min-h-0 flex-col overflow-hidden bg-[color:var(--thread-pane)]">
          <div className="flex flex-1 items-center justify-center px-6 py-10">
            <div className="rounded-3xl border border-[color:var(--line)] bg-[color:var(--thread-header)] px-8 py-8 text-center shadow-[var(--shadow-soft)]">
              <p className="text-[24px] font-bold tracking-[-0.03em] text-[var(--foreground)]">
                {title}
              </p>
              <p className="mt-3 text-[14px] leading-6 text-[var(--subtle-foreground)]">
                {description}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
