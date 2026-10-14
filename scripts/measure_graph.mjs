// Run against a production preview. Output lives outside Playwright's wiped results folder.
import { chromium } from "@playwright/test";
import { writeFileSync, existsSync } from "node:fs";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    serviceWorkers: "block",
  });
  await page.goto(process.argv[2] || "http://127.0.0.1:4174");
  await page
    .locator(".chapter-card")
    .filter({ hasText: "Tier 1 - LV" })
    .click();
  await page.locator(".quest-node").first().waitFor();
  await page.getByRole("button", { name: "Fit chapter" }).click();
  const frames = page.evaluate(
    () =>
      new Promise((resolve) => {
        const samples = [];
        let prev = performance.now();
        function frame(t) {
          samples.push(t - prev);
          prev = t;
          if (samples.length < 40) requestAnimationFrame(frame);
          else resolve(samples.slice(1));
        }
        requestAnimationFrame(frame);
      }),
  );
  const bounds = await page.locator(".graph-scroll").boundingBox();
  await page.mouse.move(bounds.x + 40, bounds.y + 40);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 180, bounds.y + 150, { steps: 30 });
  await page.mouse.up();
  const samples = await frames;
  const result = {
    method:
      "39 requestAnimationFrame intervals while dragging a fitted LV chapter, headless Chromium, local production preview, 1280×900.",
    nodes: await page.locator(".quest-node").count(),
    meanFrameMs: samples.reduce((a, b) => a + b, 0) / samples.length,
    maxFrameMs: Math.max(...samples),
    samples,
  };
  writeFileSync("docs/graph-metrics.json", JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      nodes: result.nodes,
      meanFrameMs: result.meanFrameMs,
      maxFrameMs: result.maxFrameMs,
    }),
  );
} finally {
  await browser.close();
}
