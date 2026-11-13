import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const groups = [
  [
    "gameplay",
    [
      ["home", "Главная"],
      ["rush", "Рейд: скилл и супер"],
      ["boss-warning", "Босс: сигнал уклонения"],
    ],
  ],
  [
    "loot",
    [
      ["boxes", "Боксы"],
      ["opening", "Раскрытие наград"],
      ["rewards", "Ежедневный дроп"],
    ],
  ],
];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1240, height: 960 } });
for (const [key, items] of groups) {
  const html = `<!doctype html><meta charset="utf-8"><title>Телефонная версия</title><style>body{margin:0;background:#0a1938;color:white;font:700 18px Arial;padding:20px;box-sizing:border-box}h1{font-size:25px;margin:0 0 7px}p{font-size:12px;color:#aec9eb;margin:0 0 18px}.phones{display:grid;grid-template-columns:repeat(3,390px);gap:15px}.phone{margin:0}figcaption{font-size:16px;margin-bottom:10px;color:#ffe38c}.phone img{display:block;width:390px;height:844px;object-fit:contain;border:1px solid #49679b;border-radius:15px;box-sizing:border-box}</style><h1>Телефонная версия · 390 × 844</h1><p>Скриншоты работающей игры в мобильном размере браузера</p><div class="phones">${items.map(([name, title]) => `<figure class="phone"><figcaption>${title}</figcaption><img src="http://127.0.0.1:5180/artifacts/mobile-${name}.png"></figure>`).join("")}</div>`;
  await writeFile(`artifacts/phone-gallery-${key}.html`, html);
  await page.goto(`http://127.0.0.1:5180/artifacts/phone-gallery-${key}.html`, {
    waitUntil: "networkidle",
  });
  await page.screenshot({ path: `artifacts/phone-gallery-${key}.jpg` });
}
await browser.close();
