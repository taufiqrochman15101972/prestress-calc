import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1050 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 40000 });
await page.waitForTimeout(3000);

// Screenshot full app with new toggles + Cloud button
await page.screenshot({ path: "ss-v3-full.png" });

// Click ULS tab and scroll to new sections (torsion, PPR, continuous)
await page.click('button:has-text("ULS")');
await page.waitForTimeout(600);
const panel = await page.$('.overflow-y-auto.p-4');
if (panel) {
  await panel.evaluate(el => { el.scrollTop = 9999; });
  await page.waitForTimeout(400);
}
await page.screenshot({ path: "ss-v3-uls-new.png", clip: { x: 0, y: 60, width: 840, height: 960 } });

// Test Cloud button
await page.click('button:has-text("Cloud")');
await page.waitForTimeout(600);
await page.screenshot({ path: "ss-v3-cloud-modal.png", clip: { x: 200, y: 100, width: 620, height: 500 } });

await browser.close();
console.log("Done");
