"use client";

import dynamic from "next/dynamic";

import { ShellFallback } from "@/components/shell-fallback";
import type { PublicN8nConfig, RoomDetailPayload, RoomSummary } from "@/lib/types";

const HomeShell = dynamic(
  () => import("@/components/home-shell").then((module) => module.HomeShell),
  {
    ssr: false,
    loading: () => (
      <ShellFallback
        description="실시간 채팅 목록과 대화 프리뷰를 불러오고 있습니다."
        title="채팅을 준비하는 중입니다"
      />
    ),
  },
);

export function HomeShellEntry({
  initialRooms,
  initialError,
  initialFilters,
  initialDetail,
  initialDetailError,
  n8nConfig,
}: {
  initialRooms: RoomSummary[];
  initialError: string | null;
  initialFilters: {
    type: string;
    q: string;
    stage:
      | "all"
      | "awkward"
      | "interest"
      | "flirt"
      | "love"
      | "obsession"
      | "group";
  };
  initialDetail: RoomDetailPayload | null;
  initialDetailError: string | null;
  n8nConfig: PublicN8nConfig;
}) {
  return (
    <HomeShell
      initialDetail={initialDetail}
      initialDetailError={initialDetailError}
      initialError={initialError}
      initialFilters={initialFilters}
      initialRooms={initialRooms}
      n8nConfig={n8nConfig}
    />
  );
}
