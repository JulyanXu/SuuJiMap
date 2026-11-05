import { readXMind, writeXMind, type Sheet } from "xmind-workbook";

const sheet: Sheet = {
  title: "Consumer",
  rootTopic: {
    title: "Embedded",
    children: { attached: [{ title: "Child" }] },
  },
};
(sheet as Sheet & { kept?: { ok: boolean } }).kept = { ok: true };

const bytes = writeXMind({
  sheets: [sheet],
  extras: [{ name: "notes/readme.txt", data: new TextEncoder().encode("hello from consumer") }],
});

const book = readXMind(bytes);
const saved = book.sheets[0] as Sheet & { kept?: { ok: boolean } };
const note = book.extras?.find((entry) => entry.name === "notes/readme.txt");

if (saved?.rootTopic.title !== "Embedded") throw new Error("root title was not preserved");
if (saved.rootTopic.children?.attached?.[0]?.title !== "Child") throw new Error("child was not preserved");
if (saved.kept?.ok !== true) throw new Error("unknown sheet key was dropped");
if (!note || new TextDecoder().decode(note.data) !== "hello from consumer") {
  throw new Error("extra zip member was dropped");
}

console.log("consumer ok");
