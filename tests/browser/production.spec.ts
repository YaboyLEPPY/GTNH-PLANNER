import { test, expect } from "@playwright/test";
test("20 Electronic Circuits uses the real route, can select alternatives, and exports a bill", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Production", exact: true }).click();
  await page
    .getByRole("button", { name: /Try 20 Electronic Circuits/ })
    .click();
  await page.getByLabel("Gathering boundary").selectOption("components");
  await page
    .getByRole("button", { name: "Calculate materials", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Gathering bill" }),
  ).toBeVisible({ timeout: 60000 });
  for (const [name, qty] of [
    ["Resistor", "40"],
    ["Steel Casing", "20"],
    ["Vacuum Tube", "40"],
    ["Circuit Board", "20"],
    ["1x Red Alloy Cable", "60"],
  ]) {
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toContainText(qty);
  }
  const recipe = page.getByLabel("Recipe for Electronic Circuit");
  const routes = await recipe.locator("option").count();
  expect(routes).toBeGreaterThan(1);
  await recipe.selectOption({
    label: await recipe
      .locator("option")
      .filter({ hasText: "Circuit Assembler" })
      .first()
      .innerText(),
  });
  await page
    .getByRole("button", { name: "Calculate materials", exact: true })
    .click();
  await expect(
    page.getByLabel("Ore-dictionary alternative").first(),
  ).toBeVisible({ timeout: 60000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download bill CSV" }).click();
  expect((await download).suggestedFilename()).toBe("gtnh-materials.csv");
  await page.screenshot({
    path: "test-results/production.png",
    fullPage: true,
  });
});
