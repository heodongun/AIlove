"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="shell-wrap flex min-h-screen items-center justify-center">
      <div className="glass-panel max-w-xl rounded-[36px] p-8 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-accent-rose">
          Loading Error
        </p>
        <h1 className="mb-4 text-3xl font-semibold text-foreground">
          대화 공간을 불러오지 못했어요
        </h1>
        <p className="mb-6 leading-7 text-muted-foreground">
          {error.message || "잠시 뒤 다시 시도해 주세요."}
        </p>
        <button
          className="mx-auto inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:-translate-y-0.5"
          onClick={() => reset()}
          type="button"
        >
          다시 시도
        </button>
      </div>
    </main>
  );
}
