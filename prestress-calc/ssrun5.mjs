import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setViewportSize({ width: 1600, height: 950 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500);

// Screenshot full app
await page.screenshot({ path: "ss-with-info.png" });

// Screenshot sidebar top (project info section)
await page.screenshot({ path: "ss-sidebar-info.png", clip: { x: 0, y: 0, width: 270, height: 420 } });

// Open print report
let reportPage = null;
ctx.on("page", p => { reportPage = p; });
await page.click('button:has-text("Cetak Laporan")');
await page.waitForTimeout(2000);
if (reportPage) {
  await reportPage.waitForLoadState("load");
  await reportPage.waitForTimeout(600);
  await reportPage.setViewportSize({ width: 900, height: 1200 });
  await reportPage.screenshot({ path: "ss-report-header.png", clip: { x: 0, y: 0, width: 900, height: 220 } });
  console.log("Report header captured");
}

await browser.close();
console.log("Done");
