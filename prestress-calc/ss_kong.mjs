import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1000 });
const shot = async (n, clip) => { await page.screenshot({ path: `kong_${n}.png`, ...(clip?{clip}:{}) }); console.log("✓", n); };
const click = async (s) => { await page.click(s).catch(()=>{}); await page.waitForTimeout(700); };

await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500);

// 1. Header with new PT/Pre-T toggle
await shot("01-header", { x: 0, y: 0, width: 1600, height: 56 });

// 2. ULS tab → scroll to BS 8110 section
await click('button:has-text("ULS")');
await page.waitForTimeout(500);
await page.evaluate(() => { const el = [...document.querySelectorAll('p')].find(p=>p.textContent.includes('BS 8110')); if (el) el.scrollIntoView({block:'start'}); });
await page.waitForTimeout(500);
await shot("02-bs8110-uls", { x: 278, y: 75, width: 670, height: 760 });

// 3. Switch to Pre-T and observe losses change (header)
await click('button:has-text("Pre-T")');
await page.waitForTimeout(700);
await shot("03-pretensioned-active", { x: 0, y: 0, width: 1600, height: 56 });

// 4. Open print report, capture §3 (calc3) and §8 (dual formula) and §25 (BS)
await click('button:has-text("PT")'); // back to post-tensioned
await page.waitForTimeout(500);
const [popup] = await Promise.all([
  page.context().waitForEvent("page").catch(()=>null),
  page.click('button:has-text("Laporan")').catch(()=>{}),
]);
if (popup) {
  await popup.waitForLoadState("networkidle").catch(()=>{});
  await popup.setViewportSize({ width: 1000, height: 1150 });
  await popup.waitForTimeout(800);
  const goto = async (txt, name) => {
    await popup.evaluate((t) => { const h = [...document.querySelectorAll('*')].find(e=>e.children.length===0 && e.textContent && e.textContent.trim().startsWith(t)); if (h) h.scrollIntoView({block:'start'}); }, txt);
    await popup.waitForTimeout(400);
    await popup.screenshot({ path: `kong_${name}.png` });
    console.log("✓", name);
  };
  await goto("3. Penampang Non-Komposit", "04-report-calc3");
  await goto("8. Kontrol SLS", "05-report-sls-dual");
  await goto("25. Metode BS 8110", "06-report-bs8110");
  await popup.close();
}
await browser.close();
console.log("done");
