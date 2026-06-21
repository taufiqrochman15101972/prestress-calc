import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setViewportSize({ width: 1600, height: 1200 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Capture semua SVG besar
const svgs = await page.$$('svg');
console.log("Total SVGs:", svgs.length);
for (let i = 0; i < svgs.length; i++) {
  const box = await svgs[i].boundingBox();
  if (box && box.width > 200 && box.height > 100) {
    console.log(`SVG ${i}: x=${box.x.toFixed(0)} y=${box.y.toFixed(0)} w=${box.width.toFixed(0)} h=${box.height.toFixed(0)}`);
    await page.screenshot({
      path: `ss9-svg${i}.png`,
      clip: { x: Math.max(0, box.x-5), y: Math.max(0, box.y-5), width: box.width+10, height: box.height+10 }
    });
  }
}

// Scroll right panel
const panels = await page.$$('[style*="48%"]');
for (const p of panels) {
  await p.evaluate(el => { el.scrollTop = 400; }).catch(() => {});
}
await page.waitForTimeout(500);
await page.screenshot({ path: "ss9-scrolled.png" });

await browser.close();
console.log("Done");
