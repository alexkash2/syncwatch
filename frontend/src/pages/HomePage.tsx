import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { createRoom, joinRoom, listRooms } from '../api/rooms';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/layout/Layout';
import type { Room } from '../types/room';

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const data = await listRooms();
      setRooms(data.rooms);
    } catch {
      // ignore
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
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create room');
    } finally {
      setLoading(false);
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
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <section className="mb-16">
        <h1 className="font-black text-5xl tracking-tighter text-on-surface mb-2">
          Dashboard
        </h1>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">
          Create or join a room to start watching
        </p>
      </section>

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

        {rooms.length === 0 ? (
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
