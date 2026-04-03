import { Layout } from '../components/layout/Layout';

export function HomePage() {
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
        <div className="bg-surface-container p-10">
          <h2 className="font-bold text-2xl tracking-tight mb-6 flex items-center gap-3">
            Create Room
          </h2>
          <div className="space-y-6">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">
                Room Name
              </label>
              <input
                type="text"
                className="w-full bg-surface-container-lowest border-b border-outline-variant/20 focus:border-primary-container focus:outline-none text-on-surface py-3 transition-colors"
                placeholder="e.g. Movie Night"
              />
            </div>
            <button className="w-full bg-gradient-to-br from-primary-container to-[#0053da] text-on-primary-container font-bold uppercase tracking-widest py-4 text-xs hover:shadow-[0_0_15px_rgba(0,98,255,0.4)] transition-all active:scale-[0.98] cursor-pointer">
              Create Room
            </button>
          </div>
        </div>

        <div className="bg-surface-container-low p-10">
          <h2 className="font-bold text-2xl tracking-tight mb-6 flex items-center gap-3">
            Join Room
          </h2>
          <div className="space-y-6">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">
                Room Code
              </label>
              <input
                type="text"
                className="w-full bg-surface-container-lowest border-b border-outline-variant/20 focus:border-primary-container focus:outline-none text-on-surface py-3 transition-colors"
                placeholder="Enter room code"
              />
            </div>
            <button className="w-full bg-transparent border border-outline-variant/20 text-on-surface font-bold uppercase tracking-widest py-4 text-xs hover:bg-surface-container-high/20 hover:border-primary-container/50 transition-all active:scale-[0.98] cursor-pointer">
              Join Room
            </button>
          </div>
        </div>
      </div>

      <section>
        <h2 className="font-bold text-3xl tracking-tighter mb-2">My Rooms</h2>
        <p className="text-on-surface-variant text-sm mb-8">Your active and recent rooms.</p>
        <div className="bg-surface-container-lowest text-center py-12 text-on-surface-variant">
          No rooms yet. Create one or join with a code.
        </div>
      </section>
    </Layout>
  );
}
