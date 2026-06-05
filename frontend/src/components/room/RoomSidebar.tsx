import { useI18n } from '../../hooks/useI18n';
import type { ChatMessage, WsParticipant } from '../../types/ws';
import { Segmented } from '../ui/Segmented';
import { ChatBubbleIcon, UsersIcon } from '../ui/icons';
import { ChatPanel } from './ChatPanel';
import { ParticipantList } from './ParticipantList';

interface RoomSidebarProps {
  activeTab: 'chat' | 'participants';
  setActiveTab: (tab: 'chat' | 'participants') => void;
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
  activeTab,
  setActiveTab,
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
  const { t } = useI18n();

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-line bg-surface">
      <div className="flex justify-center border-b border-line px-4 py-[14px]">
        <Segmented
          idBase="room-sidebar"
          value={activeTab}
          onChange={setActiveTab}
          items={[
            {
              value: 'chat',
              label: t.chat,
              icon: <ChatBubbleIcon size={15} />,
              count: messages.length,
            },
            {
              value: 'participants',
              label: t.participants,
              icon: <UsersIcon size={15} />,
              count: participants.length,
            },
          ]}
        />
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col"
        role="tabpanel"
        id="room-sidebar-panel"
        aria-labelledby={`room-sidebar-tab-${activeTab}`}
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
  );
}
