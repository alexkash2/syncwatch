import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { computeFileHash, getVideoDurationMs } from '../../utils/fileHash';
import {
  clearPersistedRoomFile,
  isPersistentFilePickerSupported,
  pickPersistentVideoFile,
  restoreRoomFile,
  saveFallbackRoomFile,
  savePersistentRoomFileHandle,
  type PersistentFileSelection,
} from '../../utils/persistentFileHandle';
import type { FileVerifyResult, RoomStatus } from '../../types/ws';
import { useI18n } from '../../hooks/useI18n';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { FileIcon } from '../ui/icons';

export type FileStatus =
  | 'idle'
  | 'hashing'
  | 'verifying'
  | 'verified'
  | 'mismatch'
  | 'error'
  | 'not_video';

interface FileSelectorProps {
  roomId: string;
  onFileVerified: (fileUrl: string) => void;
  /** Returns whether the verify request was actually sent (socket open). */
  onVerifyRequest: (hash: string, size: number, durationMs: number, fileName: string) => boolean;
  verifyResult: FileVerifyResult | null;
  isHost: boolean;
  roomStatus: RoomStatus;
  referenceFileName: string | null;
  referenceFileVersion: number;
  /** Whether the room socket is open — gates the one-shot persistent auto-restore
   *  so it isn't burned while the socket is still connecting. */
  socketReady: boolean;
}

export function FileSelector({
  roomId,
  onFileVerified,
  onVerifyRequest,
  verifyResult,
  isHost,
  roomStatus,
  referenceFileName,
  referenceFileVersion,
  socketReady,
}: FileSelectorProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<FileStatus>('idle');
  const [fileName, setFileName] = useState('');
  const requestNonce = useRef(0);
  const pendingFile = useRef<{
    url: string;
    hash: string;
    size: number;
    durationMs: number;
    file: File;
    persistentHandle?: PersistentFileSelection['handle'];
  } | null>(null);
  const restoredFileKeyRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      // Invalidate any in-flight hashing so a late resume can't createObjectURL /
      // setState / send a verify from an unmounted selector (leaking the URL).
      requestNonce.current += 1;
      if (pendingFile.current) {
        URL.revokeObjectURL(pendingFile.current.url);
      }
    };
  }, []);

  const persistentFileKey = useMemo(
    () => (roomId && referenceFileVersion > 0 ? `${roomId}:${referenceFileVersion}` : null),
    [referenceFileVersion, roomId]
  );

  const processSelectedFile = useCallback(
    async (file: File, options: { persistentHandle?: PersistentFileSelection['handle'] } = {}) => {
      requestNonce.current += 1;
      const currentNonce = requestNonce.current;

      if (pendingFile.current) {
        URL.revokeObjectURL(pendingFile.current.url);
        pendingFile.current = null;
      }

      setFileName(file.name);

      if (file.type && !file.type.startsWith('video/')) {
        setStatus('not_video');
        void clearPersistedRoomFile(roomId);
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
        pendingFile.current = {
          url: fileUrl,
          hash,
          size: file.size,
          durationMs,
          file,
          persistentHandle: options.persistentHandle,
        };
        setStatus('verifying');
        // If the socket is down the verify never reaches the server and no
        // response arrives, so don't wedge in 'verifying' forever — revert to an
        // actionable state so the user can retry once the connection recovers.
        if (!onVerifyRequest(hash, file.size, durationMs, file.name)) {
          if (pendingFile.current) {
            URL.revokeObjectURL(pendingFile.current.url);
            pendingFile.current = null;
          }
          setStatus('idle');
        }
      } catch {
        if (currentNonce === requestNonce.current) {
          setStatus('error');
        }
      }

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [onVerifyRequest, roomId]
  );

  const handleChooseFile = async () => {
    if (status === 'hashing' || status === 'verifying') {
      return;
    }

    if (isPersistentFilePickerSupported()) {
      try {
        const selection = await pickPersistentVideoFile();
        if (selection) {
          await processSelectedFile(selection.file, { persistentHandle: selection.handle });
          return;
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Failed to open persistent file picker:', error);
        }
      }
    }

    inputRef.current?.click();
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    void processSelectedFile(file);
  };

  useEffect(() => {
    if (!verifyResult || status !== 'verifying') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const pending = pendingFile.current;
      if (!pending || pendingFile.current !== pending) {
        return;
      }

      if (verifyResult.file_hash && verifyResult.file_hash !== pending.hash) {
        return;
      }

      if (verifyResult.match) {
        const { persistentHandle, url, file } = pending;
        if (verifyResult.file_version) {
          if (persistentHandle) {
            void savePersistentRoomFileHandle(roomId, verifyResult.file_version, persistentHandle);
          } else {
            void saveFallbackRoomFile(roomId, verifyResult.file_version, file);
          }
        }
        setStatus('verified');
        pendingFile.current = null;
        onFileVerified(url);
        return;
      }

      const waitingForHost =
        !!verifyResult.reason && verifyResult.reason.toLowerCase().includes('has not selected');

      setStatus(waitingForHost ? 'idle' : 'mismatch');
      void clearPersistedRoomFile(roomId);

      if (pendingFile.current === pending) {
        URL.revokeObjectURL(pending.url);
        pendingFile.current = null;
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [onFileVerified, roomId, status, verifyResult]);

  const isWaitingForHost = !isHost && !referenceFileName && roomStatus === 'waiting_file';

  useEffect(() => {
    if (
      !socketReady ||
      !persistentFileKey ||
      !referenceFileName ||
      isWaitingForHost ||
      status !== 'idle' ||
      restoredFileKeyRef.current === persistentFileKey
    ) {
      // Wait for the socket: marking the key restored before we can actually send
      // the verify would burn the one-shot and never retry after reconnect.
      return;
    }

    let cancelled = false;
    const keyForThisRun = persistentFileKey;

    void restoreRoomFile(roomId, referenceFileVersion).then((restored) => {
      if (cancelled || !restored) {
        return;
      }
      // Mark the one-shot ONLY when we actually proceed. Setting it up-front
      // breaks under React StrictMode: the first setup marks the key, its
      // cleanup cancels, and the second setup then bails on the already-marked
      // key — so the restore never runs.
      restoredFileKeyRef.current = keyForThisRun;
      void processSelectedFile(restored.file, { persistentHandle: restored.handle });
    });

    return () => {
      cancelled = true;
    };
  }, [
    isWaitingForHost,
    persistentFileKey,
    processSelectedFile,
    referenceFileName,
    referenceFileVersion,
    roomId,
    socketReady,
    status,
  ]);

  const chooseButton = (label: string) => (
    <Button
      variant="primary"
      size="lg"
      leadingIcon={<FileIcon size={17} />}
      onClick={() => void handleChooseFile()}
      disabled={status === 'hashing' || status === 'verifying'}
    >
      {label}
    </Button>
  );

  const warnGlyph = (
    <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[#E8B34A]/40 bg-[#E8B34A]/[0.14] text-[#E8B34A]">
      <FileIcon size={28} />
    </span>
  );

  let body: ReactNode;
  if (status === 'hashing' || status === 'verifying' || status === 'verified') {
    body = (
      <>
        <Spinner size={36} className="mx-auto mb-[22px]" />
        <p className="m-0 text-base font-semibold text-on-stage">
          {status === 'hashing' ? t.hashing : status === 'verified' ? t.ready_to_watch : t.verifying}
        </p>
        {fileName && (
          <p className="mt-2 font-mono text-[13.5px] text-on-stage-2">{fileName}</p>
        )}
      </>
    );
  } else if (status === 'mismatch') {
    body = (
      <>
        {warnGlyph}
        <p className="mb-2 text-lg font-semibold text-on-stage">{t.st_mismatch_title}</p>
        <p className="mb-6 text-sm leading-[1.55] text-on-stage-2">
          {verifyResult?.reason || t.st_mismatch_sub}
        </p>
        {chooseButton(t.st_mismatch_btn)}
      </>
    );
  } else if (status === 'error') {
    body = (
      <>
        {warnGlyph}
        <p className="mb-2 text-lg font-semibold text-on-stage">{t.file_unreadable}</p>
        <p className="mb-6 text-sm leading-[1.55] text-on-stage-2">{t.file_unreadable_sub}</p>
        {chooseButton(t.choose_file)}
      </>
    );
  } else if (status === 'not_video') {
    body = (
      <>
        {warnGlyph}
        <p className="mb-2 text-lg font-semibold text-on-stage">{t.file_not_video}</p>
        <p className="mb-6 text-sm leading-[1.55] text-on-stage-2">{t.file_not_video_sub}</p>
        {chooseButton(t.choose_file)}
      </>
    );
  } else if (isWaitingForHost) {
    body = (
      <>
        <span className="mb-5 inline-flex text-accent">
          <FileIcon size={40} />
        </span>
        <p className="m-0 text-lg font-semibold text-on-stage">{t.waiting_host_file}</p>
      </>
    );
  } else {
    body = (
      <>
        <span className="mb-5 inline-flex text-accent">
          <FileIcon size={40} />
        </span>
        <p className="mb-2 text-lg font-semibold text-on-stage">
          {isHost ? t.select_file_host : t.select_file_viewer}
        </p>
        <p className="mb-6 text-sm leading-[1.55] text-on-stage-2">
          {isHost ? t.select_file_host_sub : t.select_file_viewer_sub}
        </p>
        {chooseButton(t.choose_file)}
      </>
    );
  }

  return (
    <div className="max-w-[400px] px-7 text-center">
      {body}
      <input ref={inputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
    </div>
  );
}
