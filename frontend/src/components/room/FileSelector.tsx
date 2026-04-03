import { useRef, useState } from 'react';
import { computeFileHash, getVideoDurationMs } from '../../utils/fileHash';

export type FileStatus = 'idle' | 'hashing' | 'verifying' | 'verified' | 'mismatch' | 'error';

interface FileSelectorProps {
  onFileReady: (fileUrl: string, hash: string, size: number, durationMs: number) => void;
  onVerifyRequest: (hash: string, size: number, durationMs: number) => void;
  verifyResult: { match: boolean; reason?: string } | null;
  status: FileStatus;
  setStatus: (status: FileStatus) => void;
}

export function FileSelector({ onFileReady, onVerifyRequest, verifyResult, status, setStatus }: FileSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStatus('hashing');

    try {
      const [hash, durationMs] = await Promise.all([
        computeFileHash(file),
        getVideoDurationMs(file),
      ]);

      setStatus('verifying');
      onVerifyRequest(hash, file.size, durationMs);

      // Store file URL for when verification succeeds
      const fileUrl = URL.createObjectURL(file);
      // Save for later use by parent
      (window as any).__syncwatch_pending_file = { fileUrl, hash, size: file.size, durationMs };
    } catch {
      setStatus('error');
    }
  };

  // React to verify result
  if (verifyResult && status === 'verifying') {
    if (verifyResult.match) {
      const pending = (window as any).__syncwatch_pending_file;
      if (pending) {
        setStatus('verified');
        onFileReady(pending.fileUrl, pending.hash, pending.size, pending.durationMs);
        delete (window as any).__syncwatch_pending_file;
      }
    } else {
      setStatus('mismatch');
    }
  }

  if (status === 'verified') return null; // Hide selector when file is loaded

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
              Choose a local video file to sync playback with the room.
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

        <button
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-br from-primary-container to-[#0053da] text-on-primary-container font-bold uppercase text-xs tracking-widest active:scale-95 transition-all cursor-pointer"
        >
          {status === 'idle' ? 'Choose Video File' : 'Try Another File'}
        </button>

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
