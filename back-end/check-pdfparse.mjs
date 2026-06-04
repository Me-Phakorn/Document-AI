import { PDFParse } from 'pdf-parse';
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const buf = readFileSync(file);
const parser = new PDFParse({ data: buf });
const { text } = await parser.getText();
const first = text.split('\f')[0] || text.slice(0, 1500);

// Score Thai ratio
const meaningful = first.replace(/\s+/g, '');
const thai = (first.match(/[ก-๙]/g) ?? []).length;
const ratio = meaningful.length ? thai / meaningful.length : 0;
const garbled = (first.match(/[\u00A0-\u00FF]/g) ?? []).length;

console.log(`FILE: ${file}`);
console.log(`PAGE-1 chars=${first.length} thai-chars=${thai} thai-ratio=${ratio.toFixed(3)} latin-extended=${garbled}`);
console.log('--- FIRST 600 CHARS ---');
console.log(first.slice(0, 600));
console.log('--- END ---\n');
