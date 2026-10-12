/**
 * Minimal raster-image inspector.
 *
 * Uploaded files are validated on the SERVER, not only in the browser. A client
 * can lie about `file.type`, so the real content is inspected from its magic
 * bytes and its pixel dimensions are read from the container header. Only the
 * formats the product accepts for featured images are understood here:
 * PNG, JPEG and WebP (plus GIF, which the shared media library also allows).
 *
 * Everything is pure and synchronous so it can be unit-tested with byte
 * fixtures and reused with no I/O.
 */

export type RasterMime =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp";

export interface ImageInfo {
  /** Detected from magic bytes, or null when the content is not a known raster. */
  mime: RasterMime | null;
  width: number | null;
  height: number | null;
}

function readU16BE(b: Uint8Array, i: number): number {
  return (b[i] << 8) | b[i + 1];
}

function readU32BE(b: Uint8Array, i: number): number {
  return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
}

function readU16LE(b: Uint8Array, i: number): number {
  return b[i] | (b[i + 1] << 8);
}

function ascii(b: Uint8Array, i: number, length: number): string {
  let out = "";
  for (let k = 0; k < length; k += 1) out += String.fromCharCode(b[i + k]);
  return out;
}

/** Detects the raster format from the leading bytes alone. */
export function sniffRasterMime(bytes: Uint8Array): RasterMime | null {
  if (bytes.length >= 8) {
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return "image/png";
    }
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (bytes.length >= 6) {
    const sig = ascii(bytes, 0, 6);
    if (sig === "GIF87a" || sig === "GIF89a") return "image/gif";
  }

  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function readPng(b: Uint8Array): { width: number; height: number } | null {
  // IHDR is always the first chunk: width/height are big-endian at 16/20.
  if (b.length < 24) return null;
  return { width: readU32BE(b, 16), height: readU32BE(b, 20) };
}

function readGif(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 10) return null;
  return { width: readU16LE(b, 6), height: readU16LE(b, 8) };
}

function readJpeg(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i < b.length - 1) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }

    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }

    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }

    // Start of scan / end of image: no frame header found before pixel data.
    if (marker === 0xda || marker === 0xd9) break;

    if (i + 4 > b.length) break;
    const segmentLength = readU16BE(b, i + 2);
    if (segmentLength < 2) break;

    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isStartOfFrame) {
      if (i + 9 > b.length) break;
      return { height: readU16BE(b, i + 5), width: readU16BE(b, i + 7) };
    }

    i += 2 + segmentLength;
  }

  return null;
}

function readWebp(b: Uint8Array): { width: number; height: number } | null {
  const format = ascii(b, 12, 4);

  if (format === "VP8 ") {
    // Lossy: frame tag (3) + sync code (3) then 14-bit width/height.
    if (b.length < 30 || b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) {
      return null;
    }
    return { width: readU16LE(b, 26) & 0x3fff, height: readU16LE(b, 28) & 0x3fff };
  }

  if (format === "VP8L") {
    // Lossless: 0x2f signature then 14-bit (width-1) and (height-1).
    if (b.length < 25 || b[20] !== 0x2f) return null;
    const bits =
      (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  if (format === "VP8X") {
    // Extended: 24-bit canvas width/height, stored minus one.
    if (b.length < 30) return null;
    return {
      width: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
      height: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1,
    };
  }

  return null;
}

/**
 * Reads the pixel dimensions of the detected raster format.
 * Returns null when the header is truncated or unrecognised.
 */
export function readImageSize(
  bytes: Uint8Array,
  mime: RasterMime,
): { width: number; height: number } | null {
  try {
    switch (mime) {
      case "image/png":
        return readPng(bytes);
      case "image/gif":
        return readGif(bytes);
      case "image/jpeg":
        return readJpeg(bytes);
      case "image/webp":
        return readWebp(bytes);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/** Convenience: sniff the format and read its dimensions in one call. */
export function readRasterInfo(bytes: Uint8Array): ImageInfo {
  const mime = sniffRasterMime(bytes);
  if (!mime) return { mime: null, width: null, height: null };

  const size = readImageSize(bytes, mime);
  return {
    mime,
    width: size?.width ?? null,
    height: size?.height ?? null,
  };
}
