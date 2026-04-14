import { useRef, useState, useEffect } from 'react';
import { computeFileHash, getVideoDurationMs } from '../../utils/fileHash';

export type FileStatus = 'idle' | 'hashing' | 'verifying' | 'verified' | 'mismatch' | 'error';

interface FileSelectorProps {
  onFileVerified: (fileUrl: string) => void;
  onVerifyRequest: (hash: string, size: number, durationMs: number, fileName: string) => void;
  verifyResult: { match: boolean; reason?: string; file_version?: number } | null;
  isHost: boolean;
}

export function FileSelector({ onFileVerified, onVerifyRequest, verifyResult, isHost }: FileSelectorProps) {
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

    // Increment nonce to invalidate any pending verify result
    requestNonce.current++;
    const myNonce = requestNonce.current;
    pendingFile.current = null;

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

  // Handle verify result — setState driven by prop change, safe pattern
  useEffect(() => {
    if (!verifyResult || status !== 'verifying') return;

    if (verifyResult.match && pendingFile.current) {
      const { url } = pendingFile.current;
      setStatus('verified'); // eslint-disable-line react-hooks/set-state-in-effect
      onFileVerified(url);
      pendingFile.current = null;
    } else if (!verifyResult.match) {
      setStatus('mismatch');
      if (pendingFile.current) {
        URL.revokeObjectURL(pendingFile.current.url);
        pendingFile.current = null;
      }
    }
  }, [verifyResult, status, onFileVerified]);

  return (
    <div className="flex-1 flex items-center justify-center bg-surface-container-lowest p-4 md:p-12">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-surface-container-high flex items-center justify-center border border-primary-container/20 text-4xl">
          🎬
        </div>

        {status === 'idle' && (
          <>
            <h2 className="font-black text-xl md:text-2xl tracking-tight text-on-surface">
              Select a video file to start
            </h2>
            <p className="text-on-surface-variant max-w-xs mx-auto text-sm">
              {isHost
                ? 'Choose a video file. Other participants will need to select the same file.'
                : 'Choose the same video file as the host to sync playback.'}
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

        {status === 'error' && (
          <>
            <h2 className="font-black text-xl md:text-2xl tracking-tight text-error">
              Failed to read file
            </h2>
            <p className="text-on-surface-variant max-w-xs mx-auto text-sm">
              The file format may not be supported by your browser.
            </p>
          </>
        )}

        {status !== 'verified' && (
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
