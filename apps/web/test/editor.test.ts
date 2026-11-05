import assert from "node:assert/strict";
import { test } from "node:test";
import type { Topic } from "xmind-workbook";
import { layoutMap } from "../src/layout.ts";
import { plainToRealHtml, toMarkdown, toOpml } from "../src/markdown.ts";
import { pdfFromRgb } from "../src/pdf.ts";
import { displayFont } from "../src/structures.ts";
import { sceneToSvg } from "../src/svg.ts";
import { resolveTheme } from "../src/theme.ts";
import { addChild, addFloating, addParent, moveAttached, renameTopic, setFolded, setNotes, toggleMarker } from "../src/tree.ts";

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

function angleOf(scene: ReturnType<typeof layoutMap>, id: string): number {
  const root = scene.nodes.find((node) => node.id === "r");
  const node = scene.nodes.find((item) => item.id === id);
  assert.ok(root && node);
  return Math.atan2(node.y + node.h / 2 - (root.y + root.h / 2), node.x + node.w / 2 - (root.x + root.w / 2));
}

function signedTurn(from: number, to: number): number {
  let delta = to - from;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;
  return delta;
}

test("clockwise and anticlockwise maps place branches around the center", () => {
  const root = topic("r", "Root", [topic("a", "A"), topic("b", "B"), topic("c", "C"), topic("d", "D")]);
  const clockwise = layoutMap(root, "org.xmind.ui.map.clockwise");
  const anticlockwise = layoutMap(root, "org.xmind.ui.map.anticlockwise");
  assert.equal(clockwise.structure, "org.xmind.ui.map.clockwise");
  assert.equal(anticlockwise.structure, "org.xmind.ui.map.anticlockwise");
  const order = ["a", "b", "c", "d"];
  const turns = (scene: ReturnType<typeof layoutMap>) =>
    order.slice(1).map((id, index) => signedTurn(angleOf(scene, order[index] ?? "a"), angleOf(scene, id)));
  assert.ok(turns(clockwise).every((turn) => turn > 0.8 && turn < 2.2));
  assert.ok(turns(anticlockwise).every((turn) => turn < -0.8 && turn > -2.2));
  const rootBox = clockwise.nodes.find((node) => node.id === "r");
  assert.ok(rootBox);
  for (const id of order) {
    const node = clockwise.nodes.find((item) => item.id === id);
    assert.ok(node);
    const dx = node.x + node.w / 2 - (rootBox.x + rootBox.w / 2);
    const dy = node.y + node.h / 2 - (rootBox.y + rootBox.h / 2);
    assert.ok(Math.hypot(dx, dy) > rootBox.w / 2);
  }
});

test("theme roles color branches, elbows, and map NeverMind to Inter", () => {
  const theme = {
    map: { properties: { "svg:fill": "#ffffff", "multi-line-colors": "#F9423A #F6A04D" } },
    centralTopic: {
      properties: {
        "fo:font-family": "NeverMind",
        "svg:fill": "#000229",
        "fill-pattern": "solid",
        "fo:color": "inherited",
        "fo:font-size": "30pt",
      },
    },
    mainTopic: {
      properties: {
        "fo:font-family": "NeverMind",
        "svg:fill": "inherited",
        "fo:color": "inherited",
        "line-color": "inherited",
        "fill-pattern": "solid",
        "line-class": "org.xmind.branchConnection.roundedElbow",
      },
    },
    summaryTopic: { properties: { "svg:fill": "#000229", "fill-pattern": "none", "fo:color": "inherited" } },
  };
  const resolved = resolveTheme(theme);
  assert.equal(resolved.canvas, "#ffffff");
  assert.match(resolved.topic("central", 0).fontFamily, /Inter/);
  assert.equal(resolved.topic("central", 0).fill, "#000229");
  assert.equal(resolved.topic("central", 0).text.toLowerCase(), "#f8fafc");
  assert.equal(resolved.topic("main", 0).text.toLowerCase(), "#f9423a");
  assert.equal(resolved.topic("main", 1).text.toLowerCase(), "#f6a04d");
  assert.equal(resolved.topic("main", 0).lineClass, "roundedElbow");
  assert.equal(resolved.topic("summary", 0).fill, "transparent");
  assert.equal(resolved.topic("summary", 0).text.toLowerCase(), "#000229");
  const root = topic("r", "Root", [topic("a", "Alpha"), topic("b", "Beta")]);
  root.boundaries = [{ id: "bd", range: "master", title: "Group" }];
  const scene = layoutMap(root, "org.xmind.ui.logic.right", theme);
  assert.equal(scene.nodes.find((node) => node.id === "a")?.lineClass, "roundedElbow");
  const svg = sceneToSvg(scene, { rootTopic: root, relationships: [{ id: "rel", end1Id: "a", end2Id: "b", title: "Depends" }] }, resolved);
  assert.match(svg, /^<\?xml/);
  assert.match(svg, /<svg/);
  assert.match(svg, /Alpha/);
  assert.match(svg, /Depends/);
  assert.match(svg, /Group/);
  assert.match(svg, /Inter/);
  assert.equal(svg.includes("NeverMind"), false);
});

test("parent insert, floating position, and pdf header", async () => {
  const root = topic("r", "Root", [topic("a", "Alpha")]);
  const parentId = addParent(root, "a");
  assert.ok(parentId);
  assert.equal(root.children?.attached?.[0]?.id, parentId);
  assert.equal(root.children?.attached?.[0]?.children?.attached?.[0]?.id, "a");
  assert.equal(addParent(root, "r"), null);
  const floatingId = addFloating(root);
  const floating = root.children?.detached?.[0];
  assert.equal(floating?.id, floatingId);
  assert.equal(floating?.title, "Floating topic");
  assert.equal(typeof floating?.position?.x, "number");
  assert.equal(typeof floating?.position?.y, "number");
  floating!.children = { attached: [{ id: "c", title: "Child" }] };
  const scene = layoutMap(root, "org.xmind.ui.map.unbalanced");
  const node = scene.nodes.find((item) => item.id === floatingId);
  const child = scene.nodes.find((item) => item.id === "c");
  assert.equal(node?.kind, "floating");
  assert.ok(child && node && child.x > node.x);
  const bytes = await pdfFromRgb(2, 2, new Uint8Array(12).fill(20));
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 5)), "%PDF-");
  assert.match(new TextDecoder("latin1").decode(bytes), /\/Subtype \/Image/);
});
