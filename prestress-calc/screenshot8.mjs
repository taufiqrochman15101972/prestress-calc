import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ bypassCSP: true });
const page = await ctx.newPage();
await page.setViewportSize({ width: 1600, height: 1200 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Click Kehilangan tab
await page.click('button:has-text("Kehilangan")').catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: "ss8-losses.png" });

// Click ULS tab
await page.click('button:has-text("ULS")').catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: "ss8-uls.png" });

// Scroll right panel to see deflection chart
const panels = await page.$$('[style*="48%"]');
for (const p of panels) {
  await p.evaluate(el => { el.scrollTop = 480; }).catch(() => {});
}
await page.waitForTimeout(500);
await page.screenshot({ path: "ss8-deflchart.png",
  clip: { x: 840, y: 60, width: 760, height: 560 }
});

await browser.close();
console.log("Done");
