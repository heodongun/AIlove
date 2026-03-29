"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "ailove-theme";

type ThemeMode = "light" | "dark";

function MoonIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M15.8 3.8a7.8 7.8 0 1 0 4.4 13.9 8.7 8.7 0 1 1-4.4-13.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" className="h-4 w-4">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function resolveTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeScript() {
  const script = `
    (function () {
      try {
        var stored = localStorage.getItem("${STORAGE_KEY}");
        var theme = stored === "light" || stored === "dark"
          ? stored
          : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        document.documentElement.dataset.theme = theme;
      } catch (error) {
        document.documentElement.dataset.theme = "dark";
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export function ThemeToggle({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof document !== "undefined") {
      const current = document.documentElement.dataset.theme;

      if (current === "light" || current === "dark") {
        return current;
      }
    }

    return resolveTheme();
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      aria-label={`${nextTheme === "light" ? "라이트" : "다크"} 모드로 전환`}
      className={`inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[color:var(--line-strong)] bg-[var(--action-surface)] px-3 text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--action-surface-hover)] ${
        compact ? "min-w-10 px-2.5" : ""
      }`}
      onClick={() => {
        applyTheme(nextTheme);
        setTheme(nextTheme);
      }}
      type="button"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      {compact ? null : <span>{theme === "dark" ? "라이트" : "다크"} 모드</span>}
    </button>
  );
}
