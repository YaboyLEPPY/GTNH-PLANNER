import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
test("production build is accessible, lazily loads compressed data, and caches visited content offline", async ({
  browser,
}) => {
  test.setTimeout(60000);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".chapter-card")).toHaveCount(47);
  const cold = await page.evaluate(() => ({
    usableMs: performance.now(),
    resources: performance.getEntriesByType("resource").map((e) => {
      const r = e as PerformanceResourceTiming;
      return {
        name: new URL(r.name).pathname,
        transferBytes: r.transferSize,
        encodedBytes: r.encodedBodySize,
        durationMs: r.duration,
      };
    }),
  }));
  expect(
    cold.resources.some(
      (r) =>
        r.name.includes("/catalog.json") || r.name.includes("/search.json"),
    ),
  ).toBe(false);
  expect(cold.resources.some((r) => r.name.includes("/index.json.gz"))).toBe(
    true,
  );
  expect(cold.usableMs).toBeLessThan(5000);
  const accessibility: { view: string; violations: unknown[] }[] = [];
  for (const tab of [
    "Questbook",
    "Production",
    "Materials",
    "Base planner",
    "World & backup",
  ]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(page.locator("main h1").first()).toBeVisible();
    const result = await new AxeBuilder({ page }).analyze();
    accessibility.push({
      view: tab,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    });
    expect(result.violations).toEqual([]);
  }
  await page.getByRole("button", { name: "Questbook", exact: true }).click();
  await page.getByRole("button", { name: /Find Ender IO/ }).click();
  await expect(page.locator(".result-list")).toBeVisible();
  const searchStart = await page.evaluate(() => performance.now());
  await page
    .getByLabel("Search the complete questbook")
    .fill("Basic Circuit Assembler");
  await expect(
    page.getByRole("button", { name: /Basic Circuit Assembler Tier 1/ }),
  ).toBeVisible();
  const searchMs = await page.evaluate(
    (start) => performance.now() - start,
    searchStart,
  );
  await page
    .getByRole("button", { name: /Basic Circuit Assembler Tier 1/ })
    .click();
  await expect(page.locator(".quest-detail h2")).toHaveText(
    "Basic Circuit Assembler",
  );
  const chapterAxe = await new AxeBuilder({ page }).analyze();
  accessibility.push({
    view: "LV quest detail",
    violations: chapterAxe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  });
  expect(chapterAxe.violations).toEqual([]);
  await page.getByRole("button", { name: "Production", exact: true }).click();
  await page
    .getByRole("button", { name: /Try 20 Electronic Circuits/ })
    .click();
  const calcStart = await page.evaluate(() => performance.now());
  await page
    .getByRole("button", { name: "Calculate materials", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Gathering bill" }),
  ).toBeVisible();
  const calculationMs = await page.evaluate(
    (start) => performance.now() - start,
    calcStart,
  );
  const calcAxe = await new AxeBuilder({ page }).analyze();
  accessibility.push({
    view: "Circuit calculation",
    violations: calcAxe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  });
  expect(calcAxe.violations).toEqual([]);
  await page.getByRole("button", { name: "Questbook", exact: true }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await page.reload();
  await expect(page.locator(".chapter-card")).toHaveCount(47);
  const warm = await page.evaluate(() => ({
    usableMs: performance.now(),
    resources: performance.getEntriesByType("resource").map((e) => {
      const r = e as PerformanceResourceTiming;
      return {
        name: new URL(r.name).pathname,
        transferBytes: r.transferSize,
        encodedBytes: r.encodedBodySize,
      };
    }),
  }));
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".chapter-card")).toHaveCount(47);
  await page.getByRole("button", { name: /Find Ender IO/ }).click();
  await expect(
    page.getByRole("button", { name: /IO, IO, It's Off to EnderIO We Go/ }),
  ).toBeVisible();
  writeFileSync(
    "test-results/readiness-metrics.json",
    JSON.stringify(
      {
        method:
          "Headless system Chromium, production Vite preview, local loopback, 1280×720 default viewport. Cold fresh browser context; warm reload after service worker activation; timings include Playwright readiness polling. Not a remote/device benchmark.",
        cold,
        warm,
        searchMs,
        calculationMs,
        accessibility,
        offline:
          "Visited app shell and search available after network disabled",
      },
      null,
      2,
    ),
  );
  await context.close();
});
