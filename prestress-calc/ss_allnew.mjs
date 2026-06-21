import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1000 });
const shot = async (n, clip) => { await page.screenshot({ path: `new_${n}.png`, ...(clip?{clip}:{}) }); console.log("✓", n); };
const click = async (s) => { await page.click(s).catch(()=>{}); await page.waitForTimeout(700); };
const MID = { x: 278, y: 75, width: 670, height: 880 };

await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500);

// 1. Header toggle row (PT/Pre-T highlighted)
await shot("01-header-toggles", { x: 0, y: 0, width: 1600, height: 56 });

// 2. ULS tab → BS 8110 section
await click('button:has-text("ULS")');
await page.waitForTimeout(500);
await page.evaluate(() => { const el = [...document.querySelectorAll('p')].find(p=>p.textContent.includes('BS 8110')); if (el) el.scrollIntoView({block:'start'}); });
await page.waitForTimeout(500);
await shot("02-bs8110-uls", MID);

// 3. Pre-T active — show losses differ (Kehilangan tab)
await click('button:has-text("Pre-T")');
await page.waitForTimeout(700);
await click('button:has-text("Kehilangan")');
await page.waitForTimeout(500);
await shot("03-pretensioned-losses", MID);
// header shows Pre-T active
await shot("03b-header-pretensioned", { x: 900, y: 0, width: 700, height: 56 });

// 4. Back to PT, Kehilangan to compare
await click('button:has-text("ULS")'); // any change to refresh
await click('button:has-text("🔗 PT")');
await page.waitForTimeout(500);
await click('button:has-text("Kehilangan")');
await page.waitForTimeout(500);
await shot("04-posttensioned-losses", MID);

// 5. Report — capture 3-line calc (§3), dual-formula SLS (§8), ULS Mn (§9), BS (§25)
const [popup] = await Promise.all([
  page.context().waitForEvent("page").catch(()=>null),
  page.click('button:has-text("Laporan")').catch(()=>{}),
]);
if (popup) {
  await popup.waitForLoadState("networkidle").catch(()=>{});
  await popup.setViewportSize({ width: 1000, height: 1150 });
  await popup.waitForTimeout(900);
  const goto = async (txt, name) => {
    await popup.evaluate((t) => { const h = [...document.querySelectorAll('*')].find(e=>e.children.length===0 && e.textContent && e.textContent.trim().startsWith(t)); if (h) h.scrollIntoView({block:'start'}); }, txt);
    await popup.waitForTimeout(450);
    await popup.screenshot({ path: `new_${name}.png` });
    console.log("✓", name);
  };
  await goto("3. Penampang Non-Komposit", "05-report-calc3");
  await goto("8. Kontrol SLS", "06-report-sls-dual");
  await goto("25. Metode BS 8110", "07-report-bs8110");
  await popup.close();
}
await browser.close();
console.log("done");
