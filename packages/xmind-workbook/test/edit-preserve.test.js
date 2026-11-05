import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate/browser";
import { readXMind, writeXMind } from "../dist/index.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("edit then save keeps the rest of the mab workbook intact", () => {
  const original = readXMind(new Uint8Array(readFileSync(join(fixtures, "mab-example.xmind"))));
  const snapshot = JSON.parse(JSON.stringify(original.sheets));
  const extras = original.extras.map((entry) => ({ name: entry.name, data: new Uint8Array(entry.data) }));
  const metadata = JSON.parse(JSON.stringify(original.metadata));
  const manifest = JSON.parse(JSON.stringify(original.manifest));

  const root = original.sheets[0].rootTopic;
  const first = root.children.attached[0];
  const previousTitle = first.title;
  first.title = `${previousTitle} edited`;
  root.children.attached.push({ id: "added-child", title: "Added child" });

  const written = writeXMind(original);
  const entries = unzipSync(written);
  assert.deepEqual(Object.keys(entries).sort(), [
    "Thumbnails/",
    "Thumbnails/thumbnail.png",
    "content.json",
    "content.xml",
    "manifest.json",
    "metadata.json",
  ]);
  assert.deepEqual(entries["content.xml"], new Uint8Array(readFileSync(join(fixtures, "content-stub.xml"))));

  const again = readXMind(written);
  const attached = again.sheets[0].rootTopic.children.attached;
  assert.equal(attached[0].title, `${previousTitle} edited`);
  assert.equal(attached.at(-1).id, "added-child");
  assert.equal(attached.at(-1).title, "Added child");
  assert.equal(attached[0].children.attached[0].title, "Tier 1 — File & Sheet Mgmt");

  attached[0].title = previousTitle;
  attached.pop();
  assert.deepEqual(again.sheets, snapshot);
  assert.deepEqual(again.metadata, metadata);
  assert.deepEqual(again.manifest, manifest);
  assert.deepEqual(
    again.extras.map((entry) => entry.name),
    extras.map((entry) => entry.name),
  );
  for (const entry of extras) {
    const match = again.extras.find((candidate) => candidate.name === entry.name);
    assert.deepEqual(match.data, entry.data);
  }
});
