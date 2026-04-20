import { ChatBubbleIcon, UsersIcon } from '../ui/icons';

interface RoomTabsProps {
  activeTab: 'chat' | 'participants';
  setActiveTab: (tab: 'chat' | 'participants') => void;
  participantsCount: number;
}

export function RoomTabs({ activeTab, setActiveTab, participantsCount }: RoomTabsProps) {
  return (
    <div className="flex shrink-0 gap-2 px-3 py-3">
      <button
        onClick={() => setActiveTab('chat')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-[1.2rem] px-3 py-3 text-[10px] font-bold uppercase tracking-[0.16em] transition-all cursor-pointer ${
          activeTab === 'chat'
            ? 'border border-primary-container/22 bg-primary-container/10 text-primary'
            : 'border border-outline-variant/12 bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
        }`}
      >
        <ChatBubbleIcon size={15} />
        Chat
      </button>

      <button
        onClick={() => setActiveTab('participants')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-[1.2rem] px-3 py-3 text-[10px] font-bold uppercase tracking-[0.16em] transition-all cursor-pointer ${
          activeTab === 'participants'
            ? 'border border-primary-container/22 bg-primary-container/10 text-primary'
            : 'border border-outline-variant/12 bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
        }`}
      >
        <UsersIcon size={15} />
        <span>People ({participantsCount})</span>
      </button>
    </div>
  );
}
