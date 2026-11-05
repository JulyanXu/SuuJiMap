import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { strToU8, unzipSync, zipSync } from "fflate/browser";
import { readXMind, writeXMind } from "../dist/index.js";
import { readXMindFile, writeXMindFile } from "../dist/node.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "fixtures");
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function load(name) {
  return new Uint8Array(readFileSync(join(fixtures, name)));
}

function decode(bytes) {
  return new TextDecoder().decode(bytes);
}

function methodsOf(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const methods = [];
  let offset = 0;
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    methods.push(view.getUint16(offset + 8, true));
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const compSize = view.getUint32(offset + 18, true);
    offset += 30 + nameLen + extraLen + compSize;
  }
  return methods;
}

function packJson(value, extra = {}) {
  const files = {
    "content.json": [strToU8(JSON.stringify(value)), { level: 0 }],
    ...extra,
  };
  return zipSync(files, { level: 0 });
}

test("core build does not import Node filesystem modules", () => {
  const dist = join(here, "..", "dist");
  for (const name of readdirSync(dist)) {
    if (!name.endsWith(".js") || name === "node.js") continue;
    const text = readFileSync(join(dist, name), "utf8");
    assert.equal(/\bnode:fs\b|\bnode:path\b|\bnode:zlib\b|worker_threads/.test(text), false, name);
    assert.equal(text.includes("fflate/node"), false, name);
  }
  const nodeEntry = readFileSync(join(dist, "node.js"), "utf8");
  assert.match(nodeEntry, /node:fs/);
});

test("fresh write emits the MVP member set, STORE, and reads back", () => {
  const bytes = writeXMind({
    sheets: [
      {
        title: "Plans",
        kept: { a: 1 },
        rootTopic: {
          title: "Launch",
          kept: true,
          notes: { plain: { content: "hi" }, realHTML: { content: "<div>hi</div>" } },
          labels: ["now"],
          markers: [{ markerId: "priority-1" }],
          children: {
            attached: [{ title: "Design" }, { title: "Ship", labels: "solo", markers: ["star-blue"] }],
          },
        },
      },
    ],
    extras: [{ name: "resources/pic.bin", data: new Uint8Array([9, 8, 7]) }],
  });

  assert.deepEqual(methodsOf(bytes), [0, 0, 0, 0, 0]);
  const entries = unzipSync(bytes);
  assert.deepEqual(Object.keys(entries).sort(), [
    "content.json",
    "content.xml",
    "manifest.json",
    "metadata.json",
    "resources/pic.bin",
  ]);
  assert.deepEqual(entries["content.xml"], load("content-stub.xml"));

  const writtenSheets = JSON.parse(decode(entries["content.json"]));
  assert.equal(Array.isArray(writtenSheets), true);
  assert.equal(writtenSheets[0].class, "sheet");
  assert.equal(writtenSheets[0].rootTopic.class, "topic");
  assert.equal(writtenSheets[0].rootTopic.structureClass, "org.xmind.ui.map.unbalanced");
  const freshTheme = writtenSheets[0].theme;
  assert.match(freshTheme.centralTopic.properties["fo:font-family"], /Inter/);
  assert.match(freshTheme.centralTopic.properties["fo:font-family"], /Noto Sans SC/);
  assert.equal(JSON.stringify(freshTheme).includes("NeverMind"), false);
  assert.equal(freshTheme.centralTopic.properties["shape-class"], "org.xmind.topicShape.roundedRect");
  assert.equal(freshTheme.map.properties["svg:fill"], "#f7f4ee");
  assert.equal(freshTheme.skeletonThemeId, undefined);
  assert.match(writtenSheets[0].id, uuidV4);
  assert.match(writtenSheets[0].rootTopic.id, uuidV4);
  assert.equal(writtenSheets[0].rootTopic.children.attached[0].class, undefined);
  assert.deepEqual(JSON.parse(decode(entries["manifest.json"])), {
    "file-entries": { "content.json": {}, "metadata.json": {} },
  });
  assert.deepEqual(JSON.parse(decode(entries["metadata.json"])), {
    dataStructureVersion: "2",
    creator: { name: "xmind-workbook", version: "0.1.0" },
    layoutEngineVersion: "3",
  });

  const book = readXMind(bytes);
  const root = book.sheets[0].rootTopic;
  assert.equal(book.sheets[0].title, "Plans");
  assert.deepEqual(book.sheets[0].kept, { a: 1 });
  assert.equal(root.title, "Launch");
  assert.equal(root.kept, true);
  assert.equal(root.notes.plain.content, "hi");
  assert.equal(root.notes.realHTML.content, "<div>hi</div>");
  assert.deepEqual(root.labels, ["now"]);
  assert.deepEqual(root.markers, [{ markerId: "priority-1" }]);
  assert.deepEqual(
    root.children.attached.map((topic) => topic.title),
    ["Design", "Ship"],
  );
  assert.deepEqual(root.children.attached[1].labels, ["solo"]);
  assert.deepEqual(root.children.attached[1].markers, [{ markerId: "star-blue" }]);
  assert.deepEqual(book.extras.find((entry) => entry.name === "resources/pic.bin").data, new Uint8Array([9, 8, 7]));

  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  assert.equal(readXMind(arrayBuffer).sheets[0].title, "Plans");
  const padded = new Uint8Array(bytes.length + 8);
  padded.set(bytes, 4);
  assert.equal(readXMind(padded.subarray(4, 4 + bytes.length)).sheets[0].rootTopic.title, "Launch");
});

test("readXMindFile and writeXMindFile round-trip a path", () => {
  const dir = mkdtempSync(join(tmpdir(), "xmind-file-"));
  const path = join(dir, "nested", "map.xmind");
  try {
    writeXMindFile(
      { sheets: [{ title: "File", rootTopic: { title: "Root", children: { attached: [{ title: "Leaf" }] } } }] },
      path,
    );
    const book = readXMindFile(path);
    assert.equal(book.sheets[0].title, "File");
    assert.equal(book.sheets[0].rootTopic.children.attached[0].title, "Leaf");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mab-example sheet title, topic tree, and extra members survive rewrite", () => {
  const original = load("mab-example.xmind");
  const book = readXMind(original);
  assert.equal(book.source, "content.json");
  assert.equal(book.sheets.length, 1);
  const sheet = book.sheets[0];
  assert.equal(sheet.title, "xmind-mcp");
  assert.equal(sheet.id, "14e74e13-0fd0-47ea-a4ba-fb8736ea1253");
  assert.equal(sheet.revisionId, "a3af3f51-69de-4286-9451-cd4aaf73b58f");
  const root = sheet.rootTopic;
  assert.equal(root.title, "xmind-mcp");
  assert.equal(root.structureClass, "org.xmind.ui.map.unbalanced");
  assert.match(root.notes.plain.content, /^An MCP server/);
  assert.match(root.notes.realHTML.content, /<div>An MCP server/);
  const attached = root.children.attached;
  assert.deepEqual(
    attached.map((topic) => topic.title),
    ["🛠️ 27 Tools", "⚙️ Design", "📄 XMind Features", "📋 Project"],
  );
  const tools = attached[0];
  assert.equal(tools.children.attached[0].title, "Tier 1 — File & Sheet Mgmt");
  assert.equal(tools.children.attached[0].children.attached[0].title, "open_map");
  assert.equal(tools.children.attached[0].children.attached[0].markers[0].markerId, "priority-1");
  assert.equal(tools.children.summary[0].title, "Find → Then Act");
  assert.equal(tools.summaries[0].range, "(0,3)");
  assert.equal(tools.summaries[0].topicId, "93b55c85-fc00-486d-9c74-04d369077fc1");
  const design = attached[1];
  assert.equal(design.boundaries[0].range, "master");
  assert.equal(design.boundaries[0].title, "Zero Data Loss");
  const source = attached[3].children.attached[0];
  assert.equal(source.title, "github.com/mab-go/xmind-mcp");
  assert.deepEqual(source.labels, ["source"]);
  assert.equal(source.href, "https://github.com/mab-go/xmind-mcp");
  assert.equal(sheet.relationships[0].title, "Depends On");
  assert.equal(sheet.extensions[0].provider, "org.xmind.ui.skeleton.structure.style");
  assert.equal(sheet.theme.skeletonThemeId, "db4a5df4db39a8cd1310ea55ea");
  assert.equal(book.metadata.creator.name, "Vana");
  assert.equal(book.metadata.dataStructureVersion, "2");
  assert.equal(book.metadata.layoutEngineVersion, "3");

  const png = book.extras.find((entry) => entry.name === "Thumbnails/thumbnail.png");
  assert.equal(png.data.length, 375074);
  sheet.xCustom = { keep: true };
  root.xCustom = "yes";

  const again = readXMind(writeXMind(book));
  assert.equal(again.sheets[0].title, "xmind-mcp");
  assert.deepEqual(
    again.sheets[0].rootTopic.children.attached.map((topic) => topic.title),
    ["🛠️ 27 Tools", "⚙️ Design", "📄 XMind Features", "📋 Project"],
  );
  assert.deepEqual(again.sheets[0].xCustom, { keep: true });
  assert.equal(again.sheets[0].rootTopic.xCustom, "yes");
  assert.equal(again.sheets[0].revisionId, sheet.revisionId);
  assert.equal(again.sheets[0].theme.centralTopic.properties["fo:font-family"], "NeverMind");
  assert.equal(again.sheets[0].theme.skeletonThemeId, "db4a5df4db39a8cd1310ea55ea");
  assert.equal(again.sheets[0].theme.colorThemeId, "Rainbow-#000229-MULTI_LINE_COLORS");
  assert.equal(again.metadata.creator.name, "Vana");
  assert.ok(again.manifest["file-entries"]["Thumbnails/thumbnail.png"]);
  const pngAgain = again.extras.find((entry) => entry.name === "Thumbnails/thumbnail.png");
  assert.deepEqual(pngAgain.data, png.data);
  assert.ok(again.extras.some((entry) => entry.name === "Thumbnails/"));
  const written = unzipSync(writeXMind(book));
  assert.deepEqual(written["content.xml"], load("content-stub.xml"));
});

test("sdk workbook sheet title, notes, and markers", () => {
  const book = readXMind(load("sdk.xmind"));
  assert.equal(book.source, "content.json");
  assert.equal(book.metadata && Object.keys(book.metadata).length, 0);
  const sheet = book.sheets[0];
  assert.equal(sheet.class, undefined);
  assert.equal(sheet.title, "sheet title");
  assert.equal(sheet.id, "1a63d646-cf67-4ca4-80b0-311d41c0b3ce");
  assert.equal(sheet.topicPositioning, "fixed");
  const root = sheet.rootTopic;
  assert.equal(root.title, "Central Topic");
  assert.equal(root.id, "9240b4c0-aec7-4f44-8aa8-69b61c8c39ae");
  assert.equal(root.structureClass, undefined);
  assert.deepEqual(root.style.properties, {});
  const main = root.children.attached[0];
  assert.equal(main.title, "main topic 1");
  assert.deepEqual(
    main.children.attached.map((topic) => topic.title),
    ["subtopic 1", "subtopic 2"],
  );
  assert.equal(main.notes.plain.content, "This is a note");
  assert.equal(main.notes.html.content.paragraphs[0].spans[0].text, "This is a note");
  assert.equal(main.notes.ops.ops[0].insert, "This is a note");
  assert.deepEqual(main.children.attached[0].markers[0], {
    groupId: "priorityMarkers",
    markerId: "priority-1",
  });

  const again = readXMind(writeXMind(book));
  const againMain = again.sheets[0].rootTopic.children.attached[0];
  assert.equal(again.sheets[0].class, "sheet");
  assert.equal(again.sheets[0].topicPositioning, "fixed");
  assert.equal(again.sheets[0].rootTopic.structureClass, "org.xmind.ui.map.unbalanced");
  assert.match(again.sheets[0].theme.centralTopic.properties["fo:font-family"], /Inter/);
  assert.equal(JSON.stringify(again.sheets[0].theme).includes("NeverMind"), false);
  assert.equal(againMain.children.attached[0].structureClass, undefined);
  assert.equal(againMain.notes.plain.content, "This is a note");
  assert.ok(againMain.notes.html);
  assert.ok(againMain.notes.ops);
  assert.equal(againMain.children.attached[0].markers[0].groupId, "priorityMarkers");
  assert.deepEqual(again.metadata, {});
});

test("legacy content.xml fallback, then modern rewrite keeps extra members", () => {
  const book = readXMind(load("zhuifeng-demo.xmind"));
  assert.equal(book.source, "content.xml");
  assert.equal(book.sheets.length, 2);
  assert.equal(book.sheets[0].title, "first sheet");
  assert.equal(book.sheets[0].id, "2cc3b068922063a81a20029655");
  const root = book.sheets[0].rootTopic;
  assert.equal(root.title, "root node");
  assert.deepEqual(root.markers, [{ markerId: "star-red" }]);
  assert.deepEqual(
    root.children.attached.map((topic) => topic.title),
    ["first sub topic", "second sub topic", "third sub topic", "fourth sub topic"],
  );
  assert.equal(root.children.attached[0].children.attached[0].title, "I'm a sub topic too");
  const detached = root.children.detached[0];
  assert.equal(detached.title, "detached topic");
  assert.deepEqual(detached.position, { x: 0, y: 30 });

  const second = book.sheets[1];
  assert.equal(second.title, "second sheet");
  const branches = second.rootTopic.children.attached;
  assert.equal(branches[0].href, "xmind:#2cc3b068922063a81a20029655");
  assert.deepEqual(branches[0].children.attached[0].labels, ["a label"]);
  assert.deepEqual(
    branches[0].children.attached[0].children.attached[0].markers.map((marker) => marker.markerId),
    ["star-blue", "flag-green"],
  );
  assert.equal(branches[1].href, "https://xmind.net");
  assert.equal(branches[2].notes.plain.content, "notes for this topic");
  assert.equal(branches[3].href.startsWith("file:"), true);
  assert.equal(second.relationships[0].title, "relationship test");
  assert.equal(second.relationships[0].end1Id, "b0ed74214dbca8bfdc2b60df47");
  assert.equal(second.relationships[0].end2Id, "e613d79938591ef98b64a768db");

  const again = readXMind(writeXMind(book));
  assert.equal(again.source, "content.json");
  assert.equal(again.sheets[0].title, "first sheet");
  assert.equal(again.sheets[1].title, "second sheet");
  assert.equal(again.sheets[0].rootTopic.children.detached[0].title, "detached topic");
  assert.deepEqual(
    again.extras.map((entry) => entry.name).sort(),
    ["comments.xml", "styles.xml"],
  );
  const written = unzipSync(writeXMind(book));
  assert.deepEqual(written["content.xml"], load("content-stub.xml"));
  assert.equal(decode(written["content.json"]).includes("first sub topic"), true);
  assert.equal(decode(written["content.xml"]).includes("first sub topic"), false);
});

test("content.json wins over legacy xml, and defensive shapes are accepted", () => {
  const legacyXml = unzipSync(load("zhuifeng-demo.xmind"))["content.xml"];
  const hybrid = zipSync(
    {
      "content.json": [
        strToU8(JSON.stringify([{ id: "s", title: "From JSON", rootTopic: { id: "r", title: "JSON root" } }])),
        { level: 0 },
      ],
      "content.xml": [legacyXml, { level: 0 }],
    },
    { level: 0 },
  );
  const hybridBook = readXMind(hybrid);
  assert.equal(hybridBook.source, "content.json");
  assert.equal(hybridBook.sheets[0].title, "From JSON");
  assert.equal(hybridBook.sheets[0].rootTopic.title, "JSON root");

  const sheet = { id: "s", title: "Only", rootTopic: { id: "r", title: "Center", labels: "one" } };
  assert.equal(readXMind(packJson(sheet)).sheets[0].title, "Only");
  assert.deepEqual(readXMind(packJson(sheet)).sheets[0].rootTopic.labels, ["one"]);
  assert.equal(readXMind(packJson({ sheets: [sheet] })).sheets[0].rootTopic.title, "Center");

  const deflated = zipSync({
    "content.json": [strToU8(JSON.stringify([{ title: "Deflated", rootTopic: { title: "Root" } }])), { level: 6 }],
  });
  assert.equal(readXMind(deflated).sheets[0].title, "Deflated");
  assert.equal(readXMind(deflated).sheets[0].rootTopic.title, "Root");
});

test("rejects empty workbooks and archives without a map", () => {
  assert.throws(() => writeXMind({ sheets: [] }), /non-empty/);
  assert.throws(() => readXMind(new Uint8Array([1, 2, 3, 4])), /not a zip archive/);
  const empty = zipSync({ "readme.txt": [strToU8("nope"), { level: 0 }] }, { level: 0 });
  assert.throws(() => readXMind(empty), /content\.json/);
});
