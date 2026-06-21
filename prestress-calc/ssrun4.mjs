import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setViewportSize({ width: 1600, height: 900 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500);

// Listen for popup
let reportPage = null;
ctx.on("page", p => { reportPage = p; });

// Click print button
await page.click('button:has-text("Cetak Laporan")');
await page.waitForTimeout(2000);

if (reportPage) {
  await reportPage.waitForLoadState("load");
  await reportPage.waitForTimeout(800);
  await reportPage.setViewportSize({ width: 900, height: 1200 });
  await reportPage.screenshot({ path: "ss-report-top.png", clip: { x: 0, y: 0, width: 900, height: 600 } });
  await reportPage.screenshot({ path: "ss-report-mid.png", clip: { x: 0, y: 580, width: 900, height: 600 } });
  await reportPage.screenshot({ path: "ss-report-bot.png", clip: { x: 0, y: 1100, width: 900, height: 600 } });
  console.log("Report page captured");
} else {
  console.log("No popup opened");
}

await browser.close();
