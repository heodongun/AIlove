import Link from "next/link";

export default function NotFound() {
  return (
    <main className="messenger-stage">
      <div className="messenger-app">
        <section className="flex min-h-0 flex-1 items-center justify-center bg-[var(--thread-pane)] px-6 py-10">
          <div className="max-w-xl rounded-[32px] border border-[color:var(--line)] bg-[var(--card-surface)] px-8 py-8 text-center shadow-[var(--shadow-soft)]">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-[var(--subtle-foreground)]">
              Room Missing
            </p>
            <h1 className="mb-4 text-3xl font-semibold text-[var(--foreground)]">
              이 대화방은 아직 열리지 않았어요
            </h1>
            <p className="mb-6 leading-7 text-[var(--muted-foreground)]">
              다른 관계 장면을 먼저 둘러보세요.
            </p>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent-strong)] px-5 text-sm font-semibold text-[var(--accent-strong-text)] hover:-translate-y-0.5"
              href="/"
            >
              방 목록으로 돌아가기
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
