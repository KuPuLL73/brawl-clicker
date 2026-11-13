import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch(),
  p = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    locale: "ru-RU",
  }),
  errors = [],
  failed = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("response", (r) => {
  if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() });
});
// Model a static host mounting the same build under a folder.
await p.route("**/nested/**", async (route) => {
  const url = new URL(route.request().url());
  url.pathname = url.pathname.replace("/nested", "");
  const response = await route.fetch({ url: String(url) });
  await route.fulfill({ response });
});
try {
  await p.goto(
    `${process.env.BRAWL_PRODUCTION_URL || "http://127.0.0.1:4180"}/nested/`,
    { waitUntil: "networkidle" },
  );
  for (const route of [
    "home",
    "brawlers",
    "boxes",
    "arena",
    "road",
    "rewards",
  ]) {
    await p.locator(`.nav-item[data-nav="${route}"]`).click();
    await p
      .locator("img")
      .evaluateAll((images) => images.forEach((i) => (i.loading = "eager")));
    await expect
      .poll(
        () =>
          p
            .locator("img")
            .evaluateAll((images) =>
              images.every((i) => i.complete && i.naturalWidth > 0),
            ),
        { message: route + " images load" },
      )
      .toBe(true);
  }
  await p.locator('.nav-item[data-nav="arena"]').click();
  await p.locator('[data-action="battle"]').click();
  await p.locator('[data-action="ability"]').click();
  await expect(p.locator('[data-action="ability"]')).toBeDisabled();
  await p.screenshot({ path: "artifacts/production-battle.jpg" });
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  const report = {
    date: "2026-10-23",
    nestedPath: true,
    screens: 6,
    battleAbility: true,
    allVisibleImagesLoaded: true,
    errors,
    failed,
  };
  await writeFile(
    "artifacts/production-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
