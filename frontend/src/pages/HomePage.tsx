import {
  useCallback,
  useEffect,
  useMemo,
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
  ChatBubbleIcon,
  RefreshIcon,
  UsersIcon,
  VideoIcon,
} from '../components/ui/icons';
import { Panel } from '../components/ui/Panel';
import { useAuth } from '../hooks/useAuth';
import type { Room } from '../types/room';

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState<string | null>(
    (location.state as { flash?: string } | null)?.flash ?? null
  );
  const [roomsError, setRoomsError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  useEffect(() => {
    if (location.state && (location.state as { flash?: string }).flash) {
      navigate(location.pathname + location.search, {
        replace: true,
        state: null,
      });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (!flash) {
      return;
    }

    const timeoutId = window.setTimeout(() => setFlash(null), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [flash]);

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
      if (!window.confirm('Delete this room? All participants will be disconnected.')) {
        return;
      }

      setError('');

      try {
        await deleteRoom(roomId);
        setFlash('Room deleted.');
        await fetchRooms();
      } catch (err: unknown) {
        setError(
          (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
            'Failed to delete room'
        );
      }
    },
    [fetchRooms]
  );

  return (
    <Layout>
      <section className="relative overflow-hidden rounded-[2.4rem] border border-outline-variant/18 bg-surface-container-low/78 px-6 py-8 shadow-[0_32px_90px_rgba(0,0,0,0.3)] md:px-10 md:py-12 xl:px-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,98,255,0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_40%)]" />
          <div className="absolute -right-12 top-10 h-44 w-44 rounded-full border border-primary-container/12 bg-primary-container/12 blur-3xl" />
          <div className="absolute left-0 top-0 h-full w-px bg-white/8" />
        </div>

        <div className="relative z-10 grid gap-10 xl:grid-cols-[1.4fr_0.9fr] xl:items-end">
          <div>
            <Badge tone="primary" className="mb-3">
              Session Control Center
            </Badge>
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-on-surface md:text-5xl xl:text-[3.6rem]">
              {user?.username
                ? `${user.username}, keep every watch session on the same beat.`
                : 'Keep every watch session on the same beat.'}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-on-surface-variant md:text-base">
              Create a room when you want to host a synced viewing session, or jump into an existing room with a code from the group.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
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
          </div>
        </div>
      </section>

      {(flash || error || roomsError) && (
        <div className="mt-8 space-y-3">
          {flash && (
            <Panel
              variant="outline"
              padding="sm"
              className="rounded-[1.6rem] border-primary-container/35 bg-primary-container/16"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-primary">{flash}</p>
                <button
                  onClick={() => setFlash(null)}
                  className="text-xs uppercase tracking-[0.18em] text-on-surface-variant transition hover:text-on-surface"
                >
                  Dismiss
                </button>
              </div>
            </Panel>
          )}

          {error && (
            <Panel
              variant="outline"
              padding="sm"
              className="rounded-[1.6rem] border-error/30 bg-error-container/30 text-error"
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
        <ActionCard
          eyebrow="Host A Session"
          title="Create a room"
          description="Choose a room name, become the host and prepare the file reference everyone will match."
          accent="solid"
        >
          <form onSubmit={handleCreate} className="space-y-5">
            <Field label="Room Name">
              <Input
                type="text"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="Movie Night"
                required
              />
            </Field>

            <Button type="submit" variant="primary" size="lg" fullWidth disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Room'}
            </Button>
          </form>
        </ActionCard>

        <ActionCard
          eyebrow="Join Existing"
          title="Enter a room code"
          description="Paste the 8-character room code from the host and open the synchronized session immediately."
          accent="outline"
        >
          <form onSubmit={handleJoin} className="space-y-5">
            <Field label="Room Code">
              <Input
                type="text"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                className="uppercase tracking-[0.22em]"
                placeholder="AB12CD34"
                maxLength={8}
                required
              />
            </Field>

            <Button type="submit" variant="secondary" size="lg" fullWidth disabled={isJoining}>
              {isJoining ? 'Joining...' : 'Join Room'}
            </Button>
          </form>
        </ActionCard>
      </section>

      <section className="mt-12">
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
                className="h-52 animate-pulse rounded-[1.9rem] border border-outline-variant/15 bg-surface-container-low"
              />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <Panel variant="dashed" padding="lg" className="rounded-[1.9rem] text-center">
            <h3 className="text-2xl font-black tracking-tight text-on-surface">No rooms yet</h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-on-surface-variant">
              Start a hosted session or enter a shared code to see your recent room activity here.
            </p>
          </Panel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room) => {
              const isHost = room.host_id === user?.id;

              return (
                <div
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
                        <h3 className="mt-2 text-2xl font-black tracking-tight text-on-surface">
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

                      <div className="flex items-center justify-between px-1">
                        <span>Created</span>
                        <span>{new Date(room.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                      <button
                        onClick={() => navigate(`/room/${room.id}`)}
                        className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-primary transition group-hover:text-white"
                      >
                        Open room
                        <ArrowUpRightIcon size={14} />
                      </button>

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
              );
            })}
          </div>
        )}
      </section>
    </Layout>
  );
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
