import { test, expect } from "@playwright/test";
test("base drawing, moving, resizing, floors, connections, undo/redo and reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Base planner", exact: true }).click();
  await page.getByRole("button", { name: "Machine", exact: true }).click();
  const board = page.locator(".base-board");
  const bounds = (await board.boundingBox())!;
  await page.mouse.move(bounds.x + 100, bounds.y + 100);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 150, bounds.y + 150);
  await page.mouse.up();
  await expect(page.locator(".base-zone")).toHaveCount(1);
  await page.getByLabel("Zone name", { exact: true }).fill("LV wiremill area");
  await page
    .getByRole("button", { name: "Save zone changes", exact: true })
    .click();
  await page.getByLabel("Zone width", { exact: true }).fill("5");
  await page
    .getByRole("button", { name: "Save zone changes", exact: true })
    .click();
  await expect(page.getByLabel("Zone width", { exact: true })).toHaveValue("5");
  const z = (await page.locator(".base-zone").boundingBox())!;
  await page.mouse.move(z.x + 12, z.y + 12);
  await page.mouse.down();
  await page.mouse.move(z.x + 52, z.y + 12);
  await page.mouse.up();
  await expect(page.getByLabel("Zone x", { exact: true })).toHaveValue("7");
  await page
    .getByRole("button", { name: "Undo base edit", exact: true })
    .click();
  await expect(page.getByLabel("Zone x", { exact: true })).toHaveValue("5");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByLabel("Zone x", { exact: true })).toHaveValue("7");
  await page.getByRole("button", { name: "Duplicate selected zone" }).click();
  await expect(page.locator(".base-zone")).toHaveCount(2);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Select LV wiremill area at 7, 5",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: /Select LV wiremill area copy/ })
    .click();
  await expect(
    page.getByLabel("Connection name", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Undo base edit", exact: true })
    .click();
  await expect(
    page.locator(".base-routes path").filter({ hasNot: page.locator("defs") }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByLabel("Base floor", { exact: true }).selectOption("3");
  await expect(page.locator(".base-zone")).toHaveCount(0);
  await page.getByRole("button", { name: "Farm", exact: true }).click();
  await page.getByLabel("Placement X", { exact: true }).fill("4");
  await page.getByLabel("Placement Y", { exact: true }).fill("4");
  await page
    .getByRole("button", { name: "Place selected type at coordinates" })
    .click();
  await expect(page.locator(".base-zone")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Base planner", exact: true }).click();
  await expect(page.locator(".base-zone")).toHaveCount(2);
  await page.getByLabel("Base floor", { exact: true }).selectOption("3");
  await expect(page.locator(".base-zone")).toHaveCount(1);
  await page.locator(".zone-label").first().click();
  await page.getByRole("button", { name: "Delete selected zone" }).click();
  await expect(page.locator(".base-zone")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Undo base edit", exact: true })
    .click();
  await expect(page.locator(".base-zone")).toHaveCount(1);
  await page.screenshot({ path: "test-results/base.png", fullPage: true });
});
test("touch and keyboard alternatives work without overflowing a narrow screen", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Base planner", exact: true }).click();
  await page.getByRole("button", { name: "Storage", exact: true }).tap();
  await page.getByLabel("Placement X", { exact: true }).fill("2");
  await page.getByLabel("Placement Y", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Place selected type at coordinates" })
    .tap();
  await expect(page.getByLabel("Zone x", { exact: true })).toHaveValue("2");
  await page.locator(".base-viewport").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Zone x", { exact: true })).toHaveValue("3");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/base-mobile.png",
    fullPage: true,
  });
  await context.close();
});
