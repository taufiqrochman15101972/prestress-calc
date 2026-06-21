import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ bypassCSP: true });
const page = await ctx.newPage();
await page.setViewportSize({ width: 1600, height: 1200 });

// Hard load with cache disabled
await page.goto("http://localhost:3000", {
  waitUntil: "networkidle", timeout: 30000
});
await page.waitForTimeout(4000);

// Click SLS tab to ensure it's active
await page.click('button:has-text("SLS")').catch(() => {});
await page.waitForTimeout(500);

// Get the right visual panel
const panels = await page.$$('[style*="48%"]');
console.log("Found panels:", panels.length);

// Scroll it
for (const p of panels) {
  try {
    await p.evaluate(el => { el.scrollTop = 0; });
  } catch(e) {}
}
await page.waitForTimeout(300);

// Find the stress distribution SVG
const stressSvgs = await page.$$('svg');
console.log("SVGs found:", stressSvgs.length);

// Full page tall screenshot
await page.screenshot({ path: "ss6-full.png", fullPage: false });

// Try to find the stress chart by looking for it
for (let i = 0; i < stressSvgs.length; i++) {
  const box = await stressSvgs[i].boundingBox();
  if (box && box.width > 300 && box.height > 300) {
    console.log(`SVG ${i}: x=${box.x.toFixed(0)}, y=${box.y.toFixed(0)}, w=${box.width.toFixed(0)}, h=${box.height.toFixed(0)}`);
    await page.screenshot({
      path: `ss6-svg${i}.png`,
      clip: { x: box.x - 2, y: box.y - 2, width: box.width + 4, height: box.height + 4 }
    });
  }
}

await browser.close();
console.log("Done");
