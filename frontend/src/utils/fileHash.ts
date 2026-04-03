const CHUNK_SIZE = 1024 * 1024; // 1 MB

export async function computeFileHash(file: File): Promise<string> {
  const fileSize = file.size;
  let combinedBuffer: ArrayBuffer;

  if (fileSize <= CHUNK_SIZE * 3) {
    combinedBuffer = await file.arrayBuffer();
  } else {
    const headSlice = file.slice(0, CHUNK_SIZE);
    const middleStart = Math.floor(fileSize / 2);
    const middleSlice = file.slice(middleStart, middleStart + CHUNK_SIZE);
    const tailSlice = file.slice(fileSize - CHUNK_SIZE, fileSize);

    const [headBuf, middleBuf, tailBuf] = await Promise.all([
      headSlice.arrayBuffer(),
      middleSlice.arrayBuffer(),
      tailSlice.arrayBuffer(),
    ]);

    // Append file size as 8-byte big-endian
    const sizeBuf = new ArrayBuffer(8);
    new DataView(sizeBuf).setBigUint64(0, BigInt(fileSize), false);

    const totalLength = headBuf.byteLength + middleBuf.byteLength + tailBuf.byteLength + 8;
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of [headBuf, middleBuf, tailBuf, sizeBuf]) {
      combined.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }
    combinedBuffer = combined.buffer;
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', combinedBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getVideoDurationMs(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.round(video.duration * 1000));
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read video metadata'));
    };
    video.src = url;
  });
}
