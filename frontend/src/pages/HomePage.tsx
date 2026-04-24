import { useNavigate } from 'react-router';
import type { ReactNode } from 'react';
import { BrandIllustration } from '../components/brand/BrandIllustration';
import { Layout } from '../components/layout/Layout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  ChatBubbleIcon,
  UsersIcon,
  VideoIcon,
} from '../components/ui/icons';
import { Panel } from '../components/ui/Panel';
import { useAuth } from '../hooks/useAuth';
import type { HomeFocusSection, HomeLocationState } from '../types/navigation';

export function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal } = useAuth();

  const goToDashboard = (focusSection?: HomeFocusSection, authPrompt?: string) => {
    if (isAuthenticated) {
      const state: HomeLocationState | undefined = focusSection ? { focusSection } : undefined;
      navigate('/create', state ? { state } : undefined);
      return;
    }

    openAuthModal(authPrompt ?? 'Sign in to create or join a room.');
  };

  const handleCreate = () => goToDashboard('create-room', 'Sign in to create a room.');
  const handleJoin = () => goToDashboard('join-room', 'Sign in to join a room with a code.');

  return (
    <Layout>
      <section className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div className="ui-fade-up">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-on-surface-variant">
              Shared Local Playback
            </p>
            <p className="mt-2 max-w-2xl text-sm text-on-surface md:text-base">
              Rooms, file verification and synchronized watch sessions in one place.
            </p>

            <h1 className="mt-7 max-w-4xl text-4xl font-black tracking-tight text-on-surface sm:text-5xl md:text-6xl">
              Keep every watch session on the same beat.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-on-surface-variant">
              Create a private room, match the same local video on every device and let
              SyncWatch keep the whole group on one shared timeline without uploading the
              movie anywhere.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                variant="primary"
                size="lg"
                onClick={handleCreate}
                className="w-full sm:w-auto"
              >
                Create a room
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={handleJoin}
                className="w-full sm:w-auto"
              >
                Join with code
              </Button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <FeatureStat
                title="Host-led control"
                text="One playback timeline keeps starts, pauses and seeks aligned."
              />
              <FeatureStat
                title="Local file match"
                text="Everyone verifies the same video while the file stays on-device."
              />
              <FeatureStat
                title="Room re-entry"
                text="Recent sessions stay easy to reopen from your room workspace."
              />
            </div>
          </div>

          <div className="ui-fade-up [animation-delay:80ms]">
            <BrandIllustration variant="sync" className="rounded-[2rem]" />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-6xl">
        <div className="mb-6 max-w-2xl">
          <h2 className="text-3xl font-black tracking-tight text-on-surface sm:text-4xl">
            How a room flows
          </h2>
          <p className="mt-3 text-base leading-8 text-on-surface-variant">
            The whole loop is short: open the room, make sure everyone points at the same
            file, then watch from one shared playback state.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <WorkflowCard
            icon={<UsersIcon size={18} />}
            step="01"
            title="Open the room"
            text="Start a fresh room as host or join an existing code from the group."
          />
          <WorkflowCard
            icon={<VideoIcon size={18} />}
            step="02"
            title="Match local media"
            text="Each person selects the same local video so SyncWatch can verify compatibility."
          />
          <WorkflowCard
            icon={<ChatBubbleIcon size={18} />}
            step="03"
            title="Stay in sync"
            text="Play, pause, seek and chat around one shared room timeline."
          />
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-6xl">
        <div className="grid gap-5 lg:grid-cols-[1.02fr_0.98fr]">
          <Panel variant="outline" padding="lg" className="rounded-[2rem]">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              Why it reads clearly
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-black tracking-tight text-on-surface sm:text-4xl">
              The room keeps the important bits visible.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-on-surface-variant">
              SyncWatch is built around a few signals that stay easy to scan: who hosts the
              room, whether everyone matched the same file and what the shared playback state
              is right now.
            </p>

            <div className="mt-8 grid gap-3">
              <FeatureRow
                icon={<UsersIcon size={16} />}
                title="Private rooms with clear roles"
                text="Hosts and viewers stay legible, so the room does not feel ambiguous."
              />
              <FeatureRow
                icon={<VideoIcon size={16} />}
                title="No video uploads"
                text="The app verifies local files and sync timing instead of moving the movie itself."
              />
              <FeatureRow
                icon={<ChatBubbleIcon size={16} />}
                title="Chat beside playback"
                text="Conversation stays attached to the session instead of splitting the flow."
              />
            </div>
          </Panel>

          <Panel variant="default" padding="lg" className="rounded-[2rem]">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              What opens next
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-on-surface sm:text-4xl">
              From the home page to a live room in one move.
            </h2>
            <p className="mt-4 text-base leading-8 text-on-surface-variant">
              After login, your room workspace gives you the practical controls right away:
              create a room, paste a code to join, reopen recent sessions and fine-tune the
              local room behavior for this device.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <FeatureTile
                icon={<UsersIcon size={16} />}
                title="Create or join fast"
                text="You land straight in the actions instead of crossing a marketing screen."
              />
              <FeatureTile
                icon={<VideoIcon size={16} />}
                title="Keep files local"
                text="Everyone chooses the same video locally, with no upload step in the way."
              />
              <FeatureTile
                icon={<ChatBubbleIcon size={16} />}
                title="Return to recent rooms"
                text="Your latest sessions stay close when you need to reopen the flow."
              />
              <FeatureTile
                icon={<UsersIcon size={16} />}
                title="Adjust room behavior"
                text="Compact sidebar and viewer-exit confirmation stay per-device and easy to reach."
              />
            </div>
          </Panel>
        </div>
      </section>
    </Layout>
  );
}

function FeatureStat({ title, text }: { title: string; text: string }) {
  return (
    <Panel variant="muted" padding="md" className="rounded-[1.5rem]">
      <p className="text-sm font-semibold text-on-surface">{title}</p>
      <p className="mt-2 text-xs leading-6 text-on-surface-variant">{text}</p>
    </Panel>
  );
}

function FeatureRow({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-[1.5rem] border border-outline-variant/12 bg-surface-container-lowest/58 px-4 py-4">
      <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary-container/18 bg-primary-container/10 text-primary">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-on-surface">{title}</p>
        <p className="mt-2 text-sm leading-7 text-on-surface-variant">{text}</p>
      </div>
    </div>
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

function FeatureTile({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Panel variant="muted" padding="md" className="rounded-[1.6rem]">
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-container/18 bg-primary-container/10 text-primary">
        {icon}
      </span>
      <p className="mt-4 text-sm font-semibold text-on-surface">{title}</p>
      <p className="mt-2 text-sm leading-7 text-on-surface-variant">{text}</p>
    </Panel>
  );
}
