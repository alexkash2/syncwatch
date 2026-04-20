import type { KeyboardEvent } from 'react';
import { ChatBubbleIcon, UsersIcon } from '../ui/icons';

interface RoomTabsProps {
  activeTab: 'chat' | 'participants';
  setActiveTab: (tab: 'chat' | 'participants') => void;
  participantsCount: number;
}

export function RoomTabs({ activeTab, setActiveTab, participantsCount }: RoomTabsProps) {
  const orderedTabs = ['chat', 'participants'] as const;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: 'chat' | 'participants') => {
    const currentIndex = orderedTabs.indexOf(tab);

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setActiveTab(orderedTabs[(currentIndex + 1) % orderedTabs.length]);
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setActiveTab(orderedTabs[(currentIndex - 1 + orderedTabs.length) % orderedTabs.length]);
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setActiveTab(orderedTabs[0]);
    }

    if (event.key === 'End') {
      event.preventDefault();
      setActiveTab(orderedTabs[orderedTabs.length - 1]);
    }
  };

  return (
    <div className="flex shrink-0 gap-2 px-3 py-3" role="tablist" aria-label="Room sidebar tabs">
      <button
        type="button"
        id="room-tab-chat"
        role="tab"
        aria-selected={activeTab === 'chat'}
        aria-controls="room-tabpanel-chat"
        tabIndex={activeTab === 'chat' ? 0 : -1}
        onClick={() => setActiveTab('chat')}
        onKeyDown={(event) => handleKeyDown(event, 'chat')}
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
        type="button"
        id="room-tab-participants"
        role="tab"
        aria-selected={activeTab === 'participants'}
        aria-controls="room-tabpanel-participants"
        tabIndex={activeTab === 'participants' ? 0 : -1}
        onClick={() => setActiveTab('participants')}
        onKeyDown={(event) => handleKeyDown(event, 'participants')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-[1.2rem] px-3 py-3 text-[10px] font-bold uppercase tracking-[0.16em] transition-all cursor-pointer ${
          activeTab === 'participants'
            ? 'border border-primary-container/22 bg-primary-container/10 text-primary'
            : 'border border-outline-variant/12 bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
        }`}
      >
        <UsersIcon size={15} />
        <span>People</span>
        <span className="rounded-full border border-current/18 px-2 py-0.5 text-[9px] leading-none">
          {participantsCount}
        </span>
      </button>
    </div>
  );
}
