import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 950 });
const shot = async (n) => { await page.screenshot({ path: `ssn_${n}.png` }); console.log("✓", n); };
const click = async (s) => { await page.click(s).catch(()=>{}); await page.waitForTimeout(700); };

await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500);
await shot("01-main");                       // default now trapezoidal girder

// Penampang tab → efficiency/kern
await click('button:has-text("Penampang")');
await shot("02-section-efficiency");

// ULS tab → MCFT + flexural stages
await click('button:has-text("ULS")');
await page.waitForTimeout(500);
await shot("03-uls-top");
await page.evaluate(() => window.scrollTo(0, 700));
await page.waitForTimeout(400);
await shot("04-uls-stages-mcft");

// Extra calculators → tension + corbel
await page.evaluate(() => window.scrollTo(0, 0));
await click('button:has-text("Kalkulator")');
await page.waitForTimeout(1000);
await click('button:has-text("Batang Tarik")');
await page.waitForTimeout(600);
await shot("05-tension");
await click('button:has-text("Korbel")');
await page.waitForTimeout(600);
await shot("06-corbel");
await click('button:has-text("Pelat")');
await page.waitForTimeout(600);
await page.evaluate(() => { const m = document.querySelector('.overflow-y-auto'); if (m) m.scrollTop = m.scrollHeight; });
await page.waitForTimeout(400);
await shot("07-slab-moment-transfer");

await browser.close();
console.log("done");
