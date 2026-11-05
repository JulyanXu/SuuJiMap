import assert from "node:assert/strict";
import { test } from "node:test";
import type { Topic } from "xmind-workbook";
import { layoutMap } from "../src/layout.ts";
import { plainToRealHtml, toMarkdown, toOpml } from "../src/markdown.ts";
import { displayFont } from "../src/structures.ts";
import { addChild, moveAttached, renameTopic, setFolded, setNotes, toggleMarker } from "../src/tree.ts";

function topic(id: string, title: string, children: Topic[] = []): Topic {
  return { id, title, children: { attached: children } };
}

test("structureClass changes which side branches sit on", () => {
  const root = topic("r", "Root", [topic("a", "A"), topic("b", "B"), topic("c", "C"), topic("d", "D")]);
  const balanced = layoutMap(root, "org.xmind.ui.map");
  const unbalanced = layoutMap(root, "org.xmind.ui.map.unbalanced");
  const right = layoutMap(root, "org.xmind.ui.logic.right");
  const left = layoutMap(root, "org.xmind.ui.logic.left");
  const down = layoutMap(root, "org.xmind.ui.org-chart.down");
  const up = layoutMap(root, "org.xmind.ui.org-chart.up");
  const treeRight = layoutMap(root, "org.xmind.ui.tree.right");
  const treeLeft = layoutMap(root, "org.xmind.ui.tree.left");

  const sides = (scene: ReturnType<typeof layoutMap>) =>
    scene.nodes.filter((node) => node.parentId === "r").map((node) => node.side);

  assert.deepEqual(sides(balanced).sort(), ["left", "left", "right", "right"]);
  assert.deepEqual(sides(unbalanced).sort(), ["left", "right", "right", "right"]);
  assert.deepEqual(sides(right), ["right", "right", "right", "right"]);
  assert.deepEqual(sides(left), ["left", "left", "left", "left"]);
  assert.ok(sides(down).every((side) => side === "down"));
  assert.ok(sides(up).every((side) => side === "up"));
  assert.equal(treeRight.structure, "org.xmind.ui.tree.right");
  assert.ok(treeRight.nodes.filter((node) => node.parentId === "r").every((node) => node.x > (treeRight.nodes.find((item) => item.id === "r")?.x ?? 0)));
  assert.equal(treeLeft.structure, "org.xmind.ui.tree.left");
  const rootBox = down.nodes.find((node) => node.id === "r");
  const child = down.nodes.find((node) => node.id === "a");
  assert.ok(rootBox && child && child.y > rootBox.y);
  const upRoot = up.nodes.find((node) => node.id === "r");
  const upChild = up.nodes.find((node) => node.id === "a");
  assert.ok(upRoot && upChild && upChild.y < upRoot.y);
});

test("folded branches stay out of the layout and the flag round-trips", () => {
  const root = topic("r", "Root", [topic("a", "A", [topic("a1", "A1")])]);
  const child = root.children?.attached?.[0];
  assert.ok(child);
  setFolded(child, true);
  assert.equal(child.branch, "folded");
  const scene = layoutMap(root, "org.xmind.ui.logic.right");
  assert.equal(scene.nodes.some((node) => node.id === "a1"), false);
  assert.equal(scene.nodes.find((node) => node.id === "a")?.folded, true);
  setFolded(child, false);
  assert.equal(child.branch, undefined);
  assert.equal(layoutMap(root).nodes.some((node) => node.id === "a1"), true);
  child.branch = "custom-state";
  setFolded(child, false);
  assert.equal(child.branch, "custom-state");
});

test("markers, notes, markdown, and reparent keep the cited shapes", () => {
  const root = topic("r", "Root", [topic("a", "Alpha"), topic("b", "Beta")]);
  const alpha = root.children!.attached![0]!;
  toggleMarker(alpha, "priority-1");
  toggleMarker(alpha, "priority-1");
  toggleMarker(alpha, "star-blue");
  assert.deepEqual(alpha.markers, [{ markerId: "star-blue" }]);
  setNotes(alpha, "Hello\nthere", plainToRealHtml("Hello\nthere"));
  assert.equal(alpha.notes?.plain?.content, "Hello\nthere");
  assert.equal(alpha.notes?.realHTML?.content, "<div>Hello<br>there</div>");
  assert.equal(plainToRealHtml("<b>"), "<div>&lt;b&gt;</div>");
  const markdown = toMarkdown(root);
  assert.match(markdown, /^# Root/);
  assert.match(markdown, /^- Alpha/m);
  assert.match(toOpml(root), /<outline text="Alpha">/);
  assert.equal(displayFont("NeverMind"), '"Inter", "Noto Sans SC", sans-serif');
  assert.match(displayFont("Inter"), /^Inter,/);
  assert.equal(moveAttached(root, "b", "a", 0), true);
  assert.equal(root.children?.attached?.map((item) => item.id).join(), "a");
  assert.equal(alpha.children?.attached?.[0]?.id, "b");
  renameTopic(root, "b", "Beta 2");
  assert.equal(alpha.children?.attached?.[0]?.title, "Beta 2");
  const added = addChild(root, "r");
  assert.ok(added);
});
