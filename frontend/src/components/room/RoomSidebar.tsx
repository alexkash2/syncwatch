import { useEffect, useRef, type ReactNode } from 'react';
import { ChatPanel } from './ChatPanel';
import { ParticipantList } from './ParticipantList';
import { RoomTabs } from './RoomTabs';
import { Badge } from '../ui/Badge';
import { BrandMarkIcon, ChatBubbleIcon, UsersIcon, VideoIcon } from '../ui/icons';
import { usePreferences } from '../../hooks/usePreferences';
import type { ChatMessage, WsParticipant } from '../../types/ws';

type ConnectionState = 'connected' | 'connecting' | 'reconnecting';

interface RoomSidebarProps {
  roomName: string;
  roomCode: string;
  connectionState: ConnectionState;
  activeTab: 'chat' | 'participants';
  setActiveTab: (tab: 'chat' | 'participants') => void;
  sidebarOpen: boolean;
  closeSidebar: () => void;
  participants: WsParticipant[];
  messages: ChatMessage[];
  currentUserId: string;
  hostId: string;
  onSendChat: (content: string) => boolean;
}

export function RoomSidebar({
  roomName,
  roomCode,
  connectionState,
  activeTab,
  setActiveTab,
  sidebarOpen,
  closeSidebar,
  participants,
  messages,
  currentUserId,
  hostId,
  onSendChat,
}: RoomSidebarProps) {
  const readyCount = participants.filter((participant) => participant.is_ready).length;
  const connectionMeta = getConnectionMeta(connectionState);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { preferences } = usePreferences();
  const readinessPercent =
    participants.length > 0 ? Math.round((readyCount / participants.length) * 100) : 0;
  const everyoneReady = participants.length > 0 && readyCount === participants.length;

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeSidebar, sidebarOpen]);

  return (
    <>
      {sidebarOpen && (
        <div
          className="ui-overlay-enter fixed inset-0 z-40 bg-black/55 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        id="room-sidebar-panel"
        aria-label="Room sidebar"
        aria-labelledby="room-sidebar-title"
        className={`
          ui-fade-up fixed right-3 top-[5.5rem] bottom-3 z-50 rounded-[1.9rem]
          transition-all duration-300 md:static md:top-auto md:bottom-auto md:right-auto
          ${preferences.compactSidebar ? 'w-[min(100vw-1.5rem,21rem)] md:w-[19rem]' : 'w-[min(100vw-1.5rem,24rem)] md:w-[22rem]'}
          md:z-auto md:translate-x-0
          ${
            sidebarOpen
              ? 'translate-x-0 opacity-100'
              : 'translate-x-[110%] opacity-0 pointer-events-none md:pointer-events-auto md:translate-x-0 md:opacity-100'
          }
          border border-outline-variant/15 bg-surface-container-low/82 shadow-[0_28px_80px_rgba(0,0,0,0.34)] backdrop-blur-2xl
          flex flex-col shrink-0 overflow-hidden
        `}
      >
        <div className="shrink-0 border-b border-outline-variant/10 p-4 md:p-5">
          <div className="overflow-hidden rounded-[1.65rem] border border-outline-variant/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-3">
                  <span className={`ui-dot-pulse h-2.5 w-2.5 rounded-full ${connectionMeta.dotClass}`} />
                  <span className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                    {connectionMeta.eyebrow}
                  </span>
                </div>
                <h3 id="room-sidebar-title" className="truncate text-lg font-black tracking-tight text-on-surface">
                  {roomName}
                </h3>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-primary">
                  {roomCode}
                </p>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                  {connectionMeta.description}
                </p>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeSidebar}
                className="rounded-full border border-outline-variant/15 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-on-surface-variant transition hover:border-primary-container/40 hover:text-on-surface md:hidden"
                aria-label="Close room sidebar"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone={connectionMeta.tone}>{connectionMeta.badge}</Badge>
              <Badge tone="primary">{everyoneReady ? 'Room Ready' : 'Sync In Progress'}</Badge>
            </div>

            <div className="mt-4 rounded-[1.35rem] border border-outline-variant/14 bg-black/24 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    Group alignment
                  </p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">
                    {everyoneReady ? 'Everyone is matched' : `${readyCount}/${participants.length || 0} participants ready`}
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary-container/18 bg-primary-container/10 text-primary">
                  <UsersIcon size={16} />
                </span>
              </div>

              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  <span>{everyoneReady ? 'Aligned' : 'Preparing room'}</span>
                  <span className="font-mono text-primary">{readinessPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/34">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${everyoneReady ? 'bg-emerald-300' : 'bg-primary'}`}
                    style={{
                      width: `${
                        participants.length > 0
                          ? Math.max(readinessPercent, readyCount > 0 ? 12 : 5)
                          : 5
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <SidebarStat
              label="People"
              value={String(participants.length)}
              text="Live participants connected to the session."
              icon={<UsersIcon size={15} />}
            />
            <SidebarStat
              label="Chat Flow"
              value={String(messages.length)}
              text="Messages currently attached to this room."
              icon={<ChatBubbleIcon size={15} />}
            />
            <SidebarStat
              label="Local Media"
              value={readyCount > 0 ? 'Matched' : 'Pending'}
              text="The room keeps file checks local to each device."
              icon={<VideoIcon size={15} />}
              className="col-span-2"
            />
          </div>

          <div className="mt-4 rounded-[1.35rem] border border-outline-variant/12 bg-surface-container-lowest/78 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-container/18 bg-primary-container/10 text-primary">
                <BrandMarkIcon size={16} />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  Session lane
                </p>
                <p className="mt-1 text-sm text-on-surface">
                  {activeTab === 'chat'
                    ? 'Chat stays tied to the live room context.'
                    : 'Participant status reflects live room readiness.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <RoomTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          participantsCount={participants.length}
        />

        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          role="tabpanel"
          id={activeTab === 'chat' ? 'room-tabpanel-chat' : 'room-tabpanel-participants'}
          aria-labelledby={activeTab === 'chat' ? 'room-tab-chat' : 'room-tab-participants'}
        >
          {activeTab === 'chat' ? (
            <ChatPanel messages={messages} onSend={onSendChat} currentUserId={currentUserId} />
          ) : (
            <ParticipantList
              participants={participants}
              hostId={hostId}
              currentUserId={currentUserId}
            />
          )}
        </div>
      </aside>
    </>
  );
}

function getConnectionMeta(connectionState: ConnectionState) {
  switch (connectionState) {
    case 'connected':
      return {
        eyebrow: 'Sync active',
        badge: 'Connected',
        tone: 'success' as const,
        dotClass: 'bg-emerald-300',
        description: 'Realtime playback, participant presence and chat are connected right now.',
      };
    case 'reconnecting':
      return {
        eyebrow: 'Reconnecting',
        badge: 'Recovering',
        tone: 'warning' as const,
        dotClass: 'bg-amber-200',
        description: 'The room is restoring the websocket session without dropping local state.',
      };
    default:
      return {
        eyebrow: 'Connecting',
        badge: 'Opening link',
        tone: 'neutral' as const,
        dotClass: 'bg-on-surface-variant/60',
        description: 'Opening the live room channel and preparing the synced session.',
      };
  }
}

function SidebarStat({
  label,
  value,
  text,
  icon,
  className,
}: {
  label: string;
  value: string;
  text: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[1.3rem] border border-outline-variant/12 bg-surface-container-lowest/80 px-4 py-3 ${className ?? ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-2 text-lg font-black tracking-tight text-on-surface">{value}</p>
      <p className="mt-2 text-xs leading-6 text-on-surface-variant">{text}</p>
    </div>
  );
}
