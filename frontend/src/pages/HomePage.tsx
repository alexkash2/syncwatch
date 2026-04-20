import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { createRoom, deleteRoom, joinRoom, listRooms } from '../api/rooms';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/layout/Layout';
import type { Room } from '../types/room';

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<string | null>(
    (location.state as { flash?: string } | null)?.flash ?? null
  );

  // Clear the flash out of router state so it doesn't replay on refresh/back.
  useEffect(() => {
    if (location.state && (location.state as { flash?: string }).flash) {
      window.history.replaceState({}, '');
    }
    if (flash) {
      const t = setTimeout(() => setFlash(null), 6000);
      return () => clearTimeout(t);
    }
  }, [flash, location.state]);

  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsLoadError, setRoomsLoadError] = useState(false);

  const fetchRooms = useCallback(async () => {
    setRoomsLoadError(false);
    try {
      const data = await listRooms();
      setRooms(data.rooms);
    } catch {
      // Surface the failure — otherwise an empty list below is
      // indistinguishable from "backend down / network error".
      setRoomsLoadError(true);
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setError('');
    setLoading(true);
    try {
      const room = await createRoom(roomName.trim());
      navigate(`/room/${room.id}`);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (roomId: string) => {
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
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    setError('');
    setLoading(true);
    try {
      const room = await joinRoom(roomCode.trim());
      navigate(`/room/${room.id}`);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <section className="mb-16">
        <h1 className="font-black text-3xl md:text-5xl tracking-tighter text-on-surface mb-2">
          Dashboard
        </h1>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">
          Create or join a room to start watching
        </p>
      </section>

      {flash && (
        <div className="mb-4 p-4 bg-primary-container/20 border border-primary-container/40 text-primary text-sm flex justify-between items-start">
          <span>{flash}</span>
          <button
            onClick={() => setFlash(null)}
            className="ml-4 text-on-surface-variant hover:text-on-surface cursor-pointer"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="mb-8 p-4 bg-error-container/20 border border-error/30 text-error text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
        <form onSubmit={handleCreate} className="bg-surface-container p-10">
          <h2 className="font-bold text-2xl tracking-tight mb-6">Create Room</h2>
          <div className="space-y-6">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">
                Room Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full bg-surface-container-lowest border-b border-outline-variant/20 focus:border-primary-container focus:outline-none text-on-surface py-3 transition-colors"
                placeholder="e.g. Movie Night"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-br from-primary-container to-[#0053da] text-on-primary-container font-bold uppercase tracking-widest py-4 text-xs hover:shadow-[0_0_15px_rgba(0,98,255,0.4)] transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              Create Room
            </button>
          </div>
        </form>

        <form onSubmit={handleJoin} className="bg-surface-container-low p-10">
          <h2 className="font-bold text-2xl tracking-tight mb-6">Join Room</h2>
          <div className="space-y-6">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">
                Room Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full bg-surface-container-lowest border-b border-outline-variant/20 focus:border-primary-container focus:outline-none text-on-surface py-3 transition-colors uppercase"
                placeholder="Enter room code"
                maxLength={8}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-transparent border border-outline-variant/20 text-on-surface font-bold uppercase tracking-widest py-4 text-xs hover:bg-surface-container-high/20 hover:border-primary-container/50 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              Join Room
            </button>
          </div>
        </form>
      </div>

      <section>
        <h2 className="font-bold text-3xl tracking-tighter mb-2">My Rooms</h2>
        <p className="text-on-surface-variant text-sm mb-8">Your active and recent rooms.</p>

        {roomsLoading ? (
          <div className="bg-surface-container-lowest text-center py-12 text-on-surface-variant">
            Loading your rooms…
          </div>
        ) : roomsLoadError ? (
          <div className="bg-error-container/20 border border-error/30 text-error px-6 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="font-bold text-sm mb-1">Couldn't load your rooms.</div>
              <div className="text-xs text-on-surface-variant">
                The server didn't respond. This doesn't mean you have no rooms.
              </div>
            </div>
            <button
              onClick={fetchRooms}
              className="shrink-0 text-[10px] uppercase tracking-widest px-4 py-2 border border-error/50 hover:bg-error/10 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-surface-container-lowest text-center py-12 text-on-surface-variant">
            No rooms yet. Create one or join with a code.
          </div>
        ) : (
          <div className="bg-surface-container-lowest overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/10">
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest text-on-surface-variant">Room Name</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest text-on-surface-variant">Room Code</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest text-on-surface-variant">Role</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest text-on-surface-variant text-right">Created</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-widest text-on-surface-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {rooms.map((room) => (
                  <tr
                    key={room.id}
                    onClick={() => navigate(`/room/${room.id}`)}
                    className="hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-1.5 h-1.5 rounded-full ${room.host_id === user?.id ? 'bg-primary-container shadow-[0_0_8px_rgba(0,98,255,1)]' : 'bg-outline-variant'}`} />
                        <span className="font-semibold tracking-tight">{room.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs tracking-wider bg-surface-container px-3 py-1 text-on-surface-variant">
                        {room.room_code}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      {room.host_id === user?.id ? (
                        <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 border border-primary-container text-primary-container">
                          Host
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 border border-outline-variant/30 text-on-surface-variant">
                          Viewer
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right text-xs text-on-surface-variant">
                      {new Date(room.created_at).toLocaleDateString()}
                    </td>
                    <td
                      className="px-8 py-6 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {room.host_id === user?.id && (
                        <button
                          onClick={() => handleDelete(room.id)}
                          className="text-[10px] uppercase tracking-widest text-error hover:text-on-surface cursor-pointer"
                          title="Delete room"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Layout>
  );
}
