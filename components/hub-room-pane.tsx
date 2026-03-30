"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  ActionChipButton,
  ParticipantAvatar,
  RefreshIcon,
  SparkIcon,
} from "@/components/messenger-ui";
import { HubCanvas } from "@/components/hub-canvas";
import { stepHubSimulation } from "@/lib/hub-sim";
import type { HubSceneState } from "@/lib/hub-sim";
import type {
  HubAgent,
  HubCameraState,
  HubEmotionalState,
  HubIntention,
  HubInteraction,
  HubPoi,
  HubRoomDetailPayload,
  HubSimulationEvent,
  HubStoryLog,
} from "@/lib/types";

type LocalSimulationState = {
  agents: HubAgent[];
  interactions: HubInteraction[];
  scene: HubSceneState | null;
  events: HubSimulationEvent[];
  logs: HubStoryLog[];
  camera: HubCameraState;
};

const EMOTIONS: HubEmotionalState[] = [
  "neutral",
  "nervous",
  "interested",
  "avoiding",
  "confessing",
];

const INTENTIONS: HubIntention[] = [
  "approach",
  "escape",
  "wait",
  "observe",
  "confess",
  "interrupt",
  "wander",
];

function emotionMeta(emotion: HubEmotionalState) {
  switch (emotion) {
    case "nervous":
      return { label: "긴장", emoji: "…" };
    case "interested":
      return { label: "의식", emoji: "❤" };
    case "avoiding":
      return { label: "회피", emoji: "↗" };
    case "confessing":
      return { label: "고백", emoji: "!" };
    case "neutral":
    default:
      return { label: "중립", emoji: "·" };
  }
}

function intentionMeta(intention: HubIntention) {
  switch (intention) {
    case "approach":
      return { label: "다가감", emoji: "→" };
    case "escape":
      return { label: "거리둠", emoji: "↘" };
    case "wait":
      return { label: "멈춤", emoji: "…" };
    case "observe":
      return { label: "관찰", emoji: "👁" };
    case "confess":
      return { label: "고백", emoji: "❤" };
    case "interrupt":
      return { label: "끼어듦", emoji: "⚡" };
    case "wander":
    default:
      return { label: "배회", emoji: "◌" };
  }
}

function eventToneClasses(event: HubSimulationEvent | null) {
  if (!event) {
    return "border-[color:var(--line)] bg-[var(--card-surface)]";
  }

  if (event.type === "confession") {
    return "border-[var(--accent-soft-border)] bg-[var(--accent-soft)]";
  }

  if (event.type === "bond_decrease" || event.type === "avoidance_loop") {
    return "border-[rgba(242,122,122,0.28)] bg-[rgba(242,122,122,0.12)]";
  }

  if (event.type === "bond_increase") {
    return "border-[rgba(241,197,92,0.34)] bg-[rgba(241,197,92,0.14)]";
  }

  return "border-[rgba(121,205,188,0.26)] bg-[rgba(121,205,188,0.12)]";
}

function formatLogTime(timestamp: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Seoul",
  }).format(timestamp);
}

function createInitialSimulation(
  detail: HubRoomDetailPayload,
  selectedAgentId: string | null,
): LocalSimulationState {
  const selected =
    (selectedAgentId
      ? detail.agents.find((agent) => agent.id === selectedAgentId)
      : null) ?? detail.agents[0] ?? null;

  return {
    agents: detail.agents,
    interactions: detail.interactions,
    scene: null,
    events: [],
    logs: [],
    camera: {
      focusAgentId: selected?.id ?? null,
      focusTileX: selected?.tileX ?? null,
      focusTileY: selected?.tileY ?? null,
      zoom: selected ? 1.18 : 1,
      reason: selected ? "selected" : "free",
    },
  };
}

function mergeLogs(current: HubStoryLog[], incoming: HubStoryLog[]) {
  const merged = [...incoming, ...current];
  const seen = new Set<string>();

  return merged
    .filter((entry) => {
      if (seen.has(entry.id)) {
        return false;
      }

      seen.add(entry.id);
      return true;
    })
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 16);
}

function HubMiniMap({
  detail,
  agents,
  selectedAgentId,
  activeEvent,
}: {
  detail: HubRoomDetailPayload;
  agents: HubAgent[];
  selectedAgentId: string | null;
  activeEvent: HubSimulationEvent | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = detail.map.palette.minimapBg;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const cellWidth = canvas.width / detail.map.width;
    const cellHeight = canvas.height / detail.map.height;

    for (let y = 0; y < detail.map.height; y += 1) {
      for (let x = 0; x < detail.map.width; x += 1) {
        context.fillStyle = detail.map.collision[y][x]
          ? "rgba(255,255,255,0.14)"
          : "rgba(255,255,255,0.05)";
        context.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
      }
    }

    if (activeEvent) {
      context.fillStyle = "rgba(246,214,112,0.35)";
      context.fillRect(
        activeEvent.tileX * cellWidth,
        activeEvent.tileY * cellHeight,
        cellWidth,
        cellHeight,
      );
    }

    for (const agent of agents) {
      context.fillStyle = agent.themeColor;
      context.fillRect(
        agent.tileX * cellWidth,
        agent.tileY * cellHeight,
        cellWidth,
        cellHeight,
      );

      if (agent.id === selectedAgentId) {
        context.strokeStyle = "#f8f7f2";
        context.lineWidth = 2;
        context.strokeRect(
          agent.tileX * cellWidth + 1,
          agent.tileY * cellHeight + 1,
          Math.max(3, cellWidth - 2),
          Math.max(3, cellHeight - 2),
        );
      }
    }
  }, [activeEvent, agents, detail, selectedAgentId]);

  return (
    <div className="rounded-[20px] border border-[color:var(--line)] bg-[var(--card-surface)] p-3 shadow-[var(--shadow-soft)]">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
        MINIMAP
      </p>
      <canvas
        ref={canvasRef}
        className="mt-2 h-[120px] w-[160px] rounded-[14px] border border-[color:var(--line)] bg-black/30"
        height={120}
        width={160}
      />
    </div>
  );
}

function AgentRosterPanel({
  detail,
  agents,
  selectedAgentId,
  onSelect,
}: {
  detail: HubRoomDetailPayload;
  agents: HubAgent[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
}) {
  return (
    <div className="w-[264px] max-w-full rounded-[22px] border border-[color:var(--line)] bg-[rgba(14,17,25,0.88)] p-3 shadow-[var(--shadow-soft)] backdrop-blur">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
        AGENTS
      </p>
      <div className="mt-3 space-y-2">
        {agents.map((agent) => {
          const participant = detail.participants.find(
            (entry) => entry.id === agent.participantId,
          );
          const emotion = emotionMeta(agent.emotionalState);
          const intention = intentionMeta(agent.intention);

          return (
            <button
              key={agent.id}
              className={`flex w-full items-center gap-3 rounded-[18px] border px-3 py-2 text-left transition-colors ${
                selectedAgentId === agent.id
                  ? "border-[var(--accent-soft-border)] bg-[var(--sidebar-selected)]"
                  : "border-[color:var(--line)] bg-[var(--chip-surface)] hover:bg-[var(--card-quiet)]"
              }`}
              onClick={() => onSelect(agent.id)}
              type="button"
            >
              {participant ? <ParticipantAvatar participant={participant} size={30} /> : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
                  {agent.displayName}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className="rounded-full border border-[color:var(--line)] px-2 py-0.5 text-[10px] text-[var(--foreground)]">
                    {emotion.emoji} {emotion.label}
                  </span>
                  <span className="rounded-full border border-[color:var(--line)] px-2 py-0.5 text-[10px] text-[var(--subtle-foreground)]">
                    {intention.emoji} {intention.label}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventOverlay({
  activeEvent,
  scene,
}: {
  activeEvent: HubSimulationEvent | null;
  scene: HubSceneState | null;
}) {
  return (
    <div
      className={`max-w-[min(100%,560px)] rounded-[22px] border px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur ${eventToneClasses(activeEvent)}`}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
        <span>{activeEvent ? "LIVE EVENT" : "SCENE"}</span>
        {activeEvent?.dominant ? (
          <span className="rounded-full border border-[color:var(--line)] px-2 py-0.5 text-[10px] text-[var(--foreground)]">
            중심 장면
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
        {activeEvent?.title ?? scene?.title ?? "허브 장면이 진행되는 중"}
      </p>
      <p className="mt-1 break-keep text-[13px] leading-6 text-[var(--subtle-foreground)]">
        {activeEvent?.description ?? scene?.summary ?? "지금 장면의 중심 관계가 계속 변하고 있습니다."}
      </p>
    </div>
  );
}

function AgentInspector({
  agents,
  mapPois,
  selectedAgent,
  onSelectMode,
  onSelectEmotion,
  onSelectIntention,
  onSelectTargetAgent,
  onSelectTargetPoi,
}: {
  agents: HubAgent[];
  mapPois: HubPoi[];
  selectedAgent: HubAgent | null;
  onSelectMode: (agentId: string, mode: "auto" | "manual") => void;
  onSelectEmotion: (agentId: string, next: HubEmotionalState) => void;
  onSelectIntention: (agentId: string, next: HubIntention) => void;
  onSelectTargetAgent: (agentId: string, targetAgentId: string | null) => void;
  onSelectTargetPoi: (agentId: string, targetPoiId: string | null) => void;
}) {
  if (!selectedAgent) {
    return (
      <div className="rounded-[24px] border border-[color:var(--line)] bg-[var(--card-surface)] p-4 shadow-[var(--shadow-soft)]">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
          INSPECTOR
        </p>
        <p className="mt-3 break-keep text-[14px] leading-6 text-[var(--subtle-foreground)]">
          허브 안의 에이전트를 클릭하면 감정과 의도를 직접 조정할 수 있습니다.
        </p>
      </div>
    );
  }

  const emotion = emotionMeta(selectedAgent.emotionalState);
  const intention = intentionMeta(selectedAgent.intention);

  return (
    <div className="rounded-[24px] border border-[color:var(--line)] bg-[var(--card-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
            INSPECTOR
          </p>
          <p className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
            {selectedAgent.displayName}
          </p>
          <p className="mt-1 break-keep text-[13px] text-[var(--subtle-foreground)]">
            {selectedAgent.statusLabel ?? "허브 안에서 타이밍을 보는 중"}
          </p>
        </div>
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--line)] text-[14px] font-semibold text-[var(--foreground)]"
          style={{ backgroundColor: `${selectedAgent.themeColor}22` }}
        >
          {selectedAgent.displayName.slice(0, 1)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-[18px] border border-[color:var(--line)] bg-[var(--card-quiet)] px-3 py-2">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
            감정
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[var(--foreground)]">
            {emotion.emoji} {emotion.label}
          </p>
        </div>
        <div className="rounded-[18px] border border-[color:var(--line)] bg-[var(--card-quiet)] px-3 py-2">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
            의도
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[var(--foreground)]">
            {intention.emoji} {intention.label}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
          모드
        </p>
        <div className="mt-2 flex gap-2">
          <ActionChipButton
            active={selectedAgent.mode === "auto"}
            className="flex-1 min-h-9 px-3 text-[12px]"
            label="AI 자동"
            onClick={() => onSelectMode(selectedAgent.id, "auto")}
          />
          <ActionChipButton
            active={selectedAgent.mode === "manual"}
            className="flex-1 min-h-9 px-3 text-[12px]"
            label="직접 개입"
            onClick={() => onSelectMode(selectedAgent.id, "manual")}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
          감정 바꾸기
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {EMOTIONS.map((entry) => (
            <ActionChipButton
              key={entry}
              active={selectedAgent.emotionalState === entry}
              className="min-h-8 px-2.5 text-[11px]"
              label={`${emotionMeta(entry).emoji} ${emotionMeta(entry).label}`}
              onClick={() => onSelectEmotion(selectedAgent.id, entry)}
            />
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
          행동 지시
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTENTIONS.map((entry) => (
            <ActionChipButton
              key={entry}
              active={selectedAgent.intention === entry}
              className="min-h-8 px-2.5 text-[11px]"
              label={`${intentionMeta(entry).emoji} ${intentionMeta(entry).label}`}
              onClick={() => onSelectIntention(selectedAgent.id, entry)}
            />
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
          상대 지정
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {agents
            .filter((agent) => agent.id !== selectedAgent.id)
            .map((agent) => (
              <ActionChipButton
                key={agent.id}
                active={selectedAgent.targetAgentId === agent.id}
                className="min-h-8 px-2.5 text-[11px]"
                label={agent.displayName}
                onClick={() => onSelectTargetAgent(selectedAgent.id, agent.id)}
              />
            ))}
          <ActionChipButton
            className="min-h-8 px-2.5 text-[11px]"
            label="해제"
            onClick={() => onSelectTargetAgent(selectedAgent.id, null)}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
          장소 지정
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {mapPois.slice(0, 6).map((poi) => (
            <ActionChipButton
              key={poi.id}
              active={selectedAgent.targetPoiId === poi.id}
              className="min-h-8 px-2.5 text-[11px]"
              label={poi.label}
              onClick={() => onSelectTargetPoi(selectedAgent.id, poi.id)}
            />
          ))}
          <ActionChipButton
            className="min-h-8 px-2.5 text-[11px]"
            label="해제"
            onClick={() => onSelectTargetPoi(selectedAgent.id, null)}
          />
        </div>
      </div>
    </div>
  );
}

function StoryTimeline({
  logs,
  activeEvent,
}: {
  logs: HubStoryLog[];
  activeEvent: HubSimulationEvent | null;
}) {
  return (
    <section className="border-t border-[color:var(--line)] bg-[rgba(12,14,20,0.76)] px-4 py-3 backdrop-blur sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
            STORY LOG
          </p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--foreground)]">
            {activeEvent?.title ?? "지금 허브에서 새로운 장면이 쌓이는 중"}
          </p>
        </div>
        {activeEvent ? (
          <span className="rounded-full border border-[color:var(--line)] bg-[var(--chip-surface)] px-3 py-1 text-[11px] font-semibold text-[var(--foreground)]">
            {activeEvent.type === "confession"
              ? "잠깐 멈춤 연출"
              : activeEvent.type === "bond_decrease"
                ? "긴장 상승"
                : "감정 변화 반영 중"}
          </span>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {logs.length > 0 ? (
          logs.map((log) => (
            <div
              key={log.id}
              className="rounded-[18px] border border-[color:var(--line)] bg-[var(--card-surface)] px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold text-[var(--foreground)]">
                  {log.tone === "dramatic"
                    ? "드라마"
                    : log.tone === "tense"
                      ? "긴장"
                      : log.tone === "warm"
                        ? "상승"
                        : "흐름"}
                </span>
                <span className="text-[11px] text-[var(--subtle-foreground)]">
                  {formatLogTime(log.createdAt)}
                </span>
              </div>
              <p className="mt-1 break-keep text-[13px] leading-6 text-[var(--subtle-foreground)]">
                {log.text}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-[18px] border border-[color:var(--line)] bg-[var(--card-surface)] px-3 py-3 text-[13px] text-[var(--subtle-foreground)]">
            아직 기록된 장면이 없습니다. 에이전트가 서로를 의식하기 시작하면 이 패널에 서사가 쌓입니다.
          </div>
        )}
      </div>
    </section>
  );
}

export function HubRoomPane({
  detail,
  isRefreshing,
  onRefresh,
}: {
  detail: HubRoomDetailPayload;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const initialAgentId = detail.agents[0]?.id ?? null;
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(initialAgentId);
  const [simulation, setSimulation] = useState<LocalSimulationState>(() =>
    createInitialSimulation(detail, initialAgentId),
  );
  const pauseUntilRef = useRef<number | null>(null);
  const recentMessages = useMemo(
    () => detail.messages.filter((message) => message.messageType === "text").slice(-18),
    [detail.messages],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (pauseUntilRef.current && Date.now() < pauseUntilRef.current) {
        return;
      }

      setSimulation((current) => {
        const next = stepHubSimulation(
          detail.map,
          current.agents,
          detail.relationshipSnapshot,
          recentMessages,
          detail.characterProfiles,
          current.scene,
          selectedAgentId,
          760,
        );

        const pauseMs = next.events[0]?.pauseMs ?? 0;
        if (pauseMs > 0) {
          pauseUntilRef.current = Date.now() + pauseMs;
        }

        return {
          agents: next.agents,
          interactions: next.interactions,
          scene: next.scene,
          events: next.events,
          logs: mergeLogs(current.logs, next.logs),
          camera: next.camera,
        };
      });
    }, 760);

    return () => window.clearInterval(intervalId);
  }, [
    detail.characterProfiles,
    detail.map,
    detail.relationshipSnapshot,
    recentMessages,
    selectedAgentId,
  ]);

  const activeEvent = simulation.events[0] ?? null;
  const selectedAgent =
    simulation.agents.find((agent) => agent.id === selectedAgentId) ?? simulation.agents[0] ?? null;
  const rosterAgents = useMemo(
    () => simulation.agents.slice().sort((left, right) => left.tileY - right.tileY),
    [simulation.agents],
  );

  function patchAgent(agentId: string, mutate: (agent: HubAgent) => HubAgent) {
    setSimulation((current) => ({
      ...current,
      agents: current.agents.map((agent) =>
        agent.id === agentId ? mutate(agent) : agent,
      ),
    }));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="border-b border-[color:var(--line)] bg-[var(--thread-header)] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[22px] font-bold tracking-[-0.04em] text-[var(--foreground)]">
                {detail.room.title} Hub
              </h2>
              <span className="rounded-full bg-[var(--chip-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--foreground)]">
                {detail.room.ambientLabel}
              </span>
              <span className="rounded-full border border-[color:var(--line)] px-2.5 py-1 text-[11px] text-[var(--subtle-foreground)]">
                {detail.relationshipSnapshot.stageLabel}
              </span>
            </div>
            <p className="mt-1 break-keep text-[13px] leading-6 text-[var(--subtle-foreground)]">
              {activeEvent?.description ?? simulation.scene?.summary ?? detail.currentSituation}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {simulation.scene ? (
              <div className="inline-flex max-w-[min(100%,420px)] min-w-0 items-center gap-2 rounded-full border border-[var(--accent-soft-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] text-[var(--foreground)]">
                <SparkIcon className="h-3.5 w-3.5" />
                <span className="truncate break-keep font-semibold">
                  {simulation.scene.title}
                </span>
              </div>
            ) : null}
            <ActionChipButton
              icon={<RefreshIcon className="h-4 w-4" />}
              label={isRefreshing ? "확인 중" : "새로고침"}
              onClick={onRefresh}
            />
          </div>
        </div>
      </header>

      <div className="room-wallpaper relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_24%)]" />

        <div className="relative flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-5">
          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_292px]">
            <div className="relative min-h-[420px] overflow-hidden rounded-[28px] border border-[color:var(--line)] bg-black/20 shadow-[var(--shadow-shell)]">
              <div className="absolute left-1/2 top-4 z-20 w-[min(100%-32px,560px)] -translate-x-1/2 px-3">
                <EventOverlay activeEvent={activeEvent} scene={simulation.scene} />
              </div>

              <div className="absolute left-4 top-4 z-20 hidden xl:block">
                <AgentRosterPanel
                  agents={rosterAgents}
                  detail={detail}
                  onSelect={setSelectedAgentId}
                  selectedAgentId={selectedAgentId}
                />
              </div>

              <div className="absolute bottom-4 right-4 z-20 hidden lg:block">
                <HubMiniMap
                  activeEvent={activeEvent}
                  agents={simulation.agents}
                  detail={detail}
                  selectedAgentId={selectedAgentId}
                />
              </div>

              <HubCanvas
                activeEvent={activeEvent}
                agents={simulation.agents}
                camera={simulation.camera}
                className="block h-full w-full [image-rendering:pixelated]"
                interactions={simulation.interactions}
                map={detail.map}
                onSelectAgent={setSelectedAgentId}
                scene={simulation.scene}
                selectedAgentId={selectedAgentId}
              />
            </div>

            <div className="flex min-h-0 flex-col gap-3">
              <AgentInspector
                agents={simulation.agents}
                mapPois={detail.map.pois}
                onSelectEmotion={(agentId, next) =>
                  patchAgent(agentId, (agent) => ({
                    ...agent,
                    mode: "manual",
                    emotionalState: next,
                  }))
                }
                onSelectIntention={(agentId, next) =>
                  patchAgent(agentId, (agent) => ({
                    ...agent,
                    mode: "manual",
                    intention: next,
                  }))
                }
                onSelectMode={(agentId, mode) =>
                  patchAgent(agentId, (agent) => ({
                    ...agent,
                    mode,
                  }))
                }
                onSelectTargetAgent={(agentId, targetAgentId) =>
                  patchAgent(agentId, (agent) => ({
                    ...agent,
                    mode: "manual",
                    targetAgentId,
                  }))
                }
                onSelectTargetPoi={(agentId, targetPoiId) =>
                  patchAgent(agentId, (agent) => ({
                    ...agent,
                    mode: "manual",
                    targetPoiId,
                  }))
                }
                selectedAgent={selectedAgent}
              />
            </div>
          </div>
        </div>

        <StoryTimeline activeEvent={activeEvent} logs={simulation.logs} />
      </div>
    </div>
  );
}
