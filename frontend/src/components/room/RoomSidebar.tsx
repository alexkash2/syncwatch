import { ChatPanel } from './ChatPanel';
import { ParticipantList } from './ParticipantList';
import { RoomTabs } from './RoomTabs';
import type { ChatMessage, WsParticipant } from '../../types/ws';

interface RoomSidebarProps {
  roomName: string;
  roomCode: string;
  isConnected: boolean;
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
  isConnected,
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

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-sm z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`
          fixed right-3 top-[4.75rem] bottom-3 z-50 w-[min(100vw-1.5rem,24rem)] rounded-[1.75rem]
          transition-transform duration-300 md:static md:top-auto md:bottom-auto md:right-auto
          md:z-auto md:w-[22rem] md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-[110%] md:translate-x-0'}
          border border-outline-variant/15 bg-surface-container-low/82 shadow-[0_28px_80px_rgba(0,0,0,0.34)] backdrop-blur-2xl
          flex flex-col shrink-0
        `}
      >
        <div className="p-5 border-b border-outline-variant/10 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div
                  className={`h-2 w-2 rounded-full ${
                    isConnected
                      ? 'bg-primary-container shadow-[0_0_8px_#0062ff]'
                      : 'bg-outline-variant'
                  }`}
                />
                <span className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                  {isConnected ? 'Sync Active' : 'Reconnecting'}
                </span>
              </div>
              <h3 className="text-lg font-black tracking-tight text-on-surface">{roomName}</h3>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-primary">
                {roomCode}
              </p>
            </div>

            <button
              onClick={closeSidebar}
              className="rounded-full border border-outline-variant/15 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-on-surface-variant transition hover:border-primary-container/40 hover:text-on-surface md:hidden"
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

        <div className="flex-1 overflow-hidden flex flex-col">
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

function SidebarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant/12 bg-surface-container-lowest/80 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
      <p className="mt-2 text-lg font-black tracking-tight text-on-surface">{value}</p>
    </div>
  );
}
