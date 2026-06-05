import { useI18n } from '../../hooks/useI18n';
import { useUi } from '../../hooks/useUi';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CodeChip } from '../ui/CodeChip';
import { LangToggle } from '../ui/LangToggle';
import { LogoIcon, UsersIcon } from '../ui/icons';

interface RoomHeaderProps {
  roomName: string;
  roomCode: string;
  connectionState: 'connected' | 'connecting' | 'reconnecting';
  isHost: boolean;
  readyParticipants: number;
  totalParticipants: number;
  onLeave: () => void;
}

export function RoomHeader({
  roomName,
  roomCode,
  connectionState,
  isHost,
  readyParticipants,
  totalParticipants,
  onLeave,
}: RoomHeaderProps) {
  const { t } = useI18n();
  const { pushToast } = useUi();
  const connected = connectionState === 'connected';

  return (
    <header className="flex h-[68px] shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-[22px]">
      {/* left: brand + room name */}
      <div className="flex min-w-0 items-center gap-[14px]">
        <button
          type="button"
          onClick={onLeave}
          aria-label={t.back}
          className="inline-flex shrink-0 text-accent"
        >
          <LogoIcon size={24} />
        </button>
        <div className="flex min-w-0 items-center gap-[9px]">
          <h1 className="m-0 max-w-[240px] truncate text-base font-semibold -tracking-[0.01em] text-ink">
            {roomName}
          </h1>
          <Badge tone={isHost ? 'accent' : 'neutral'}>{isHost ? t.host : t.viewer}</Badge>
        </div>
      </div>

      {/* center: room code — always visible, one-click copy */}
      <div className="hidden items-center gap-[10px] md:flex">
        <span className="text-xs font-semibold tracking-[0.02em] text-ink-4">{t.room_code}</span>
        <CodeChip
          code={roomCode}
          onCopy={() => pushToast({ tone: 'success', title: t.copied, durationMs: 2000 })}
          onError={() => pushToast({ tone: 'warning', title: t.err_copy_unavailable })}
        />
      </div>

      {/* right: status + lang + leave */}
      <div className="flex items-center gap-[14px]">
        <div className="hidden items-center gap-[7px] text-[12.5px] font-semibold text-ink-3 sm:flex">
          <span
            className={
              'h-[7px] w-[7px] rounded-full ' + (connected ? 'bg-accent' : 'sw-pulse bg-warning')
            }
          />
          {connected ? t.connected : t.reconnecting}
        </div>
        <div className="hidden items-center gap-[6px] text-[12.5px] font-semibold text-ink-3 sm:flex">
          <UsersIcon size={15} />
          <span className="tabular-nums">
            {readyParticipants}/{totalParticipants} {t.ready_n}
          </span>
        </div>
        <div className="hidden h-6 w-px bg-line sm:block" />
        <LangToggle />
        <Button variant="danger" size="sm" onClick={onLeave}>
          {isHost ? t.leave_host : t.leave}
        </Button>
      </div>
    </header>
  );
}
