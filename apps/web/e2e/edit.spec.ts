import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { readXMind } from "xmind-workbook";

const fixture = fileURLToPath(
  new URL("../../../packages/xmind-workbook/test/fixtures/mab-example.xmind", import.meta.url),
);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("open-file").setInputFiles(fixture);
  await expect(page.getByRole("button", { name: "xmind-mcp", exact: true })).toBeVisible();
});

test("rename, add a child, and save", async ({ page }) => {
  await page.getByRole("button", { name: "MIT License", exact: true }).click();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Rename MIT License" });
  await editor.fill("MIT Licence edited");
  await editor.press("Enter");
  await expect(page.getByRole("button", { name: "MIT Licence edited", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "MIT Licence edited", exact: true }).click();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "New topic", exact: true })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save", exact: true }).click(),
  ]);
  const savedPath = await download.path();
  expect(savedPath).toBeTruthy();
  const book = readXMind(readFileSync(savedPath!));
  const project = book.sheets[0]?.rootTopic.children?.attached?.find((topic) => topic.title === "📋 Project");
  const renamed = project?.children?.attached?.find((topic) => topic.title === "MIT Licence edited");
  expect(renamed?.children?.attached?.some((topic) => topic.title === "New topic")).toBe(true);
  expect(project?.children?.attached?.some((topic) => topic.title === "Go 1.26.1+")).toBe(true);
  expect(book.extras?.find((entry) => entry.name === "Thumbnails/thumbnail.png")?.data.length).toBe(375074);
  expect(book.sheets[0]?.rootTopic.title).toBe("xmind-mcp");
});

test("fold a branch, switch structure, and round-trip a marker", async ({ page }) => {
  await page.getByRole("button", { name: "Collapse 🛠️ 27 Tools" }).click();
  await expect(page.getByRole("button", { name: "Tier 1 — File & Sheet Mgmt", exact: true })).toHaveCount(0);

  await page.getByTestId("structure").selectOption("org.xmind.ui.logic.right");
  await expect(page.getByTestId("map")).toHaveAttribute("data-structure", "org.xmind.ui.logic.right");

  await page.getByRole("button", { name: "MIT License", exact: true }).click();
  await page.getByRole("button", { name: "Priority 1", exact: true }).click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save", exact: true }).click(),
  ]);
  const book = readXMind(readFileSync((await download.path())!));
  const tools = book.sheets[0]?.rootTopic.children?.attached?.find((topic) => topic.title === "🛠️ 27 Tools");
  expect(tools?.branch).toBe("folded");
  expect(book.sheets[0]?.rootTopic.structureClass).toBe("org.xmind.ui.logic.right");
  const project = book.sheets[0]?.rootTopic.children?.attached?.find((topic) => topic.title === "📋 Project");
  const license = project?.children?.attached?.find((topic) => topic.title === "MIT License");
  expect(license?.markers?.some((marker) => marker.markerId === "priority-1")).toBe(true);
  expect(book.extras?.find((entry) => entry.name === "Thumbnails/thumbnail.png")?.data.length).toBe(375074);
});

test("outliner rename and markdown export", async ({ page }) => {
  await page.getByRole("button", { name: "Outliner" }).click();
  const row = page.getByTestId("outliner").getByRole("button", { name: "MIT License", exact: true });
  await row.click();
  await row.click();
  const editor = page.getByRole("textbox", { name: "Rename MIT License" });
  await editor.fill("Outlined license");
  await editor.press("Enter");
  await expect(page.getByRole("button", { name: "Outlined license", exact: true })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Markdown", exact: true }).click(),
  ]);
  const text = readFileSync((await download.path())!, "utf8");
  expect(text.startsWith("# xmind-mcp")).toBe(true);
  expect(text).toContain("Outlined license");
  expect(text).toContain("27 Tools");
});

test("png export is a real image", async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "PNG", exact: true }).click(),
  ]);
  const bytes = readFileSync((await download.path())!);
  expect(bytes.subarray(0, 4).toString("hex")).toBe("89504e47");
});

test("theme colors, svg and pdf export, and clockwise structure", async ({ page }) => {
  const central = page.getByRole("button", { name: "xmind-mcp", exact: true });
  await expect(central).toHaveCSS("background-color", "rgb(0, 2, 41)");
  await expect(central).toHaveCSS("font-family", /Inter/);
  await expect(page.getByRole("button", { name: "🛠️ 27 Tools", exact: true })).toHaveCSS("color", "rgb(249, 66, 58)");

  const [svgDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "SVG", exact: true }).click(),
  ]);
  const svg = readFileSync((await svgDownload.path())!, "utf8");
  expect(svg).toContain("<svg");
  expect(svg).toContain("xmind-mcp");
  expect(svg).not.toContain("NeverMind");

  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "PDF", exact: true }).click(),
  ]);
  const pdf = readFileSync((await pdfDownload.path())!);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

  await page.getByTestId("structure").selectOption("org.xmind.ui.map.clockwise");
  await expect(page.getByTestId("map")).toHaveAttribute("data-structure", "org.xmind.ui.map.clockwise");
  await expect(page.locator('[data-testid="map"] svg rect[data-kind="boundary"]').first()).toHaveAttribute("fill", "#000229");
});

test("labels show on the topic, quick style applies, and a flag marker round-trips", async ({ page }) => {
  const source = page.locator("[data-topic]").filter({ hasText: "github.com/mab-go/xmind-mcp" });
  await expect(source).toContainText("source");

  await page.getByRole("button", { name: "MIT License", exact: true }).click();
  await page.getByRole("button", { name: "Important", exact: true }).click();
  await expect(page.getByRole("button", { name: "MIT License", exact: true })).toHaveCSS("background-color", "rgb(70, 4, 0)");
  await page.getByRole("button", { name: "Flag red", exact: true }).click();
  await expect(page.locator('[data-marker-id="flag-red"]').first()).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save", exact: true }).click(),
  ]);
  const book = readXMind(readFileSync((await download.path())!));
  const project = book.sheets[0]?.rootTopic.children?.attached?.find((topic) => topic.title === "📋 Project");
  const license = project?.children?.attached?.find((topic) => topic.title === "MIT License");
  expect(license?.style?.properties?.["svg:fill"]?.toLowerCase()).toBe("#460400");
  expect(license?.style?.properties?.["fill-pattern"]).toBe("solid");
  expect(license?.markers?.some((marker) => marker.markerId === "flag-red")).toBe(true);
  const linked = project?.children?.attached?.find((topic) => topic.title === "github.com/mab-go/xmind-mcp");
  expect(linked?.labels).toEqual(["source"]);
  expect(book.sheets[0]?.theme?.colorThemeId).toBe("Rainbow-#000229-MULTI_LINE_COLORS");
  expect((book.sheets[0]?.theme?.map as { properties?: Record<string, string> } | undefined)?.properties?.["color-list"]).toContain("#000229");
  expect(book.sheets[0]?.relationships?.[0]?.controlPoints?.["0"]?.x).toBe(-186);
});

test("adds a parent, a floating topic, and a second sheet", async ({ page }) => {
  await page.getByRole("button", { name: "MIT License", exact: true }).click();
  await page.keyboard.press("Control+Enter");
  await expect(page.getByRole("button", { name: "New topic", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Floating", exact: true }).click();
  await expect(page.getByRole("button", { name: "Floating topic", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add sheet", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Sheet 2" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("map")).toHaveAttribute("data-sheet-index", "1");
  const second = page.getByRole("button", { name: "Central topic", exact: true });
  await second.click();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Rename Central topic" });
  await editor.fill("Second sheet root");
  await editor.press("Enter");

  await page.getByRole("tab", { name: "xmind-mcp" }).click();
  await expect(page.getByRole("button", { name: "xmind-mcp", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Second sheet root", exact: true })).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save", exact: true }).click(),
  ]);
  const book = readXMind(readFileSync((await download.path())!));
  expect(book.sheets).toHaveLength(2);
  expect(book.sheets[1]?.rootTopic.title).toBe("Second sheet root");
  expect(book.sheets[1]?.theme && JSON.stringify(book.sheets[1].theme).includes("NeverMind")).toBe(false);
  const project = book.sheets[0]?.rootTopic.children?.attached?.find((topic) => topic.title === "📋 Project");
  const parent = project?.children?.attached?.find((topic) => topic.title === "New topic");
  expect(parent?.children?.attached?.some((topic) => topic.title === "MIT License")).toBe(true);
  expect(book.sheets[0]?.rootTopic.children?.detached?.some((topic) => topic.title === "Floating topic")).toBe(true);
  expect(book.sheets[0]?.theme?.centralTopic && (book.sheets[0].theme.centralTopic as { properties?: Record<string, string> }).properties?.["fo:font-family"]).toBe("NeverMind");
});
