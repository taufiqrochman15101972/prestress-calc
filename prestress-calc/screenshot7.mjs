import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setViewportSize({ width: 1600, height: 1200 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(4000);
await page.click('button:has-text("SLS")').catch(() => {});

// Scroll right panel to show stress SVG
const panels = await page.$$('[style*="48%"]');
for (const p of panels) {
  await p.evaluate(el => { el.scrollTop = 500; }).catch(() => {});
}
await page.waitForTimeout(800);

// Full viewport screenshot to see everything
await page.screenshot({ path: "ss7-full.png" });

// Try to capture just the stress chart area - it's at y≈980 in original, scroll brings it up
await page.screenshot({
  path: "ss7-stress.png",
  clip: { x: 960, y: 80, width: 640, height: 1000 }
});

await browser.close();
console.log("Done");
