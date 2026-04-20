import { ChatPanel } from './ChatPanel';
import { ParticipantList } from './ParticipantList';
import { RoomTabs } from './RoomTabs';
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

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-sm z-40 md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Room sidebar"
        aria-labelledby="room-sidebar-title"
        className={`
          fixed right-3 top-[4.75rem] bottom-3 z-50 w-[min(100vw-1.5rem,24rem)] rounded-[1.75rem]
          transition-all duration-300 md:static md:top-auto md:bottom-auto md:right-auto
          md:z-auto md:w-[22rem] md:translate-x-0
          ${
            sidebarOpen
              ? 'translate-x-0 opacity-100'
              : 'translate-x-[110%] opacity-0 pointer-events-none md:pointer-events-auto md:translate-x-0 md:opacity-100'
          }
          border border-outline-variant/15 bg-surface-container-low/82 shadow-[0_28px_80px_rgba(0,0,0,0.34)] backdrop-blur-2xl
          flex flex-col shrink-0 overflow-hidden
        `}
      >
        <div className="p-5 border-b border-outline-variant/10 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div
                  className={`h-2 w-2 rounded-full ${
                    connectionState === 'connected'
                      ? 'bg-primary-container shadow-[0_0_8px_#0062ff]'
                      : connectionState === 'reconnecting'
                      ? 'bg-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.55)]'
                      : 'bg-outline-variant'
                  }`}
                />
                <span className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                  {connectionMeta.eyebrow}
                </span>
              </div>
              <h3 id="room-sidebar-title" className="text-lg font-black tracking-tight text-on-surface">
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
              type="button"
              onClick={closeSidebar}
              className="rounded-full border border-outline-variant/15 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-on-surface-variant transition hover:border-primary-container/40 hover:text-on-surface md:hidden"
              aria-label="Close room sidebar"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <SidebarStat label="Participants" value={String(participants.length)} />
            <SidebarStat label="Ready" value={`${readyCount}/${participants.length || 0}`} />
          </div>
        </div>

        <RoomTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          participantsCount={participants.length}
        />

        <div
          className="flex-1 overflow-hidden flex flex-col"
          role="tabpanel"
          id={activeTab === 'chat' ? 'room-tabpanel-chat' : 'room-tabpanel-participants'}
          aria-labelledby={activeTab === 'chat' ? 'room-tab-chat' : 'room-tab-participants'}
        >
          {activeTab === 'chat' ? (
            <ChatPanel
              messages={messages}
              onSend={onSendChat}
              currentUserId={currentUserId}
            />
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
        eyebrow: 'Sync Active',
        description: 'Realtime playback, file status and chat are currently connected.',
      };
    case 'reconnecting':
      return {
        eyebrow: 'Reconnecting',
        description: 'The room is trying to restore the websocket session without dropping local state.',
      };
    default:
      return {
        eyebrow: 'Connecting',
        description: 'Opening the live room channel and preparing the realtime session.',
      };
  }
}

function SidebarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant/12 bg-surface-container-lowest/80 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
      <p className="mt-2 text-lg font-black tracking-tight text-on-surface">{value}</p>
    </div>
  );
}
