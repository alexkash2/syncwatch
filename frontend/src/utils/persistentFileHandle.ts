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

export interface PersistentFileSelection {
  file: File;
  handle: PersistentFileHandle;
}

const DB_NAME = 'syncwatch-local-files';
const STORE_NAME = 'room-file-handles';
const DB_VERSION = 1;

export function isPersistentFilePickerSupported() {
  return (
    typeof window !== 'undefined' &&
    'indexedDB' in window &&
    typeof (window as FilePickerWindow).showOpenFilePicker === 'function'
  );
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

  const database = await openDatabase();
  await runStoreRequest(
    database,
    'readwrite',
    (store) =>
      store.put({
        roomId,
        fileVersion,
        handle,
      } satisfies StoredRoomFileHandle),
    () => database.close()
  );
}

export async function restorePersistentRoomFile(
  roomId: string,
  fileVersion: number
): Promise<PersistentFileSelection | null> {
  if (!roomId || fileVersion <= 0 || !isPersistentFilePickerSupported()) {
    return null;
  }

  const database = await openDatabase();
  const stored = await runStoreRequest<StoredRoomFileHandle | undefined>(
    database,
    'readonly',
    (store) => store.get(roomId),
    () => database.close()
  );

  if (!stored) {
    return null;
  }

  if (stored.fileVersion !== fileVersion) {
    await clearPersistentRoomFileHandle(roomId);
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
    await clearPersistentRoomFileHandle(roomId);
    return null;
  }
}

export async function clearPersistentRoomFileHandle(roomId: string) {
  if (!roomId || !isPersistentFilePickerSupported()) {
    return;
  }

  const database = await openDatabase();
  await runStoreRequest(
    database,
    'readwrite',
    (store) => store.delete(roomId),
    () => database.close()
  );
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'roomId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runStoreRequest<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
  cleanup?: () => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = createRequest(transaction.objectStore(STORE_NAME));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = cleanup ?? null;
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}
