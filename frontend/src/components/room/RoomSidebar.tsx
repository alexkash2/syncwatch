import { useEffect, useRef } from 'react';
import { ChatPanel } from './ChatPanel';
import { ParticipantList } from './ParticipantList';
import { RoomTabs } from './RoomTabs';
import { ChatBubbleIcon } from '../ui/icons';
import { usePreferences } from '../../hooks/usePreferences';
import type { ChatMessage, WsParticipant } from '../../types/ws';

interface RoomSidebarProps {
  roomName: string;
  activeTab: 'chat' | 'participants';
  setActiveTab: (tab: 'chat' | 'participants') => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  participants: WsParticipant[];
  messages: ChatMessage[];
  currentUserId: string;
  hostId: string;
  onSendChat: (content: string) => boolean;
  onLoadMoreChat?: () => Promise<boolean> | void;
  hasMoreChat?: boolean;
  chatLoadError?: boolean;
  onRetryChatLoad?: () => void | Promise<void>;
}

export function RoomSidebar({
  roomName,
  activeTab,
  setActiveTab,
  sidebarOpen,
  toggleSidebar,
  closeSidebar,
  participants,
  messages,
  currentUserId,
  hostId,
  onSendChat,
  onLoadMoreChat,
  hasMoreChat,
  chatLoadError,
  onRetryChatLoad,
}: RoomSidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { preferences } = usePreferences();

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (sidebarRef.current?.contains(target)) {
        return;
      }

      closeSidebar();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeSidebar, sidebarOpen]);

  return (
    <>
      <aside
        ref={sidebarRef}
        id="room-sidebar-panel"
        aria-label="Room sidebar"
        aria-labelledby="room-sidebar-title"
        className={`
          ui-fade-up fixed right-0 top-0 bottom-0 z-50 rounded-l-[1.9rem] rounded-r-none
          transition-all duration-300
          ${preferences.compactSidebar ? 'w-[min(100vw,21rem)] md:w-[19rem]' : 'w-[min(100vw,24rem)] md:w-[22rem]'}
          ${
            sidebarOpen
              ? 'translate-x-0 opacity-100'
              : 'translate-x-[110%] opacity-0 pointer-events-none'
          }
          border border-outline-variant/15 bg-surface-container-low/82 shadow-[0_28px_80px_rgba(0,0,0,0.34)] backdrop-blur-2xl
          flex flex-col shrink-0 overflow-hidden
        `}
      >
        <div className="shrink-0 px-4 pt-4 md:px-5 md:pt-5">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeSidebar}
            className="flex w-full items-center justify-between gap-3 rounded-[1.35rem] border border-outline-variant/15 bg-black/24 px-4 py-3 text-left shadow-[0_18px_48px_rgba(0,0,0,0.2)] transition hover:border-primary-container/35 hover:bg-black/30"
            aria-label={`Collapse room chat panel for ${roomName}`}
          >
            <span
              id="room-sidebar-title"
              className="truncate text-base font-black tracking-tight text-on-surface md:text-lg"
            >
              Chat
            </span>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-outline-variant/12 bg-black/18 text-primary">
              <ChatBubbleIcon size={18} />
            </span>
          </button>
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
            <ChatPanel
              messages={messages}
              onSend={onSendChat}
              currentUserId={currentUserId}
              onLoadMore={onLoadMoreChat}
              hasMore={hasMoreChat}
              loadError={chatLoadError}
              onRetryLoad={onRetryChatLoad}
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

      {!sidebarOpen && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-40 pr-3 pt-3 md:pr-4 md:pt-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setActiveTab('chat');
                toggleSidebar();
              }}
              className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-primary-container/18 bg-primary-container/10 text-primary shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition hover:border-primary-container/35 hover:bg-primary-container/16 hover:text-white"
              aria-label="Open room chat panel"
              aria-controls="room-sidebar-panel"
              aria-expanded={sidebarOpen}
            >
              <ChatBubbleIcon size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
