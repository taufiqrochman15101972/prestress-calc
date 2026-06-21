import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1050 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Find all scrollable elements and scroll the rightmost one (visual panel)
const panels = await page.$$('.overflow-y-auto');
console.log("Scrollable panels found:", panels.length);

// Scroll each panel and try to find the one that has the diagrams
for (let i = 0; i < panels.length; i++) {
  const scrollH = await panels[i].evaluate(el => el.scrollHeight);
  const clientH = await panels[i].evaluate(el => el.clientHeight);
  console.log(`Panel ${i}: scrollHeight=${scrollH}, clientHeight=${clientH}`);
}

// Scroll the last panel (visual diagrams panel) to bottom
if (panels.length > 0) {
  const last = panels[panels.length - 1];
  await last.evaluate(el => { el.scrollTop = 9999; });
  await page.waitForTimeout(600);
  const scrollTop = await last.evaluate(el => el.scrollTop);
  console.log("Scrolled to:", scrollTop);
}

await page.screenshot({ path: "ss-zone-scrolled.png", clip: { x: 820, y: 50, width: 780, height: 980 } });

await browser.close();
console.log("Done");
