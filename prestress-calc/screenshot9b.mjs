import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setViewportSize({ width: 1600, height: 1200 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Scroll right panel to show deflection chart (at y=1529 on page)
const panels = await page.$$('[style*="48%"]');
for (const p of panels) {
  await p.evaluate(el => { el.scrollTop = 600; }).catch(() => {});
}
await page.waitForTimeout(600);

// Now capture SVGs again at new scroll position
const svgs = await page.$$('svg');
for (let i = 0; i < svgs.length; i++) {
  const box = await svgs[i].boundingBox();
  if (box && box.width > 200 && box.height > 100 && box.y > 0 && box.y < 1200) {
    console.log(`SVG ${i}: x=${box.x.toFixed(0)} y=${box.y.toFixed(0)} w=${box.width.toFixed(0)} h=${box.height.toFixed(0)}`);
  }
}

await page.screenshot({ path: "ss9-scroll600.png",
  clip: { x: 840, y: 60, width: 760, height: 1100 }
});

await browser.close();
console.log("Done");
