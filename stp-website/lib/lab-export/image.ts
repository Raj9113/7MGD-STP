/** Reads width/height from a JPEG, PNG or WebP file header (no image library needed). */
export type ImageKind = 'jpeg' | 'png' | 'webp';

export interface ImageInfo { kind: ImageKind; width: number; height: number }

export function imageInfo(b: Buffer): ImageInfo | null {
  // PNG: 8-byte signature, then IHDR with width/height at bytes 16..23
  if (b.length > 24 && b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG') {
    return { kind: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }

  // JPEG: walk the segments until a start-of-frame marker
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { kind: 'jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
  }

  // WebP: RIFF....WEBP + VP8 (lossy) / VP8L (lossless) / VP8X (extended)
  if (b.length > 30 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    const fourcc = b.toString('latin1', 12, 16);
    if (fourcc === 'VP8 ') return { kind: 'webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (fourcc === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { kind: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (fourcc === 'VP8X') return { kind: 'webp', width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  }
  return null;
}
