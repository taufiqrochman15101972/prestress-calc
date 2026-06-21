import { pdf } from "pdf-to-img";
import { writeFileSync } from "fs";

const file = process.argv[2];
const start = parseInt(process.argv[3] || "1");
const end = parseInt(process.argv[4] || "20");
const outPrefix = process.argv[5] || "pg";

const doc = await pdf(file, { scale: 2.0 });
console.log("TOTAL PAGES:", doc.length);

let i = 0;
for await (const page of doc) {
  i++;
  if (i < start) continue;
  if (i > end) break;
  writeFileSync(`pdfimg_${outPrefix}_${String(i).padStart(3, "0")}.png`, page);
  console.log("rendered", i);
}
console.log("done");
