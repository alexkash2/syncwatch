import { Dashboard } from '../components/home/Dashboard';
import { GuestHome } from '../components/home/GuestHome';
import { Layout } from '../components/layout/Layout';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';

/** Adaptive home: guest landing when signed out, dashboard when signed in. */
export function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Layout>
      {isLoading ? (
        <div className="flex min-h-[calc(100vh-68px)] items-center justify-center">
          <Spinner size={36} tone="ink" />
        </div>
      ) : isAuthenticated ? (
        <Dashboard />
      ) : (
        <GuestHome />
      )}
    </Layout>
  );
}
