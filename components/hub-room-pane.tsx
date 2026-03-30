"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ActionChipButton, ParticipantAvatar, RefreshIcon } from "@/components/messenger-ui";
import { HubCanvas } from "@/components/hub-canvas";
import { stepHubSimulation } from "@/lib/hub-sim";
import type { HubAgent, HubInteraction, HubRoomDetailPayload } from "@/lib/types";

function HubMiniMap({
  detail,
  agents,
}: {
  detail: HubRoomDetailPayload;
  agents: HubAgent[];
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

    for (const agent of agents) {
      context.fillStyle = agent.themeColor;
      context.fillRect(agent.tileX * cellWidth, agent.tileY * cellHeight, cellWidth, cellHeight);
    }
  }, [agents, detail]);

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

function RosterCard({
  detail,
  agents,
}: {
  detail: HubRoomDetailPayload;
  agents: HubAgent[];
}) {
  return (
    <div className="w-[248px] max-w-full rounded-[22px] border border-[color:var(--line)] bg-[var(--card-surface)] p-4 shadow-[var(--shadow-soft)]">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--subtle-foreground)]">
        AGENTS
      </p>
      <div className="mt-3 space-y-2.5">
        {agents.map((agent) => {
          const participant = detail.participants.find(
            (entry) => entry.id === agent.participantId,
          );

          return (
            <div
              key={agent.id}
              className="flex items-center gap-3 rounded-[18px] border border-[color:var(--line)] bg-[var(--chip-surface)] px-3 py-2"
            >
              {participant ? <ParticipantAvatar participant={participant} size={30} /> : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
                  {agent.displayName}
                </p>
                <p className="truncate text-[11px] text-[var(--subtle-foreground)]">
                  {agent.status === "flirting"
                    ? "분위기 올라가는 중"
                    : agent.status === "chatting"
                      ? "대화 중"
                      : agent.currentPoiId
                        ? `${agent.currentPoiId} 쪽으로 이동`
                        : detail.map.ambientLabel}
                </p>
              </div>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: agent.themeColor }}
              />
            </div>
          );
        })}
      </div>
    </div>
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
  const [agents, setAgents] = useState(detail.agents);
  const [interactions, setInteractions] = useState<HubInteraction[]>(detail.interactions);
  const recentMessages = useMemo(
    () => detail.messages.filter((message) => message.messageType === "text").slice(-18),
    [detail.messages],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setAgents((currentAgents) => {
        const next = stepHubSimulation(
          detail.map,
          currentAgents,
          detail.relationshipSnapshot,
          recentMessages,
        );
        setInteractions(next.interactions);
        return next.agents;
      });
    }, 760);

    return () => window.clearInterval(intervalId);
  }, [detail.map, detail.relationshipSnapshot, recentMessages]);

  const primaryInteraction = interactions[0];
  const rosterAgents = useMemo(() => agents.slice().sort((left, right) => left.tileY - right.tileY), [agents]);
  const activeMoments = useMemo(
    () =>
      interactions.slice(0, 3).map((interaction) => {
        const speaker =
          detail.participants.find(
            (participant) => participant.id === interaction.speakerId,
          )?.displayName ??
          detail.participants.find(
            (participant) => participant.handle === interaction.speakerHandle,
          )?.displayName ??
          interaction.speakerHandle ??
          "장면";

        const agentNames = interaction.agentIds
          .map((agentId) => agents.find((agent) => agent.id === agentId)?.displayName)
          .filter(Boolean)
          .join(" · ");

        return {
          id: interaction.id,
          speaker,
          emote: interaction.emote,
          summary:
            interaction.speechText ?? `${agentNames} 사이에 ${interaction.label.toLowerCase()} 장면`,
        };
      }),
    [agents, detail.participants, interactions],
  );

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
            </div>
            <p className="mt-1 break-keep text-[13px] leading-6 text-[var(--subtle-foreground)]">
              {detail.currentSituation}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeMoments.length > 0 ? (
                activeMoments.map((moment) => (
                  <div
                    key={moment.id}
                    className="inline-flex max-w-[min(100%,420px)] min-w-0 items-center gap-2 rounded-full border border-[color:var(--line)] bg-[var(--chip-surface)] px-3 py-1.5 text-[11px] text-[var(--foreground)]"
                  >
                    <span className="shrink-0">{moment.emote ?? "💬"}</span>
                    <span className="max-w-[min(58vw,320px)] truncate break-keep">
                      <strong className="font-semibold">{moment.speaker}</strong>{" "}
                      {moment.summary}
                    </span>
                  </div>
                ))
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[var(--chip-surface)] px-3 py-1.5 text-[11px] text-[var(--subtle-foreground)]">
                  <span>🎭</span>
                  <span>허브에서 서로를 의식하며 움직이는 중</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[color:var(--line)] bg-[var(--chip-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)]">
              {primaryInteraction
                ? `${primaryInteraction.label}: ${primaryInteraction.agentIds.length}명`
                : "지금은 허브를 돌아다니는 중"}
            </span>
            <ActionChipButton
              icon={<RefreshIcon className="h-4 w-4" />}
              label={isRefreshing ? "확인 중" : "새로고침"}
              onClick={onRefresh}
            />
          </div>
        </div>
      </header>

      <div className="room-wallpaper relative flex min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_24%)]" />
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-6 py-5">
          <div className="relative w-full max-w-[1180px]">
            <HubCanvas
              agents={agents}
              className="mx-auto block h-auto w-full rounded-[28px] border border-[color:var(--line)] bg-black/20 shadow-[var(--shadow-shell)] [image-rendering:pixelated]"
              interactions={interactions}
              map={detail.map}
            />

            <div className="pointer-events-none absolute left-4 top-4 hidden xl:block">
              <RosterCard agents={rosterAgents} detail={detail} />
            </div>

            <div className="pointer-events-none absolute bottom-4 right-4 hidden lg:block">
              <HubMiniMap agents={agents} detail={detail} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
