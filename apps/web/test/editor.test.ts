import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSheetTheme, type Topic } from "xmind-workbook";
import { fittedSize, sniffImageMime } from "../src/images.ts";
import { layoutMap, relationshipCurve } from "../src/layout.ts";
import { isKnownMarker, markerLabel } from "../src/marker-catalog.ts";
import { plainToRealHtml, toMarkdown, toOpml } from "../src/markdown.ts";
import { pdfFromRgb } from "../src/pdf.ts";
import { displayFont } from "../src/structures.ts";
import { sceneToSvg } from "../src/svg.ts";
import { activeQuickRole, chipFill, quickRoleProperties, quickStyleKeys, resolveTheme } from "../src/theme.ts";
import { addChild, addFloating, addMasterBoundary, addParent, addSummary, moveAttached, renameTopic, setFolded, setNotes, setQuickStyle, setTopicImage, toggleMarker } from "../src/tree.ts";

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

test("labels are drawn on the topic, and only master or (i,j) ranges become boxes", () => {
  const plain = topic("r", "Root", [topic("a", "Alpha"), topic("b", "Beta")]);
  const labeled = topic("r", "Root", [topic("a", "Alpha"), topic("b", "Beta")]);
  labeled.children!.attached![0]!.labels = [" source ", ""];
  const withLabels = layoutMap(labeled, "org.xmind.ui.logic.right");
  const without = layoutMap(plain, "org.xmind.ui.logic.right");
  const alpha = withLabels.nodes.find((node) => node.id === "a");
  const plainAlpha = without.nodes.find((node) => node.id === "a");
  assert.ok(alpha && plainAlpha);
  assert.deepEqual(alpha.labels, ["source"]);
  assert.ok(alpha.h > plainAlpha.h);
  const svg = sceneToSvg(withLabels, { rootTopic: labeled }, resolveTheme(undefined));
  assert.match(svg, /source/);

  labeled.boundaries = [
    { id: "custom", range: "custom", title: "Nope" },
    { id: "span", range: "(0,0)", title: "First" },
    { id: "all", range: "master", title: "Group" },
  ];
  const scene = layoutMap(labeled, "org.xmind.ui.logic.right");
  assert.deepEqual(
    scene.boundaries.map((item) => item.title),
    ["First", "Group"],
  );
  assert.equal(labeled.boundaries[0]?.range, "custom");
  const root = topic("r", "Root", [topic("a", "Alpha"), topic("b", "Beta")]);
  addMasterBoundary(root);
  addSummary(root);
  assert.equal(root.boundaries?.[0]?.range, "master");
  assert.equal(root.summaries?.[0]?.range, "(0,1)");
});

test("boundary solid fill is the region and inherited text is not the svg fill", () => {
  const solid = resolveTheme({
    boundary: {
      properties: {
        "fill-pattern": "solid",
        "svg:fill": "#000229",
        "fo:color": "inherited",
        "line-color": "#000229",
        "line-width": "2",
        "line-pattern": "dash",
      },
    },
  }).boundary();
  assert.equal(solid.fill.toLowerCase(), "#000229");
  assert.equal(solid.text.toLowerCase(), "#f8fafc");
  const masked = resolveTheme({
    boundary: {
      properties: {
        "fill-pattern": "none",
        "svg:fill": "#000229",
        "fo:color": "inherited",
        "line-color": "#8a8175",
      },
    },
  }).boundary();
  assert.equal(masked.fill, "none");
  assert.equal(masked.text.toLowerCase(), "#8a8175");
  const root = topic("r", "Root", [topic("a", "Alpha")]);
  root.boundaries = [{ id: "bd", range: "master", title: "Group" }];
  const theme = {
    boundary: {
      properties: {
        "fill-pattern": "solid",
        "svg:fill": "#000229",
        "fo:color": "inherited",
        "line-color": "#000229",
      },
    },
  };
  const svg = sceneToSvg(layoutMap(root, "org.xmind.ui.logic.right", theme), { rootTopic: root }, resolveTheme(theme));
  assert.match(svg, /fill="#000229"/);
  assert.match(svg, /fill="#f8fafc"/);
  const resolved = resolveTheme(theme);
  assert.equal(chipFill(resolved.topic("main", 0).fill, resolved.canvas), resolved.canvas);
});

test("color-list is ignored and branch color stays on multi-line-colors", () => {
  const resolved = resolveTheme({
    map: { properties: { "multi-line-colors": "#F9423A #F6A04D", "color-list": "#00ff00 #0000ff" } },
    mainTopic: { properties: { "svg:fill": "inherited", "fo:color": "inherited", "fill-pattern": "solid" } },
  });
  assert.equal(resolved.topic("main", 0).text.toLowerCase(), "#f9423a");
  assert.equal(resolved.topic("main", 1).text.toLowerCase(), "#f6a04d");
  assert.notEqual(resolved.topic("main", 0).text.toLowerCase(), "#00ff00");
});

test("quick style copies a theme role and leaves other style keys", () => {
  const theme = defaultSheetTheme();
  const node: Topic = { id: "a", title: "A", style: { id: "keep", properties: { "fo:font-size": "20pt" } } };
  const important = quickRoleProperties(theme, "importantTopic");
  setQuickStyle(node, important, quickStyleKeys(theme));
  assert.equal(node.style?.id, "keep");
  assert.equal(node.style?.properties?.["fo:font-size"], "20pt");
  assert.equal(node.style?.properties?.["svg:fill"], important["svg:fill"]);
  assert.equal(activeQuickRole(theme, node.style?.properties), "importantTopic");
  assert.equal(resolveTheme(theme).topic("main", 0, node.style?.properties).fill, important["svg:fill"]);
  setQuickStyle(node, quickRoleProperties(theme, "expiredTopic"), quickStyleKeys(theme));
  assert.equal(node.style?.properties?.["svg:fill"], undefined);
  assert.equal(activeQuickRole(theme, node.style?.properties), "expiredTopic");
  const expired = resolveTheme(theme).topic("main", 0, node.style?.properties);
  assert.equal(expired.decoration, "line-through");
  assert.equal(expired.fill, "transparent");
  setQuickStyle(node, null, quickStyleKeys(theme));
  assert.equal(node.style?.properties?.["fo:font-size"], "20pt");
  assert.equal(activeQuickRole(theme, node.style?.properties), null);
});

test("marker catalog covers the open set and leaves unknown ids unlabeled", () => {
  assert.equal(markerLabel("priority-1"), "Priority 1");
  assert.equal(markerLabel("task-done"), "Task done");
  assert.equal(markerLabel("flag-dark-blue"), "Flag dark blue");
  assert.equal(markerLabel("c_symbol_pen"), "Pen");
  assert.equal(isKnownMarker("priority-9"), true);
  assert.equal(isKnownMarker("c_symbol_pen"), true);
  assert.equal(isKnownMarker("symbol-lightning"), false);
  assert.equal(isKnownMarker("tag-blue"), false);
  assert.equal(markerLabel("tag-blue"), "tag-blue");
});

test("relationship curve stays a midpoint quadratic", () => {
  const root = topic("r", "Root", [topic("a", "Alpha"), topic("b", "Beta")]);
  const scene = layoutMap(root, "org.xmind.ui.logic.right");
  const from = scene.nodes.find((node) => node.id === "a");
  const to = scene.nodes.find((node) => node.id === "b");
  assert.ok(from && to);
  const curve = relationshipCurve(from, to, "Depends", "rel");
  assert.match(curve.d, /\bQ\b/);
  assert.equal(curve.title, "Depends");
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

test("topic image grows the chip and is embedded in svg", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(sniffImageMime(png), "image/png");
  assert.equal(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  const webp = new Uint8Array(12);
  webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(sniffImageMime(webp), "image/webp");
  assert.equal(sniffImageMime(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>")), "image/svg+xml");
  assert.equal(sniffImageMime(new TextEncoder().encode("<?xml version='1.0'?><svg></svg>")), "image/svg+xml");
  assert.equal(sniffImageMime(new TextEncoder().encode("not an image")), null);
  assert.deepEqual(fittedSize(1, 1), { width: 64, height: 64 });
  assert.deepEqual(fittedSize(800, 400), { width: 160, height: 80 });

  const plain = topic("r", "Root", [topic("a", "Alpha")]);
  const imaged = topic("r", "Root", [topic("a", "Alpha")]);
  const alpha = imaged.children!.attached![0]!;
  setTopicImage(alpha, { src: "xap:resources/abc", width: 64, height: 40, align: "bottom" });
  assert.equal(alpha.image?.align, "bottom");
  setTopicImage(alpha, null);
  assert.equal(alpha.image, undefined);
  setTopicImage(alpha, { src: "xap:resources/abc", width: 64, height: 40, align: "bottom" });
  const before = layoutMap(plain, "org.xmind.ui.logic.right");
  const after = layoutMap(imaged, "org.xmind.ui.logic.right");
  const plainNode = before.nodes.find((node) => node.id === "a");
  const imageNode = after.nodes.find((node) => node.id === "a");
  assert.ok(plainNode && imageNode);
  assert.equal(imageNode.imageW, 64);
  assert.equal(imageNode.imageH, 40);
  assert.ok(imageNode.h > plainNode.h);
  assert.equal(plainNode.imageH, 0);
  const svg = sceneToSvg(after, { rootTopic: imaged }, resolveTheme(undefined), new Map([["a", "data:image/png;base64,aaaa"]]));
  assert.match(svg, /<image href="data:image\/png;base64,aaaa"/);
  assert.match(svg, /width="64"/);
  assert.match(svg, /height="40"/);
  const bare = sceneToSvg(after, { rootTopic: imaged }, resolveTheme(undefined));
  assert.equal(bare.includes("<image"), false);

  const srcOnly = topic("r", "Root", [topic("b", "Beta")]);
  srcOnly.children!.attached![0]!.image = { src: "xap:resources/only" };
  assert.equal(layoutMap(srcOnly).nodes.find((node) => node.id === "b")?.imageW, 64);
  const external = topic("r", "Root", [topic("c", "Gamma")]);
  external.children!.attached![0]!.image = { src: "https://example.com/a.png", width: 80, height: 80 };
  assert.equal(layoutMap(external).nodes.find((node) => node.id === "c")?.imageH, 0);
});
