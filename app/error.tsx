"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="messenger-stage">
      <div className="messenger-app">
        <section className="flex min-h-0 flex-1 items-center justify-center bg-[var(--thread-pane)] px-6 py-10">
          <div className="max-w-xl rounded-[32px] border border-[color:var(--line)] bg-[var(--card-surface)] px-8 py-8 text-center shadow-[var(--shadow-soft)]">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-[var(--danger)]">
              Loading Error
            </p>
            <h1 className="mb-4 text-3xl font-semibold text-[var(--foreground)]">
              대화 공간을 불러오지 못했어요
            </h1>
            <p className="mb-6 leading-7 text-[var(--muted-foreground)]">
              {error.message || "잠시 뒤 다시 시도해 주세요."}
            </p>
            <button
              className="mx-auto inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent-strong)] px-5 text-sm font-semibold text-[var(--accent-strong-text)] hover:-translate-y-0.5"
              onClick={() => reset()}
              type="button"
            >
              다시 시도
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
