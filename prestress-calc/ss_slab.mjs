import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe", headless:true, args:["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1500, height: 1000 });
const click = async (s)=>{ await page.click(s).catch(()=>{}); await page.waitForTimeout(800); };
await page.goto("http://localhost:3000",{waitUntil:"networkidle",timeout:30000});
await page.waitForTimeout(2200);
await click('button:has-text("Kalkulator")');
await click('button:has-text("Pelat")');
await page.waitForTimeout(700);
// scroll modal content to the moment-transfer heading
await page.evaluate(() => { const h=[...document.querySelectorAll('p')].find(p=>p.textContent.includes('Transfer Momen')); if(h) h.scrollIntoView({block:'center'}); });
await page.waitForTimeout(500);
const modal = await page.$('.relative.bg-white.rounded-xl');
const b = await modal.boundingBox();
await page.screenshot({path:"modal_slab_mt.png", clip:b});
console.log("✓ slab moment transfer");
await browser.close();
