import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const launchKitPath = new URL("../docs/launch/product-hunt.md", import.meta.url);
const thumbnailPath = new URL("../docs/launch/assets/product-hunt-thumbnail.png", import.meta.url);
const galleryPaths = [
  new URL("../docs/launch/assets/gallery-01-find-a-time.png", import.meta.url),
  new URL("../docs/launch/assets/gallery-02-booking-link.png", import.meta.url),
  new URL("../docs/launch/assets/gallery-03-group-scheduling.png", import.meta.url),
];
const maxLaunchImageBytes = 3 * 1024 * 1024;

test("Product Hunt launch copy respects field limits", async () => {
  const markdown = await readFile(launchKitPath, "utf8");
  const tagline = readListValue(markdown, "Tagline");
  const description = readCodeBlockAfterHeading(markdown, "Description");

  assert.equal(tagline, "easiest way to find a time");
  assert.ok(tagline.length <= 60);
  assert.ok(description.length <= 500);
});

test("Product Hunt launch images use expected dimensions", async () => {
  await assertLaunchImageSize(thumbnailPath);
  assert.deepEqual(await readPngDimensions(thumbnailPath), {
    width: 240,
    height: 240,
  });

  for (const galleryPath of galleryPaths) {
    await assertLaunchImageSize(galleryPath);
    assert.deepEqual(await readPngDimensions(galleryPath), {
      width: 1270,
      height: 760,
    });
  }
});

function readListValue(markdown, label) {
  const match = markdown.match(new RegExp(`^- ${label}: \`(.+)\`$`, "mu"));

  assert.notEqual(match, null, `${label} missing from launch kit`);

  return match[1];
}

function readCodeBlockAfterHeading(markdown, label) {
  const match = markdown.match(
    new RegExp(`^- ${label}:\\n\\n\`\`\`text\\n([\\s\\S]+?)\\n\`\`\``, "mu"),
  );

  assert.notEqual(match, null, `${label} code block missing from launch kit`);

  return match[1].replaceAll("\n", " ").trim();
}

async function readPngDimensions(path) {
  const buffer = await readFile(path);

  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  assert.equal(buffer.toString("ascii", 12, 16), "IHDR");

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function assertLaunchImageSize(path) {
  const image = await stat(path);

  assert.ok(image.size <= maxLaunchImageBytes);
}
