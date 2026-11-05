import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { readXMind } from "xmind-workbook";

const fixture = fileURLToPath(new URL("../../../packages/xmind-workbook/test/fixtures/img-measure.xmind", import.meta.url));
const resourceId = "1a7a2536-91a1-4396-863b-e25006871de5";
const imageTopicId = "d88a8b38-0c1c-41f2-aedc-fc61898cbeb1";
const centralId = "5c59e4cc-4dbb-4af0-9a08-33d1b54bf429";

test("topic image previews, attaches, and round-trips", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("open-file").setInputFiles(fixture);
  await expect(page.getByRole("button", { name: "with image", exact: true })).toBeVisible();
  await expect(page.locator(`[data-topic-id="${imageTopicId}"] img[data-testid="topic-image"]`)).toBeVisible();

  await page.getByRole("button", { name: "with image", exact: true }).click();
  await expect(page.getByTestId("topic-image-preview")).toBeVisible();

  await page.getByRole("button", { name: "Central", exact: true }).click();
  const original = readXMind(readFileSync(fixture));
  const png = original.extras?.find((entry) => entry.name === `resources/${resourceId}`)?.data;
  expect(png?.length).toBe(70);
  const dir = mkdtempSync(join(tmpdir(), "topic-image-"));
  const pngPath = join(dir, "dot.png");
  writeFileSync(pngPath, png!);
  await page.getByTestId("topic-image-file").setInputFiles(pngPath);
  await expect(page.getByTestId("topic-image-preview")).toBeVisible();
  await expect(page.locator(`[data-topic-id="${centralId}"] img[data-testid="topic-image"]`)).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save", exact: true }).click(),
  ]);
  const book = readXMind(readFileSync((await download.path())!));
  const kept = book.extras?.find((entry) => entry.name === `resources/${resourceId}`);
  expect(Buffer.from(kept?.data ?? [])).toEqual(Buffer.from(png!));
  expect(book.manifest?.["file-entries"]?.[`resources/${resourceId}`]).toEqual({});
  expect(book.manifest?.["file-entries"]?.["content.xml"]).toBeUndefined();

  const child = book.sheets[0]?.rootTopic.children?.attached?.[0];
  expect(child?.id).toBe(imageTopicId);
  expect(child?.id).not.toBe(resourceId);
  expect(child?.image).toMatchObject({
    src: `xap:resources/${resourceId}`,
    width: 64,
    height: 64,
    align: "bottom",
  });

  const root = book.sheets[0]?.rootTopic;
  const src = root?.image?.src ?? "";
  expect(src.startsWith("xap:resources/")).toBe(true);
  const addedId = src.slice("xap:resources/".length);
  expect(addedId.includes(".")).toBe(false);
  expect(addedId.includes("/")).toBe(false);
  expect(addedId).not.toBe(root?.id);
  expect(root?.image?.align).toBe("bottom");
  expect(typeof root?.image?.width).toBe("number");
  expect(typeof root?.image?.height).toBe("number");
  const added = book.extras?.find((entry) => entry.name === `resources/${addedId}`);
  expect(Buffer.from(added?.data ?? [])).toEqual(Buffer.from(png!));
  expect(book.manifest?.["file-entries"]?.[`resources/${addedId}`]).toEqual({});

  const [svgDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "SVG", exact: true }).click(),
  ]);
  const svg = readFileSync((await svgDownload.path())!, "utf8");
  expect(svg).toContain("<image");
  expect(svg).toContain("data:image/png;base64,");

  const [pngDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "PNG", exact: true }).click(),
  ]);
  const exported = readFileSync((await pngDownload.path())!);
  expect(exported.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
});
