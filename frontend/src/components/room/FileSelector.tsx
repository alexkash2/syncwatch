import { useRef, useState, useEffect } from 'react';
import { computeFileHash, getVideoDurationMs } from '../../utils/fileHash';

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
  /** Server response for the last verify request. `file_hash` is the hash the
   * server is replying about — we use it to discard late responses for files
   * the user has already replaced. */
  verifyResult: {
    match: boolean;
    reason?: string;
    file_version?: number;
    file_hash?: string;
  } | null;
  isHost: boolean;
  /** True while the host hasn't selected a reference file yet. Non-hosts should
   * see a "waiting for host" state instead of being invited to pick a file. */
  hostFilePending?: boolean;
}

export function FileSelector({
  onFileVerified,
  onVerifyRequest,
  verifyResult,
  isHost,
  hostFilePending = false,
}: FileSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<FileStatus>('idle');
  const [fileName, setFileName] = useState('');
  // Track which request the current verifyResult belongs to
  const requestNonce = useRef(0);
  const pendingNonce = useRef(0);
  const pendingFile = useRef<{ url: string; hash: string; size: number; durationMs: number } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // `accept="video/*"` only filters the picker — users can still drop a
    // non-video. Give this its own status so the UI doesn't misattribute
    // the failure to "browser can't read this format".
    if (file.type && !file.type.startsWith('video/')) {
      setFileName(file.name);
      setStatus('not_video');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    // Increment nonce to invalidate any pending verify result
    requestNonce.current++;
    const myNonce = requestNonce.current;
    // Revoke any blob URL left over from a prior in-flight selection before
    // we drop the reference, otherwise we leak it on fast re-selects.
    if (pendingFile.current) {
      URL.revokeObjectURL(pendingFile.current.url);
      pendingFile.current = null;
    }

    setFileName(file.name);
    setStatus('hashing');

    try {
      const [hash, durationMs] = await Promise.all([
        computeFileHash(file),
        getVideoDurationMs(file),
      ]);

      // Check if user selected another file while we were hashing
      if (myNonce !== requestNonce.current) return;

      const fileUrl = URL.createObjectURL(file);
      pendingFile.current = { url: fileUrl, hash, size: file.size, durationMs };
      pendingNonce.current = myNonce;

      setStatus('verifying');
      onVerifyRequest(hash, file.size, durationMs, file.name);
    } catch {
      if (myNonce === requestNonce.current) {
        setStatus('error');
      }
    }

    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  };

  // Revoke any in-flight blob URL if the selector unmounts mid-verify.
  useEffect(() => {
    return () => {
      if (pendingFile.current) {
        URL.revokeObjectURL(pendingFile.current.url);
        pendingFile.current = null;
      }
    };
  }, []);

  // Handle verify result — setState driven by prop change, safe pattern
  useEffect(() => {
    if (!verifyResult || status !== 'verifying') return;
    // Discard a late response for a file the user already replaced. The
    // server echoes the hash it processed; if it doesn't match what we're
    // currently waiting on, the response belongs to an older request.
    if (
      verifyResult.file_hash &&
      pendingFile.current &&
      verifyResult.file_hash !== pendingFile.current.hash
    ) {
      return;
    }

    if (verifyResult.match && pendingFile.current) {
      const { url } = pendingFile.current;
      setStatus('verified'); // eslint-disable-line react-hooks/set-state-in-effect
      onFileVerified(url);
      pendingFile.current = null;
    } else if (!verifyResult.match) {
      // Back to idle if the reason is "host hasn't chosen a file" — that's
      // semantically waiting, not a file mismatch.
      const waitingForHost =
        !!verifyResult.reason &&
        verifyResult.reason.toLowerCase().includes('has not selected');
      setStatus(waitingForHost ? 'idle' : 'mismatch');
      if (pendingFile.current) {
        URL.revokeObjectURL(pendingFile.current.url);
        pendingFile.current = null;
      }
    }
  }, [verifyResult, status, onFileVerified]);

  // Non-hosts can't pick a file until the host has set the reference.
  const isWaitingForHost = !isHost && hostFilePending;

  return (
    <div className="flex-1 flex items-center justify-center bg-surface-container-lowest p-4 md:p-12">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-surface-container-high flex items-center justify-center border border-primary-container/20 text-4xl">
          🎬
        </div>

        {status === 'idle' && isWaitingForHost && (
          <>
            <h2 className="font-black text-xl md:text-2xl tracking-tight text-on-surface">
              Waiting for host…
            </h2>
            <p className="text-on-surface-variant max-w-xs mx-auto text-sm">
              The host hasn't chosen a video yet. You'll be prompted to select the same file once they do.
            </p>
            <div className="w-12 h-12 mx-auto border-4 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
          </>
        )}

        {status === 'idle' && !isWaitingForHost && (
          <>
            <h2 className="font-black text-xl md:text-2xl tracking-tight text-on-surface">
              {isHost ? 'Select a video file to start' : 'Select the host\u2019s video file'}
            </h2>
            <p className="text-on-surface-variant max-w-xs mx-auto text-sm">
              {isHost
                ? 'Choose a video file. Other participants will need to select the same file.'
                : 'The host picked a video. Choose the exact same file on your device to join.'}
            </p>
          </>
        )}

        {status === 'hashing' && (
          <>
            <h2 className="font-black text-xl md:text-2xl tracking-tight text-on-surface">
              Computing file hash...
            </h2>
            <p className="text-on-surface-variant max-w-xs mx-auto text-sm">{fileName}</p>
            <div className="w-12 h-12 mx-auto border-4 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
          </>
        )}

        {status === 'verifying' && (
          <>
            <h2 className="font-black text-xl md:text-2xl tracking-tight text-on-surface">
              Verifying file...
            </h2>
            <p className="text-on-surface-variant max-w-xs mx-auto text-sm">{fileName}</p>
            <div className="w-12 h-12 mx-auto border-4 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
          </>
        )}

        {status === 'mismatch' && (
          <>
            <h2 className="font-black text-xl md:text-2xl tracking-tight text-error">
              File does not match
            </h2>
            <p className="text-on-surface-variant max-w-xs mx-auto text-sm">
              {verifyResult?.reason || 'Please select the same file as the host.'}
            </p>
          </>
        )}

        {status === 'not_video' && (
          <>
            <h2 className="font-black text-xl md:text-2xl tracking-tight text-error">
              That's not a video file
            </h2>
            <p className="text-on-surface-variant max-w-xs mx-auto text-sm">
              {fileName
                ? `"${fileName}" isn't a video. Pick a video file (mp4, mkv, webm, …).`
                : "Pick a video file (mp4, mkv, webm, …)."}
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <h2 className="font-black text-xl md:text-2xl tracking-tight text-error">
              Failed to read file
            </h2>
            <p className="text-on-surface-variant max-w-xs mx-auto text-sm">
              Couldn't read this video. The file may be corrupted, or the codec
              isn't supported by your browser.
            </p>
          </>
        )}

        {status !== 'verified' && !isWaitingForHost && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={status === 'hashing' || status === 'verifying'}
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-br from-primary-container to-[#0053da] text-on-primary-container font-bold uppercase text-xs tracking-widest active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {status === 'idle' ? 'Choose Video File' : 'Try Another File'}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
