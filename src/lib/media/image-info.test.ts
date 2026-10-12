import { describe, expect, it } from "vitest";

import { readRasterInfo, sniffRasterMime } from "@/lib/media/image-info";

function writeU32BE(b: Uint8Array, i: number, value: number): void {
  b[i] = (value >>> 24) & 0xff;
  b[i + 1] = (value >>> 16) & 0xff;
  b[i + 2] = (value >>> 8) & 0xff;
  b[i + 3] = value & 0xff;
}

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13], 8);
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  writeU32BE(b, 16, width);
  writeU32BE(b, 20, height);
  return b;
}

function gif(width: number, height: number): Uint8Array {
  const b = new Uint8Array(10);
  const sig = "GIF89a";
  for (let i = 0; i < sig.length; i += 1) b[i] = sig.charCodeAt(i);
  b[6] = width & 0xff;
  b[7] = (width >> 8) & 0xff;
  b[8] = height & 0xff;
  b[9] = (height >> 8) & 0xff;
  return b;
}

function jpeg(width: number, height: number): Uint8Array {
  const b = new Uint8Array(17);
  b[0] = 0xff;
  b[1] = 0xd8;
  b[2] = 0xff;
  b[3] = 0xe0; // APP0
  b[4] = 0x00;
  b[5] = 0x04;
  b[8] = 0xff;
  b[9] = 0xc0; // SOF0
  b[10] = 0x00;
  b[11] = 0x11;
  b[12] = 0x08;
  b[13] = (height >> 8) & 0xff;
  b[14] = height & 0xff;
  b[15] = (width >> 8) & 0xff;
  b[16] = width & 0xff;
  return b;
}

function webpVp8x(width: number, height: number): Uint8Array {
  const b = new Uint8Array(30);
  const put = (i: number, s: string) => {
    for (let k = 0; k < s.length; k += 1) b[i + k] = s.charCodeAt(k);
  };
  put(0, "RIFF");
  put(8, "WEBP");
  put(12, "VP8X");
  const w = width - 1;
  const h = height - 1;
  b[24] = w & 0xff;
  b[25] = (w >> 8) & 0xff;
  b[26] = (w >> 16) & 0xff;
  b[27] = h & 0xff;
  b[28] = (h >> 8) & 0xff;
  b[29] = (h >> 16) & 0xff;
  return b;
}

describe("sniffRasterMime", () => {
  it("detects PNG, JPEG, GIF and WebP", () => {
    expect(sniffRasterMime(png(10, 10))).toBe("image/png");
    expect(sniffRasterMime(jpeg(10, 10))).toBe("image/jpeg");
    expect(sniffRasterMime(gif(10, 10))).toBe("image/gif");
    expect(sniffRasterMime(webpVp8x(10, 10))).toBe("image/webp");
  });

  it("rejects non-image content even if it is named like an image", () => {
    const text = new TextEncoder().encode("<?php echo 1; ?> this is not an image");
    expect(sniffRasterMime(text)).toBeNull();
  });
});

describe("readRasterInfo", () => {
  it("reads PNG dimensions", () => {
    expect(readRasterInfo(png(1920, 1080))).toMatchObject({
      mime: "image/png",
      width: 1920,
      height: 1080,
    });
  });

  it("reads GIF dimensions", () => {
    expect(readRasterInfo(gif(640, 360))).toMatchObject({
      mime: "image/gif",
      width: 640,
      height: 360,
    });
  });

  it("reads JPEG dimensions from the SOF marker", () => {
    expect(readRasterInfo(jpeg(1280, 720))).toMatchObject({
      mime: "image/jpeg",
      width: 1280,
      height: 720,
    });
  });

  it("reads WebP (VP8X) dimensions", () => {
    expect(readRasterInfo(webpVp8x(800, 450))).toMatchObject({
      mime: "image/webp",
      width: 800,
      height: 450,
    });
  });

  it("returns nulls for unknown content", () => {
    const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(readRasterInfo(junk)).toEqual({
      mime: null,
      width: null,
      height: null,
    });
  });
});
