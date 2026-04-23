import { describe, expect, it } from 'vitest';
import { computeFileHash } from './fileHash';

function makeFile(size: number, fill = 0): File {
  const buf = new Uint8Array(size);
  for (let i = 0; i < size; i++) buf[i] = (fill + i) & 0xff;
  return new File([buf], 'test.bin', { type: 'video/mp4' });
}

describe('computeFileHash', () => {
  it('returns a 64-char hex SHA-256', async () => {
    const hash = await computeFileHash(makeFile(1024));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for identical content', async () => {
    const a = await computeFileHash(makeFile(2048));
    const b = await computeFileHash(makeFile(2048));
    expect(a).toBe(b);
  });

  it('differs when size differs (size is mixed into the digest)', async () => {
    const a = await computeFileHash(makeFile(1024));
    const b = await computeFileHash(makeFile(1025));
    expect(a).not.toBe(b);
  });

  it('uses head+middle+tail path for files above the small-file threshold', async () => {
    // >3MB triggers the partial-hash branch; verify it still returns a hex hash
    // and doesn't throw on the slicing math.
    const big = makeFile(4 * 1024 * 1024, 42);
    const hash = await computeFileHash(big);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
