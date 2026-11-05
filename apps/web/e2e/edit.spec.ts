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

  await page.getByLabel("Structure").selectOption("org.xmind.ui.logic.right");
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
