import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router';
import { createRoom, deleteRoom, joinRoom, listRooms } from '../../api/rooms';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useUi } from '../../hooks/useUi';
import type { HomeLocationState } from '../../types/navigation';
import type { Room } from '../../types/room';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CodeChip } from '../ui/CodeChip';
import { IconField } from '../ui/IconField';
import { Panel } from '../ui/Panel';
import {
  ArrowUpRightIcon,
  CheckIcon,
  FilmIcon,
  KeyIcon,
  PlusIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from '../ui/icons';

function CardHead({
  icon,
  tone,
  title,
  sub,
}: {
  icon: ReactNode;
  tone: 'accent' | 'ink';
  title: string;
  sub: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-[11px]">
        <span
          className={
            'inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] ' +
            (tone === 'accent' ? 'bg-accent-tint text-accent-strong' : 'bg-surface-3 text-ink-2')
          }
        >
          {icon}
        </span>
        <h2 className="m-0 whitespace-nowrap text-[19px] font-semibold -tracking-[0.02em] text-ink">
          {title}
        </h2>
      </div>
      <p className="m-0 text-sm leading-[1.5] text-ink-3">{sub}</p>
    </div>
  );
}

function FileStatus({ ready }: { ready: boolean }) {
  const { t } = useI18n();
  return ready ? (
    <span className="inline-flex items-center gap-[5px] font-semibold text-accent-strong">
      <CheckIcon size={13} />
      {t.file_ready}
    </span>
  ) : (
    <span className="text-ink-4">{t.no_file}</span>
  );
}

const Dot = () => <span className="text-ink-4 opacity-55">·</span>;

interface RoomRowProps {
  room: Room;
  isHost: boolean;
  last: boolean;
  onOpen: (room: Room) => void;
  onDelete: (room: Room) => void;
  onCopy: (room: Room) => void;
  onCopyError: () => void;
}

function RoomRow({ room, isHost, last, onOpen, onDelete, onCopy, onCopyError }: RoomRowProps) {
  const { t, lang } = useI18n();
  const isMobile = useIsMobile();
  const created = new Date(room.created_at).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });

  const avatar = (
    <span
      className={
        'inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] ' +
        (isHost ? 'bg-accent-tint text-accent-strong' : 'bg-surface-3 text-ink-2')
      }
    >
      {isHost ? <UserIcon size={18} /> : <UsersIcon size={18} />}
    </span>
  );

  const info = (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="truncate text-[15.5px] font-semibold -tracking-[0.01em] text-ink">
          {room.name}
        </span>
        <Badge tone={isHost ? 'accent' : 'neutral'}>{isHost ? t.host : t.viewer}</Badge>
      </div>
      <div className="mt-[5px] flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
        <FileStatus ready={room.file_version > 0} />
        <Dot />
        <span>{created}</span>
        <Dot />
        <span>
          {room.max_participants} {t.seats}
        </span>
      </div>
    </div>
  );

  const del = isHost && (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      aria-label={t.delete}
      onClick={() => onDelete(room)}
      className="shrink-0 text-ink-4"
    >
      <XIcon size={16} />
    </Button>
  );

  if (isMobile) {
    return (
      <div
        className={
          'flex flex-col gap-3 px-4 py-[14px] ' + (last ? '' : 'border-b border-line')
        }
      >
        <div className="flex items-center gap-3">
          {avatar}
          {info}
          {del}
        </div>
        <div className="flex items-center gap-2">
          <CodeChip
            code={room.room_code}
            size="sm"
            onCopy={() => onCopy(room)}
            onError={onCopyError}
          />
          <Button
            variant="outline"
            size="sm"
            fullWidth
            leadingIcon={<ArrowUpRightIcon size={14} />}
            onClick={() => onOpen(room)}
          >
            {t.open}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        'flex items-center gap-4 px-[18px] py-[14px] transition hover:bg-surface-2 ' +
        (last ? '' : 'border-b border-line')
      }
    >
      {avatar}
      {info}
      <div className="flex shrink-0 items-center gap-2">
        <CodeChip
          code={room.room_code}
          size="sm"
          onCopy={() => onCopy(room)}
          onError={onCopyError}
        />
        <Button
          variant="outline"
          size="sm"
          leadingIcon={<ArrowUpRightIcon size={14} />}
          onClick={() => onOpen(room)}
        >
          {t.open}
        </Button>
        {del}
      </div>
    </div>
  );
}

/** Authenticated dashboard — create room, join by code, and your rooms. */
export function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();
  const { confirm, pushToast } = useUi();
  const isMobile = useIsMobile();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const data = await listRooms();
      setRooms(data.rooms);
    } catch {
      pushToast({ tone: 'warning', title: t.err_load_rooms });
    }
  }, [pushToast, t.err_load_rooms]);

  useEffect(() => {
    void fetchRooms();
  }, [fetchRooms]);

  // Arrival notice (bounced here from a closed/gone room) → a single toast.
  useEffect(() => {
    const routeState = (location.state as HomeLocationState | null) ?? null;
    if (!routeState?.arrivalNotice && !routeState?.flash) {
      return;
    }

    if (routeState.arrivalNotice) {
      const { key, tone } = routeState.arrivalNotice;
      pushToast({
        tone: tone === 'neutral' ? 'primary' : tone,
        title: t[`arr_${key}_title` as keyof typeof t],
        description: t[`arr_${key}_sub` as keyof typeof t],
        durationMs: 4200,
      });
    } else if (routeState.flash) {
      pushToast({ tone: 'primary', title: routeState.flash, durationMs: 4200 });
    }

    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate, pushToast, t]);

  const sortedRooms = useMemo(
    () =>
      [...rooms].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [rooms]
  );

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    setIsCreating(true);
    try {
      const room = await createRoom(name.trim());
      navigate(`/room/${room.id}`);
    } catch (err: unknown) {
      pushToast({
        tone: 'danger',
        title: t.err_create_room,
        description: (err as { response?: { data?: { detail?: string } } }).response?.data?.detail,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    if (code.trim().length !== 8) {
      return;
    }
    setIsJoining(true);
    try {
      const room = await joinRoom(code.trim().toUpperCase());
      navigate(`/room/${room.id}`);
    } catch (err: unknown) {
      pushToast({
        tone: 'danger',
        title: t.err_join_room,
        description: (err as { response?: { data?: { detail?: string } } }).response?.data?.detail,
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleDelete = useCallback(
    async (room: Room) => {
      const confirmed = await confirm({
        title: t.delete_room_q,
        description: t.delete_room_sub,
        confirmLabel: t.delete_room_btn,
        cancelLabel: t.keep_room,
        tone: 'danger',
      });
      if (!confirmed) {
        return;
      }
      try {
        await deleteRoom(room.id);
        pushToast({
          tone: 'success',
          title: t.toast_room_deleted_title,
          description: t.toast_room_deleted_sub,
        });
        await fetchRooms();
      } catch (err: unknown) {
        pushToast({
          tone: 'danger',
          title: t.toast_delete_failed_title,
          description: (err as { response?: { data?: { detail?: string } } }).response?.data
            ?.detail,
        });
      }
    },
    [confirm, fetchRooms, pushToast, t]
  );

  const handleCopy = useCallback(() => {
    pushToast({ tone: 'success', title: t.copied, durationMs: 2000 });
  }, [pushToast, t.copied]);

  const handleCopyError = useCallback(() => {
    pushToast({ tone: 'warning', title: t.err_copy_unavailable });
  }, [pushToast, t.err_copy_unavailable]);

  return (
    <div
      className={
        'mx-auto max-w-[1220px] ' + (isMobile ? 'px-4 pb-14 pt-6' : 'px-7 pb-16 pt-10')
      }
    >
      <div className="sw-fade-up mb-6">
        <h1 className="m-0 text-[27px] font-bold -tracking-[0.03em] text-ink">{t.dash_title}</h1>
        <p className="mt-2 text-[15px] text-ink-3">{t.dash_sub}</p>
      </div>

      <div className="sw-fade-up flex flex-wrap items-start gap-4 md:gap-[22px]">
        {/* Left column — actions */}
        <div className="flex w-full flex-grow flex-col gap-4 md:w-[340px] md:flex-grow-0 md:gap-4">
          <Panel padding="lg">
            <CardHead
              icon={<PlusIcon size={18} />}
              tone="accent"
              title={t.new_room}
              sub={t.new_room_sub}
            />
            <form onSubmit={handleCreate} className="mt-[18px] flex flex-col gap-[14px]">
              <IconField
                icon={<FilmIcon size={18} />}
                label={t.room_name}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.room_name_ph}
                maxLength={100}
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={!name.trim() || isCreating}
              >
                {isCreating ? t.creating : t.create}
              </Button>
            </form>
          </Panel>

          <Panel padding="lg" variant="muted">
            <CardHead
              icon={<KeyIcon size={17} />}
              tone="ink"
              title={t.join_room}
              sub={t.join_room_sub}
            />
            <form onSubmit={handleJoin} className="mt-[18px] flex flex-col gap-[14px]">
              <IconField
                icon={<KeyIcon size={17} />}
                label={t.room_code}
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 8)
                  )
                }
                placeholder="AB12CD34"
                maxLength={8}
                className="font-mono tracking-[0.2em]"
              />
              <Button
                type="submit"
                variant="secondary"
                size="lg"
                fullWidth
                disabled={code.trim().length !== 8 || isJoining}
              >
                {isJoining ? t.joining : t.join}
              </Button>
            </form>
          </Panel>
        </div>

        {/* Right column — your rooms */}
        <div className="flex w-full min-w-0 flex-[999] flex-col md:w-auto">
          <Panel padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-[18px] py-4">
              <h3 className="m-0 text-[15px] font-semibold text-ink">{t.your_rooms}</h3>
              <span className="rounded-full bg-surface-3 px-[9px] py-[3px] text-[12.5px] font-semibold tabular-nums text-ink-3">
                {rooms.length}
              </span>
            </div>
            {rooms.length === 0 ? (
              <div className="px-6 py-[52px] text-center">
                <span className="mb-3 inline-flex text-ink-4">
                  <FilmIcon size={28} />
                </span>
                <p className="m-0 text-base font-semibold text-ink">{t.no_rooms}</p>
                <p className="mt-1 text-sm text-ink-3">{t.no_rooms_sub}</p>
              </div>
            ) : (
              <div>
                {sortedRooms.map((room, index) => (
                  <RoomRow
                    key={room.id}
                    room={room}
                    isHost={room.host_id === user?.id}
                    last={index === sortedRooms.length - 1}
                    onOpen={(r) => navigate(`/room/${r.id}`)}
                    onDelete={handleDelete}
                    onCopy={handleCopy}
                    onCopyError={handleCopyError}
                  />
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
