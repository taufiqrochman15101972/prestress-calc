import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 2000 });  // taller viewport to see more
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Scroll ALL scrollable panels to bottom
const panels = await page.$$('.overflow-y-auto, .overflow-y-scroll');
for (const p of panels) {
  await p.evaluate(el => { el.scrollTop = 9999; });
}
await page.waitForTimeout(600);

// Screenshot the right side (visual diagrams panel)
await page.screenshot({ path: "ss-zone-tall.png", clip: { x: 820, y: 0, width: 780, height: 2000 } });

await browser.close();
console.log("Done");
