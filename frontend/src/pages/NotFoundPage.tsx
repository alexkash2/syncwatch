import { useNavigate } from 'react-router';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { useI18n } from '../hooks/useI18n';

export function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-68px)] items-center justify-center px-7 py-10">
        <div className="sw-fade-up max-w-[420px] text-center">
          <div className="mb-2 text-[64px] font-bold -tracking-[0.04em] text-ink-4">404</div>
          <h1 className="m-0 text-2xl font-semibold -tracking-[0.02em] text-ink">{t.nf_title}</h1>
          <p className="mb-[26px] mt-[10px] text-[15px] leading-[1.55] text-ink-3">{t.nf_sub}</p>
          <Button variant="primary" size="lg" onClick={() => navigate('/')}>
            {t.nf_home}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
