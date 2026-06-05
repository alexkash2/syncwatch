import { useI18n } from '../../hooks/useI18n';
import { useUi } from '../../hooks/useUi';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CodeChip } from '../ui/CodeChip';
import { ChatBubbleIcon, LogoIcon, UsersIcon } from '../ui/icons';

interface MobileRoomHeaderProps {
  roomName: string;
  roomCode: string;
  isHost: boolean;
  connectionState: 'connected' | 'connecting' | 'reconnecting';
  readyParticipants: number;
  totalParticipants: number;
  onLeave: () => void;
}

export function MobileRoomHeader({
  roomName,
  roomCode,
  isHost,
  connectionState,
  readyParticipants,
  totalParticipants,
  onLeave,
}: MobileRoomHeaderProps) {
  const { t } = useI18n();
  const { pushToast } = useUi();
  const connected = connectionState === 'connected';

  return (
    <div className="shrink-0">
      <div className="flex h-[52px] items-center justify-between gap-[10px] border-b border-line bg-surface px-[14px]">
        <div className="flex min-w-0 items-center gap-[10px]">
          <span className="inline-flex shrink-0 text-accent">
            <LogoIcon size={22} />
          </span>
          <span className="truncate text-[15px] font-semibold text-ink">{roomName}</span>
          <Badge tone={isHost ? 'accent' : 'neutral'}>{isHost ? t.host : t.viewer}</Badge>
        </div>
        <Button variant="danger" size="sm" onClick={onLeave} className="shrink-0">
          {isHost ? t.leave_host : t.leave}
        </Button>
      </div>

      <div className="flex h-10 items-center justify-between gap-[10px] border-b border-line bg-surface-2 px-[14px]">
        <CodeChip
          code={roomCode}
          size="sm"
          onCopy={() => pushToast({ tone: 'success', title: t.copied, durationMs: 2000 })}
          onError={() => pushToast({ tone: 'warning', title: t.err_copy_unavailable })}
        />
        <div className="flex items-center gap-[6px] whitespace-nowrap text-[12px] font-semibold text-ink-3">
          <span
            className={'h-[7px] w-[7px] rounded-full ' + (connected ? 'bg-accent' : 'sw-pulse bg-warning')}
          />
          {connected ? t.connected : t.reconnecting}
          <span className="text-ink-4">·</span>
          <span className="tabular-nums">
            {readyParticipants}/{totalParticipants}
          </span>
        </div>
      </div>
    </div>
  );
}

interface MobileTabsProps {
  activeTab: 'chat' | 'participants';
  setActiveTab: (tab: 'chat' | 'participants') => void;
  chatCount: number;
  peopleCount: number;
}

export function MobileTabs({ activeTab, setActiveTab, chatCount, peopleCount }: MobileTabsProps) {
  const { t } = useI18n();
  const order: Array<'chat' | 'participants'> = ['chat', 'participants'];

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }
    event.preventDefault();
    // Two tabs: either arrow toggles to the other one.
    const index = order.indexOf(activeTab);
    setActiveTab(order[(index + 1) % order.length]);
  };

  const item = (value: 'chat' | 'participants', label: string, icon: React.ReactNode, count: number) => {
    const active = activeTab === value;
    return (
      <button
        type="button"
        role="tab"
        id={`mobile-room-tab-${value}`}
        aria-controls="main"
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        onClick={() => setActiveTab(value)}
        onKeyDown={onKeyDown}
        className={
          'inline-flex h-[46px] flex-1 items-center justify-center gap-[7px] border-b-2 text-sm font-semibold transition ' +
          (active ? 'border-accent text-ink' : 'border-transparent text-ink-3')
        }
      >
        {icon}
        {label}
        <span className="text-xs text-ink-4">{count}</span>
      </button>
    );
  };

  return (
    <div role="tablist" className="flex shrink-0 border-b border-line bg-surface">
      {item('chat', t.chat, <ChatBubbleIcon size={15} />, chatCount)}
      {item('participants', t.participants, <UsersIcon size={15} />, peopleCount)}
    </div>
  );
}
