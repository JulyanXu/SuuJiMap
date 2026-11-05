import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readXMindFile, writeXMindFile } from "../dist/node.js";
import { unzipSync } from "fflate/browser";

const dir = mkdtempSync(join(tmpdir(), "xmind-rt-"));
const path = join(dir, "round.xmind");

try {
  writeXMindFile(
    {
      sheets: [
        {
          title: "Round trip",
          rootTopic: {
            title: "Root",
            children: { attached: [{ title: "A" }, { title: "B" }] },
          },
        },
      ],
    },
    path,
  );

  const book = readXMindFile(path);
  if (book.sheets[0]?.title !== "Round trip") throw new Error("sheet title was not preserved");
  if (book.sheets[0]?.rootTopic.children?.attached?.[1]?.title !== "B") {
    throw new Error("topic tree was not preserved");
  }

  const bytes = new Uint8Array(readFileSync(path));
  const entries = unzipSync(bytes);
  for (const name of ["content.json", "content.xml", "metadata.json", "manifest.json"]) {
    if (!(name in entries)) throw new Error(`missing ${name}`);
  }
  const sheets = JSON.parse(new TextDecoder().decode(entries["content.json"]));
  if (!Array.isArray(sheets)) throw new Error("content.json is not a sheet array");

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let files = 0;
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    if (method !== 0) throw new Error(`expected ZIP_STORED, got method ${method}`);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const compSize = view.getUint32(offset + 18, true);
    offset += 30 + nameLen + extraLen + compSize;
    files += 1;
  }
  if (files < 4) throw new Error(`expected at least 4 zip members, saw ${files}`);

  console.log("round-trip ok");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
