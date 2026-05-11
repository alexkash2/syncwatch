type PickerPermissionState = 'granted' | 'denied' | 'prompt';

interface PersistentFileHandle {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
  queryPermission?: (descriptor?: { mode?: 'read' }) => Promise<PickerPermissionState>;
}

interface FilePickerWindow extends Window {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<PersistentFileHandle[]>;
}

interface StoredRoomFileHandle {
  roomId: string;
  fileVersion: number;
  handle: PersistentFileHandle;
}

interface StoredRoomFileBlob {
  roomId: string;
  fileVersion: number;
  file: File;
}

export interface PersistentFileSelection {
  file: File;
  handle: PersistentFileHandle;
}

export interface RestoredRoomFile {
  file: File;
  handle?: PersistentFileHandle;
}

const DB_NAME = 'syncwatch-local-files';
const HANDLE_STORE = 'room-file-handles';
const BLOB_STORE = 'room-file-blobs';
const DB_VERSION = 2;

// Hard cap for the cross-browser fallback. Cinematic 1080p rips routinely break
// 2 GB and would either fail the structured-clone write or blow the per-origin
// quota on Safari; keep the cached copy modest and let large files reselect.
const MAX_FALLBACK_BLOB_BYTES = 1024 * 1024 * 1024;

export function hasFileSystemAccessAPI() {
  return (
    typeof window !== 'undefined' &&
    typeof (window as FilePickerWindow).showOpenFilePicker === 'function'
  );
}

export function hasIndexedDB() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

export function isPersistentFilePickerSupported() {
  return hasIndexedDB() && hasFileSystemAccessAPI();
}

export function isRoomFilePersistenceSupported() {
  return hasIndexedDB();
}

export async function pickPersistentVideoFile(): Promise<PersistentFileSelection | null> {
  const picker = (window as FilePickerWindow).showOpenFilePicker;
  if (!picker) {
    return null;
  }

  const [handle] = await picker({
    multiple: false,
    types: [
      {
        description: 'Video files',
        accept: {
          'video/*': ['.mp4', '.mkv', '.webm', '.mov', '.m4v', '.avi'],
        },
      },
    ],
  });

  if (!handle) {
    return null;
  }

  return {
    file: await handle.getFile(),
    handle,
  };
}

export async function savePersistentRoomFileHandle(
  roomId: string,
  fileVersion: number,
  handle: PersistentFileHandle
) {
  if (!roomId || fileVersion <= 0 || !isPersistentFilePickerSupported()) {
    return;
  }

  try {
    const database = await openDatabase();
    await runStoreRequest(
      database,
      HANDLE_STORE,
      'readwrite',
      (store) =>
        store.put({
          roomId,
          fileVersion,
          handle,
        } satisfies StoredRoomFileHandle),
      () => database.close()
    );
  } catch {
    // best effort — losing persistence is not fatal
  }
}

export async function saveFallbackRoomFile(
  roomId: string,
  fileVersion: number,
  file: File
) {
  if (!roomId || fileVersion <= 0 || !isRoomFilePersistenceSupported()) {
    return;
  }
  if (file.size > MAX_FALLBACK_BLOB_BYTES) {
    return;
  }

  try {
    const database = await openDatabase();
    await runStoreRequest(
      database,
      BLOB_STORE,
      'readwrite',
      (store) =>
        store.put({
          roomId,
          fileVersion,
          file,
        } satisfies StoredRoomFileBlob),
      () => database.close()
    );
  } catch {
    // Quota errors, structured-clone failures, etc. — drop silently.
  }
}

export async function restoreRoomFile(
  roomId: string,
  fileVersion: number
): Promise<RestoredRoomFile | null> {
  if (!roomId || fileVersion <= 0 || !isRoomFilePersistenceSupported()) {
    return null;
  }

  const fromHandle = await restoreFromHandle(roomId, fileVersion);
  if (fromHandle) {
    return fromHandle;
  }

  return restoreFromBlob(roomId, fileVersion);
}

export async function clearPersistedRoomFile(roomId: string) {
  if (!roomId || !isRoomFilePersistenceSupported()) {
    return;
  }

  try {
    const database = await openDatabase();
    await runStoreRequest(
      database,
      HANDLE_STORE,
      'readwrite',
      (store) => store.delete(roomId),
      () => undefined
    );
    await runStoreRequest(
      database,
      BLOB_STORE,
      'readwrite',
      (store) => store.delete(roomId),
      () => database.close()
    );
  } catch {
    // ignore
  }
}

async function restoreFromHandle(
  roomId: string,
  fileVersion: number
): Promise<RestoredRoomFile | null> {
  if (!isPersistentFilePickerSupported()) {
    return null;
  }

  let database: IDBDatabase;
  try {
    database = await openDatabase();
  } catch {
    return null;
  }

  let stored: StoredRoomFileHandle | undefined;
  try {
    stored = await runStoreRequest<StoredRoomFileHandle | undefined>(
      database,
      HANDLE_STORE,
      'readonly',
      (store) => store.get(roomId),
      () => database.close()
    );
  } catch {
    return null;
  }

  if (!stored) {
    return null;
  }

  if (stored.fileVersion !== fileVersion) {
    await clearPersistedRoomFile(roomId);
    return null;
  }

  const permission = await stored.handle.queryPermission?.({ mode: 'read' });
  if (permission && permission !== 'granted') {
    return null;
  }

  try {
    return {
      file: await stored.handle.getFile(),
      handle: stored.handle,
    };
  } catch {
    await clearPersistedRoomFile(roomId);
    return null;
  }
}

async function restoreFromBlob(
  roomId: string,
  fileVersion: number
): Promise<RestoredRoomFile | null> {
  let database: IDBDatabase;
  try {
    database = await openDatabase();
  } catch {
    return null;
  }

  let stored: StoredRoomFileBlob | undefined;
  try {
    stored = await runStoreRequest<StoredRoomFileBlob | undefined>(
      database,
      BLOB_STORE,
      'readonly',
      (store) => store.get(roomId),
      () => database.close()
    );
  } catch {
    return null;
  }

  if (!stored) {
    return null;
  }

  if (stored.fileVersion !== fileVersion) {
    await clearPersistedRoomFile(roomId);
    return null;
  }

  return { file: stored.file };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HANDLE_STORE)) {
        database.createObjectStore(HANDLE_STORE, { keyPath: 'roomId' });
      }
      if (!database.objectStoreNames.contains(BLOB_STORE)) {
        database.createObjectStore(BLOB_STORE, { keyPath: 'roomId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
  });
}

function runStoreRequest<T>(
  database: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
  cleanup?: () => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = createRequest(transaction.objectStore(storeName));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = cleanup ?? null;
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}
