import { test, expect } from "@playwright/test";
test("orders use shared stock, completion is explicit and undoable, and backups survive reload", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.getByRole("button", { name: "Production", exact: true }).click();
  await page
    .getByRole("button", { name: /Try 20 Electronic Circuits/ })
    .click();
  await page.getByLabel("Gathering boundary").selectOption("components");
  await page
    .getByRole("button", { name: "Calculate materials", exact: true })
    .click();
  await page.getByRole("button", { name: "Save order", exact: true }).click();
  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await expect(
    page.getByLabel("Owned Resistor", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Complete build", exact: true })
    .click();
  await expect(page.getByText(/Build not completed: gather/)).toBeVisible();
  for (const [n, qty] of [
    ["Resistor", 40],
    ["Steel Casing", 20],
    ["Vacuum Tube", 40],
    ["Circuit Board", 20],
    ["1x Red Alloy Cable", 60],
  ] as const) {
    await page.getByLabel(`Owned ${n}`, { exact: true }).fill(String(qty));
  }
  await page
    .getByRole("button", { name: "Complete build", exact: true })
    .click();
  await expect(
    page.getByLabel("Owned Electronic Circuit", { exact: true }),
  ).toHaveValue("20");
  await expect(page.getByLabel("Owned Resistor", { exact: true })).toHaveValue(
    "0",
  );
  await page
    .getByRole("button", { name: "Undo last action", exact: true })
    .click();
  await expect(page.getByLabel("Owned Resistor", { exact: true })).toHaveValue(
    "40",
  );
  await expect(
    page.getByRole("button", { name: "Complete build", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "World & backup", exact: true })
    .click();
  await page
    .getByLabel("World name", { exact: true })
    .fill("Acceptance test world");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export world backup", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "horizon-foundry-world.json",
  );
  await page
    .getByLabel("Import world backup")
    .setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{bad"),
    });
  await expect(page.getByRole("alert")).toContainText("Import rejected");
  await expect(page.getByLabel("World name", { exact: true })).toHaveValue(
    "Acceptance test world",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "World & backup", exact: true })
    .click();
  await expect(page.getByLabel("World name", { exact: true })).toHaveValue(
    "Acceptance test world",
  );
});
