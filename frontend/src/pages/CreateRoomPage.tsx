import { Dashboard } from '../components/home/Dashboard';
import { Layout } from '../components/layout/Layout';

/** `/create` — the authenticated dashboard (same workspace as the signed-in home). */
export function CreateRoomPage() {
  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
}
