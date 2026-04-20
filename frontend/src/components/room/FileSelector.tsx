import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { computeFileHash, getVideoDurationMs } from '../../utils/fileHash';
import type { FileVerifyResult, RoomStatus } from '../../types/ws';
import { usePreferences } from '../../hooks/usePreferences';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { VideoIcon } from '../ui/icons';
import { Panel } from '../ui/Panel';
import { RoomOnboarding } from './RoomOnboarding';

export type FileStatus =
  | 'idle'
  | 'hashing'
  | 'verifying'
  | 'verified'
  | 'mismatch'
  | 'error'
  | 'not_video';

interface FileSelectorProps {
  onFileVerified: (fileUrl: string) => void;
  onVerifyRequest: (hash: string, size: number, durationMs: number, fileName: string) => void;
  verifyResult: FileVerifyResult | null;
  isHost: boolean;
  roomStatus: RoomStatus;
  referenceFileName: string | null;
  readyParticipants: number;
  totalParticipants: number;
}

export function FileSelector({
  onFileVerified,
  onVerifyRequest,
  verifyResult,
  isHost,
  roomStatus,
  referenceFileName,
  readyParticipants,
  totalParticipants,
}: FileSelectorProps) {
  const { preferences } = usePreferences();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<FileStatus>('idle');
  const [fileName, setFileName] = useState('');
  const requestNonce = useRef(0);
  const pendingFile = useRef<{
    url: string;
    hash: string;
    size: number;
    durationMs: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (pendingFile.current) {
        URL.revokeObjectURL(pendingFile.current.url);
      }
    };
  }, []);

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    requestNonce.current += 1;
    const currentNonce = requestNonce.current;

    if (pendingFile.current) {
      URL.revokeObjectURL(pendingFile.current.url);
      pendingFile.current = null;
    }

    setFileName(file.name);

    if (file.type && !file.type.startsWith('video/')) {
      setStatus('not_video');
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      return;
    }

    setStatus('hashing');

    try {
      const [hash, durationMs] = await Promise.all([
        computeFileHash(file),
        getVideoDurationMs(file),
      ]);

      if (currentNonce !== requestNonce.current) {
        return;
      }

      const fileUrl = URL.createObjectURL(file);
      pendingFile.current = { url: fileUrl, hash, size: file.size, durationMs };
      setStatus('verifying');
      onVerifyRequest(hash, file.size, durationMs, file.name);
    } catch {
      if (currentNonce === requestNonce.current) {
        setStatus('error');
      }
    }

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!verifyResult || status !== 'verifying') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (
        verifyResult.file_hash &&
        pendingFile.current &&
        verifyResult.file_hash !== pendingFile.current.hash
      ) {
        return;
      }

      if (verifyResult.match && pendingFile.current) {
        const { url } = pendingFile.current;
        setStatus('verified');
        pendingFile.current = null;
        onFileVerified(url);
        return;
      }

      if (!verifyResult.match) {
        const waitingForHost =
          !!verifyResult.reason &&
          verifyResult.reason.toLowerCase().includes('has not selected');

        setStatus(waitingForHost ? 'idle' : 'mismatch');

        if (pendingFile.current) {
          URL.revokeObjectURL(pendingFile.current.url);
          pendingFile.current = null;
        }
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [onFileVerified, status, verifyResult]);

  const isWaitingForHost = !isHost && !referenceFileName && roomStatus === 'waiting_file';
  const copy = getSelectorCopy({
    status,
    isHost,
    roomStatus,
    referenceFileName,
    verifyReason: verifyResult?.reason,
    currentFileName: fileName,
    isWaitingForHost,
  });

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8 md:px-8">
      <Panel variant="glass" padding="lg" className="w-full max-w-3xl rounded-[2rem]">
        <div className="mb-6 flex flex-wrap gap-2">
          <StageTag label={isHost ? 'Host file stage' : 'Viewer file stage'} />
          {referenceFileName && <StageTag label={truncateLabel(referenceFileName)} />}
          <StageTag label={roomStatus.replace('_', ' ')} />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div>
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-[1.5rem] border border-primary-container/20 bg-primary-container/10 text-primary shadow-[0_0_40px_rgba(0,98,255,0.15)]">
              <VideoIcon size={34} />
            </div>

            <h2 className="text-3xl font-black tracking-tight text-on-surface md:text-4xl">
              {copy.title}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-on-surface-variant md:text-base">
              {copy.description}
            </p>

            {copy.note && (
              <Panel variant="outline" padding="sm" className="mt-5 rounded-2xl">
                <p className="break-words text-sm text-on-surface-variant">{copy.note}</p>
              </Panel>
            )}

            {!isWaitingForHost && (
              <div className="mt-8">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => inputRef.current?.click()}
                  disabled={status === 'hashing' || status === 'verifying'}
                  leadingIcon={<VideoIcon size={16} />}
                  className="w-full sm:w-auto"
                >
                  {status === 'idle' ? 'Choose Local Video' : 'Choose Another File'}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Panel variant="outline" padding="md" className="rounded-[1.75rem]">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Stage Status
              </p>
              <div className="mt-4 space-y-4">
                <StatusRow
                  label="Current phase"
                  value={copy.phaseLabel}
                  accent={status === 'hashing' || status === 'verifying'}
                />
                <StatusRow label="Reference file" value={referenceFileName || 'Not chosen yet'} />
                <StatusRow label="Selected file" value={fileName || 'Nothing selected'} />
              </div>
            </Panel>

            {preferences.showRoomOnboarding && (
              <RoomOnboarding
                isHost={isHost}
                roomStatus={roomStatus}
                referenceFileName={referenceFileName}
                hasLocalFile={status === 'verified'}
                videoReady={false}
                readyParticipants={readyParticipants}
                totalParticipants={totalParticipants}
              />
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </Panel>
    </div>
  );
}

function getSelectorCopy({
  status,
  isHost,
  roomStatus,
  referenceFileName,
  verifyReason,
  currentFileName,
  isWaitingForHost,
}: {
  status: FileStatus;
  isHost: boolean;
  roomStatus: RoomStatus;
  referenceFileName: string | null;
  verifyReason?: string;
  currentFileName: string;
  isWaitingForHost: boolean;
}) {
  switch (status) {
    case 'hashing':
      return {
        title: 'Computing file signature',
        description:
          'The local file is being fingerprinted so the room can verify everyone is watching the same media.',
        note: currentFileName,
        phaseLabel: 'Hashing',
      };
    case 'verifying':
      return {
        title: 'Checking against the room reference',
        description:
          'The frontend is confirming the file signature, duration and size before the player becomes active.',
        note: currentFileName,
        phaseLabel: 'Verifying',
      };
    case 'mismatch':
      return {
        title: 'This file does not match the room',
        description:
          verifyReason || 'Pick the exact same local video as the host to join the synced playback.',
        note: referenceFileName ? `Expected reference: ${referenceFileName}` : undefined,
        phaseLabel: 'Mismatch',
      };
    case 'error':
      return {
        title: 'The browser could not read this file',
        description:
          'Try selecting the file again or switch to a more broadly supported video format.',
        note: currentFileName || undefined,
        phaseLabel: 'Read error',
      };
    case 'not_video':
      return {
        title: 'That file is not a video',
        description:
          currentFileName
            ? `"${currentFileName}" is not recognized as a video file.`
            : 'Choose a supported local video file to continue.',
        note: 'Try mp4, mkv, webm or another browser-supported format.',
        phaseLabel: 'Unsupported file',
      };
    case 'verified':
      return {
        title: 'File verified',
        description: 'The player is opening your local video now.',
        note: currentFileName,
        phaseLabel: 'Verified',
      };
    default:
      if (isWaitingForHost) {
        return {
          title: 'Waiting for the host file',
          description:
            'As soon as the host picks a reference file, you will be able to choose the same file on your device.',
          note: 'No shared reference file yet.',
          phaseLabel: 'Awaiting reference file',
        };
      }

      if (referenceFileName) {
        return {
          title: isHost ? 'Load or replace the reference file' : 'Match the host file locally',
          description: isHost
            ? 'You already have a room reference. Choose the same file again to load it locally, or pick another one to replace the shared reference.'
            : 'The host already picked a reference file. Select the same local video to join the synchronized playback.',
          note: `Reference file: ${referenceFileName}`,
          phaseLabel:
            roomStatus === 'waiting_ready' ? 'Waiting for readiness' : 'Ready to select',
        };
      }

      return {
        title: isHost ? 'Choose the first room file' : 'Waiting for the host file',
        description: isHost
          ? 'Start the room by selecting the local video everyone will match against.'
          : 'As soon as the host picks a reference file, you will be able to choose the same file on your device.',
        note: roomStatus === 'waiting_file' ? 'No shared reference file yet.' : undefined,
        phaseLabel: roomStatus === 'waiting_file' ? 'Awaiting reference file' : 'Idle',
      };
  }
}

function StageTag({ label }: { label: string }) {
  return (
    <Badge tone="neutral" className="max-w-full">
      <span className="truncate">{label}</span>
    </Badge>
  );
}

function StatusRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Panel variant="muted" padding="sm" className="rounded-2xl">
      <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
      <p
        className={`mt-2 break-words text-sm leading-6 ${
          accent ? 'text-primary' : 'text-on-surface'
        }`}
      >
        {value}
      </p>
    </Panel>
  );
}

function truncateLabel(value: string) {
  return value.length > 24 ? `${value.slice(0, 21)}...` : value;
}
