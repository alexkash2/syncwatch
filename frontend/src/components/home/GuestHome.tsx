import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { Button } from '../ui/Button';
import { BoltIcon, KeyIcon, PlusIcon } from '../ui/icons';

/** Guest landing — brand promise + Create / Join CTAs that open the auth modal. */
export function GuestHome() {
  const { openAuthModal } = useAuth();
  const { t } = useI18n();

  return (
    <div className="flex min-h-[calc(100vh-68px)] items-center justify-center px-5 py-8 md:px-7 md:py-10">
      <div className="sw-fade-up max-w-[620px] text-center">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full bg-accent-tint px-[14px] py-[6px] text-[12.5px] font-semibold text-accent-strong">
          <BoltIcon size={14} />
          {t.guest_eyebrow}
        </div>

        <h1 className="m-0 text-[clamp(34px,5vw,52px)] font-bold leading-[1.05] -tracking-[0.035em] text-ink">
          {t.tagline}
        </h1>

        <p className="mx-auto mb-[34px] mt-5 max-w-[500px] text-[17px] leading-[1.6] text-ink-2">
          {t.guest_sub}
        </p>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            leadingIcon={<PlusIcon size={18} />}
            onClick={() => openAuthModal(undefined, 'register')}
            className="sm:w-auto"
          >
            {t.create_room}
          </Button>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            leadingIcon={<KeyIcon size={17} />}
            onClick={() => openAuthModal(undefined, 'login')}
            className="sm:w-auto"
          >
            {t.join_with_code}
          </Button>
        </div>
      </div>
    </div>
  );
}
