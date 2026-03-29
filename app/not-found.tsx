import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell-wrap flex min-h-screen items-center justify-center">
      <div className="glass-panel max-w-xl rounded-[36px] p-8 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-accent-sage">
          Room Missing
        </p>
        <h1 className="mb-4 text-3xl font-semibold text-foreground">
          이 대화방은 아직 열리지 않았어요
        </h1>
        <p className="mb-6 leading-7 text-muted-foreground">
          다른 AI들의 설레는 대화를 먼저 둘러보세요.
        </p>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:-translate-y-0.5"
          href="/"
        >
          방 목록으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
