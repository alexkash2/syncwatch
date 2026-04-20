import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router';
import { createRoom, deleteRoom, joinRoom, listRooms } from '../api/rooms';
import { Layout } from '../components/layout/Layout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import {
  ArrowUpRightIcon,
  BrandMarkIcon,
  ChatBubbleIcon,
  CheckIcon,
  CopyIcon,
  RefreshIcon,
  UsersIcon,
  VideoIcon,
  WarningCircleIcon,
} from '../components/ui/icons';
import { Panel } from '../components/ui/Panel';
import { StatePanel } from '../components/ui/StatePanel';
import { useUi } from '../hooks/useUi';
import { useAuth } from '../hooks/useAuth';
import type { HomeArrivalNotice, HomeLocationState } from '../types/navigation';
import type { Room } from '../types/room';

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { confirm, pushToast } = useUi();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [arrivalNotice, setArrivalNotice] = useState<HomeArrivalNotice | null>(null);
  const [roomsError, setRoomsError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const routeState = (location.state as HomeLocationState | null) ?? null;
    if (!routeState?.arrivalNotice && !routeState?.flash) {
      return;
    }

    if (routeState.arrivalNotice) {
      setArrivalNotice(routeState.arrivalNotice);
    } else if (routeState.flash) {
      pushToast({
        tone: 'primary',
        title: 'Room update',
        description: routeState.flash,
        durationMs: 4200,
      });
    }

    navigate(location.pathname + location.search, {
      replace: true,
      state: null,
    });
  }, [location.pathname, location.search, location.state, navigate, pushToast]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const fetchRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    setRoomsError('');

    try {
      const data = await listRooms();
      setRooms(data.rooms);
    } catch {
      setRoomsError('Failed to load your rooms right now.');
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    void fetchRooms();
  }, [fetchRooms]);

  const ownedRooms = useMemo(
    () => rooms.filter((room) => room.host_id === user?.id).length,
    [rooms, user?.id]
  );
  const sortedRooms = useMemo(
    () =>
      [...rooms].sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      ),
    [rooms]
  );
  const latestRoom = sortedRooms[0] ?? null;

  const joinedRooms = rooms.length - ownedRooms;

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!roomName.trim()) {
      return;
    }

    setError('');
    setIsCreating(true);

    try {
      const room = await createRoom(roomName.trim());
      navigate(`/room/${room.id}`);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
          'Failed to create room'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    if (!roomCode.trim()) {
      return;
    }

    setError('');
    setIsJoining(true);

    try {
      const room = await joinRoom(roomCode.trim().toUpperCase());
      navigate(`/room/${room.id}`);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
          'Failed to join room'
      );
    } finally {
      setIsJoining(false);
    }
  };

  const handleDelete = useCallback(
    async (roomId: string) => {
      const confirmed = await confirm({
        eyebrow: 'Delete Room',
        title: 'Close this synced room?',
        description:
          'Everyone inside will be disconnected and the room will disappear from recent activity.',
        confirmLabel: 'Delete room',
        cancelLabel: 'Keep room',
        tone: 'danger',
      });

      if (!confirmed) {
        return;
      }

      setError('');

      try {
        await deleteRoom(roomId);
        pushToast({
          tone: 'success',
          title: 'Room deleted',
          description: 'The room was closed and removed from your dashboard.',
        });
        await fetchRooms();
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
          'Failed to delete room';
        setError(message);
        pushToast({
          tone: 'danger',
          title: 'Could not delete room',
          description: message,
        });
      }
    },
    [confirm, fetchRooms, pushToast]
  );

  const handleCopyRoomCode = useCallback(async (roomId: string, roomCode: string) => {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }

    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedRoomId(roomId);
      pushToast({
        tone: 'success',
        title: 'Room code copied',
        description: `${roomCode} is ready to share with the group.`,
        durationMs: 2600,
      });
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedRoomId(null);
      }, 1800);
    } catch {
      const message = 'Could not copy the room code in this browser.';
      setError(message);
      pushToast({
        tone: 'warning',
        title: 'Copy unavailable',
        description: message,
      });
    }
  }, [pushToast]);

  const scrollToSection = useCallback((sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <Layout>
      {arrivalNotice && (
        <section className="mb-8">
          <HomeArrivalPanel
            notice={arrivalNotice}
            onDismiss={() => setArrivalNotice(null)}
            onCreateRoom={() => scrollToSection('create-room')}
            onJoinRoom={() => scrollToSection('join-room')}
            onReviewRooms={() => scrollToSection('recent-rooms')}
          />
        </section>
      )}

      <section className="relative overflow-hidden rounded-[2.4rem] border border-outline-variant/18 bg-surface-container-low/78 px-5 py-7 shadow-[0_32px_90px_rgba(0,0,0,0.3)] sm:px-6 md:px-10 md:py-12 xl:px-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,98,255,0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_40%)]" />
          <div className="absolute -right-12 top-10 h-44 w-44 rounded-full border border-primary-container/12 bg-primary-container/12 blur-3xl" />
          <div className="absolute left-0 top-0 h-full w-px bg-white/8" />
        </div>

        <div className="relative z-10 grid gap-8 xl:grid-cols-[1.4fr_0.9fr] xl:items-end">
          <div>
            <Badge tone="primary" className="mb-3">
              Session Control Center
            </Badge>
            <h1 className="max-w-4xl text-3xl font-black tracking-tight text-on-surface sm:text-4xl md:text-5xl xl:text-[3.6rem]">
              {user?.username
                ? `${user.username}, keep every watch session on the same beat.`
                : 'Keep every watch session on the same beat.'}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-on-surface-variant md:text-base">
              Create a room when you want to host a synced viewing session, or jump into an existing room with a code from the group.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <HeroPill label="Host-led timeline" />
              <HeroPill label="Private local media" />
              <HeroPill label="Fast room re-entry" />
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                variant="primary"
                size="lg"
                onClick={() => scrollToSection('create-room')}
                className="w-full sm:w-auto"
              >
                Create a room
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => scrollToSection('join-room')}
                className="w-full sm:w-auto"
              >
                Join with code
              </Button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <HeroMetric label="Rooms Total" value={String(rooms.length)} />
              <HeroMetric label="Hosted By You" value={String(ownedRooms)} />
              <HeroMetric label="Joined As Viewer" value={String(joinedRooms)} />
            </div>
          </div>

          <div className="grid gap-4">
            <QuickNote
              title="How rooms feel"
              text="Each room keeps the file reference, group readiness and playback state visible so nobody has to guess what happens next."
            />
            <QuickNote
              title="What stays local"
              text="The app never uploads the actual video file. SyncWatch only verifies local files and synchronizes the shared timeline."
            />
            {latestRoom && (
              <QuickNote
                title="Latest room"
                text={`${latestRoom.name} is ready to reopen with code ${latestRoom.room_code}.`}
              />
            )}
          </div>
        </div>
      </section>

      {(error || roomsError) && (
        <div className="mt-8 space-y-3">
          {error && (
            <Panel
              variant="outline"
              padding="sm"
              className="rounded-[1.6rem] border-error/30 bg-error-container/30 text-error"
              aria-live="polite"
            >
              <p className="text-sm">{error}</p>
            </Panel>
          )}

          {roomsError && (
            <Panel variant="outline" padding="sm" className="rounded-[1.6rem]">
              <p className="text-sm text-on-surface-variant">{roomsError}</p>
            </Panel>
          )}
        </div>
      )}

      <section className="mt-10 grid gap-4 xl:grid-cols-3">
        <WorkflowCard
          icon={<UsersIcon size={18} />}
          step="01"
          title="Create or join"
          text="Open a fresh room as host or enter an existing code from the group."
        />
        <WorkflowCard
          icon={<VideoIcon size={18} />}
          step="02"
          title="Match the file"
          text="Everyone selects the same local video so the room can verify playback compatibility."
        />
        <WorkflowCard
          icon={<ChatBubbleIcon size={18} />}
          step="03"
          title="Watch in sync"
          text="Play, pause and seek from a single shared host timeline with live chat on the side."
        />
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-2">
        <div id="create-room">
          <ActionCard
            eyebrow="Host A Session"
            title="Create a room"
            description="Choose a room name, become the host and prepare the file reference everyone will match."
            accent="solid"
          >
            <form onSubmit={handleCreate} className="space-y-5">
              <Field label="Room Name" hint="You will land inside the room immediately as host.">
                <Input
                  type="text"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder="Movie Night"
                  autoComplete="off"
                  required
                />
              </Field>

              <Button type="submit" variant="primary" size="lg" fullWidth disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Room'}
              </Button>
            </form>
          </ActionCard>
        </div>

        <div id="join-room">
          <ActionCard
            eyebrow="Join Existing"
            title="Enter a room code"
            description="Paste the 8-character room code from the host and open the synchronized session immediately."
            accent="outline"
          >
            <form onSubmit={handleJoin} className="space-y-5">
              <Field
                label="Room Code"
                hint="Codes are uppercase and work best when pasted exactly as shared."
              >
                <Input
                  type="text"
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                  className="uppercase tracking-[0.22em]"
                  placeholder="AB12CD34"
                  autoComplete="off"
                  maxLength={8}
                  required
                />
              </Field>

              <Button type="submit" variant="secondary" size="lg" fullWidth disabled={isJoining}>
                {isJoining ? 'Joining...' : 'Join Room'}
              </Button>
            </form>
          </ActionCard>
        </div>
      </section>

      <section id="recent-rooms" className="mt-12">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge tone="primary">Your Rooms</Badge>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-on-surface">
              Recent activity
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void fetchRooms()}
            leadingIcon={<RefreshIcon size={15} />}
          >
            Refresh
          </Button>
        </div>

        {isLoadingRooms ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="surface-skeleton h-56 rounded-[1.9rem] border border-outline-variant/15 bg-surface-container-low"
              />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <Panel variant="dashed" padding="lg" className="rounded-[1.9rem] text-center">
            <h3 className="text-2xl font-black tracking-tight text-on-surface">No rooms yet</h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-on-surface-variant">
              Start a hosted session or enter a shared code to see your recent room activity here.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button variant="primary" size="sm" onClick={() => scrollToSection('create-room')}>
                Create a room
              </Button>
              <Button variant="ghost" size="sm" onClick={() => scrollToSection('join-room')}>
                Join with code
              </Button>
            </div>
          </Panel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedRooms.map((room) => {
              const isHost = room.host_id === user?.id;

              return (
                <article
                  key={room.id}
                  className="group relative overflow-hidden rounded-[1.9rem] border border-outline-variant/15 bg-surface-container-low/78 p-5 text-left shadow-[0_18px_44px_rgba(0,0,0,0.24)] transition hover:-translate-y-1 hover:border-primary-container/30 hover:bg-surface-container"
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,98,255,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_40%,rgba(255,255,255,0.04)_100%)] opacity-70" />
                  <div className="relative z-10">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">
                          Room
                        </p>
                        <h3 className="mt-2 break-words text-2xl font-black tracking-tight text-on-surface">
                          {room.name}
                        </h3>
                      </div>

                      <Badge tone={isHost ? 'primary' : 'neutral'}>
                        {isHost ? 'Host' : 'Viewer'}
                      </Badge>
                    </div>

                    <div className="grid gap-3 text-sm text-on-surface-variant">
                      <Panel variant="muted" padding="sm" className="rounded-[1.2rem]">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                          Room Code
                        </p>
                        <p className="mt-2 font-mono text-xs tracking-[0.24em] text-primary">
                          {room.room_code}
                        </p>
                      </Panel>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Panel variant="muted" padding="sm" className="rounded-[1.2rem]">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                            Access
                          </p>
                          <p className="mt-2 text-xs leading-6 text-on-surface-variant">
                            {isHost ? 'You control playback for the whole room.' : 'The host keeps the shared timeline in sync.'}
                          </p>
                        </Panel>

                        <Panel variant="muted" padding="sm" className="rounded-[1.2rem]">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                            Created
                          </p>
                          <p className="mt-2 text-xs leading-6 text-on-surface">
                            {new Date(room.created_at).toLocaleDateString()}
                          </p>
                        </Panel>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/room/${room.id}`)}
                        leadingIcon={<ArrowUpRightIcon size={14} />}
                        className="w-full sm:w-auto"
                      >
                        Open room
                      </Button>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleCopyRoomCode(room.id, room.room_code)}
                          leadingIcon={
                            copiedRoomId === room.id ? (
                              <CheckIcon size={14} />
                            ) : (
                              <CopyIcon size={14} />
                            )
                          }
                        >
                          {copiedRoomId === room.id ? 'Copied' : 'Copy code'}
                        </Button>

                        {isHost && (
                          <button
                            onClick={() => void handleDelete(room.id)}
                            className="text-[11px] font-bold uppercase tracking-[0.22em] text-error transition hover:text-on-surface"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </Layout>
  );
}

function HeroPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-outline-variant/15 bg-black/18 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
      {label}
    </span>
  );
}

function HomeArrivalPanel({
  notice,
  onDismiss,
  onCreateRoom,
  onJoinRoom,
  onReviewRooms,
}: {
  notice: HomeArrivalNotice;
  onDismiss: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onReviewRooms: () => void;
}) {
  const meta = getArrivalMeta(notice);
  const primaryAction =
    notice.key === 'access_lost' || notice.key === 'room_not_found'
      ? {
          label: 'Join with code',
          onClick: onJoinRoom,
          variant: 'secondary' as const,
        }
      : notice.key === 'tab_replaced'
      ? {
          label: 'Review recent rooms',
          onClick: onReviewRooms,
          variant: 'primary' as const,
        }
      : {
          label: 'Create a room',
          onClick: onCreateRoom,
          variant: 'primary' as const,
        };

  return (
    <StatePanel
      eyebrow={notice.eyebrow}
      title={notice.title}
      description={notice.description}
      tone={notice.tone}
      align="left"
      icon={meta.icon}
      className={`relative overflow-hidden rounded-[2.1rem] border px-1 ${meta.panelClass}`}
      actions={
        <>
          <Button variant={primaryAction.variant} size="sm" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
          {notice.key !== 'tab_replaced' && (
            <Button variant="ghost" size="sm" onClick={onReviewRooms}>
              Review recent rooms
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </>
      }
    />
  );
}

function getArrivalMeta(notice: HomeArrivalNotice): {
  icon: ReactNode;
  panelClass: string;
} {
  if (notice.key === 'tab_replaced') {
    return {
      icon: <RefreshIcon size={22} className="animate-spin [animation-duration:3s]" />,
      panelClass:
        'border-primary-container/26 bg-[radial-gradient(circle_at_top_left,rgba(0,98,255,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]',
    };
  }

  if (notice.tone === 'danger') {
    return {
      icon: <WarningCircleIcon size={22} />,
      panelClass:
        'border-error/24 bg-[radial-gradient(circle_at_top_left,rgba(255,120,100,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]',
    };
  }

  if (notice.tone === 'warning') {
    return {
      icon: <WarningCircleIcon size={22} />,
      panelClass:
        'border-amber-300/22 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]',
    };
  }

  return {
    icon: <BrandMarkIcon size={22} />,
    panelClass:
      'border-primary-container/26 bg-[radial-gradient(circle_at_top_left,rgba(0,98,255,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]',
  };
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <Panel variant="muted" padding="sm" className="rounded-[1.5rem]">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-tight text-on-surface">{value}</p>
    </Panel>
  );
}

function QuickNote({ title, text }: { title: string; text: string }) {
  return (
    <Panel variant="muted" padding="md">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">{title}</p>
      <p className="mt-3 text-sm leading-7 text-on-surface-variant">{text}</p>
    </Panel>
  );
}

function WorkflowCard({
  icon,
  step,
  title,
  text,
}: {
  icon: ReactNode;
  step: string;
  title: string;
  text: string;
}) {
  return (
    <Panel variant="default" padding="md">
      <div className="flex items-center justify-between gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary-container/18 bg-primary-container/10 text-primary">
          {icon}
        </span>
        <Badge tone="neutral">{step}</Badge>
      </div>
      <h3 className="mt-4 text-xl font-black tracking-tight text-on-surface">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-on-surface-variant">{text}</p>
    </Panel>
  );
}

function ActionCard({
  eyebrow,
  title,
  description,
  accent,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  accent: 'solid' | 'outline';
  children: ReactNode;
}) {
  return (
    <Panel
      variant={accent === 'solid' ? 'default' : 'outline'}
      padding="lg"
      className="rounded-[2rem]"
    >
      <Badge tone="primary">{eyebrow}</Badge>
      <h3 className="mt-4 text-3xl font-black tracking-tight text-on-surface">{title}</h3>
      <p className="mt-3 max-w-xl text-sm leading-7 text-on-surface-variant">{description}</p>
      <div className="mt-6">{children}</div>
    </Panel>
  );
}
