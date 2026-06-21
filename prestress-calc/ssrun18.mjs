import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Click Kernel formula toggle in header
await page.click('button:has-text("Kernel")');
await page.waitForTimeout(400);

// Open report with Kernel mode active
await page.click('button:has-text("Laporan")');
await page.waitForTimeout(2500);

const pages = browser.contexts()[0].pages();
const reportPage = pages[pages.length - 1];
await reportPage.waitForLoadState("domcontentloaded");
await reportPage.waitForTimeout(1500);

// Scroll to SLS section (around 2200-3000px)
await reportPage.evaluate(() => { window.scrollTo(0, 2100); });
await reportPage.waitForTimeout(300);
await reportPage.screenshot({ path: "ss-report-sls.png", clip: { x: 0, y: 0, width: 900, height: 900 } });

await browser.close();
console.log("Done");
