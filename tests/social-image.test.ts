import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const IMAGE_PATH = new URL(
  "../public/social/nearby-fungi-v1.jpg",
  import.meta.url,
);

describe("social sharing image", () => {
  it("is a 1200 by 630 JPEG", async () => {
    const image = await readFile(IMAGE_PATH);

    expect(image.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(readJpegDimensions(image)).toEqual({ width: 1200, height: 630 });
  });

  it("does not publish source EXIF metadata", async () => {
    const image = await readFile(IMAGE_PATH);

    expect(image.includes(Buffer.from("Exif\0\0", "binary"))).toBe(false);
  });
});

function readJpegDimensions(image: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset + 8 < image.length) {
    if (image[offset] !== 0xff) break;
    const marker = image[offset + 1];
    const segmentLength = image.readUInt16BE(offset + 2);
    if (isStartOfFrame(marker)) {
      return {
        height: image.readUInt16BE(offset + 5),
        width: image.readUInt16BE(offset + 7),
      };
    }
    offset += segmentLength + 2;
  }
  throw new Error("JPEG dimensions were not found");
}

function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
}
