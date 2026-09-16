import { parseOCRText } from './server/services/cardParser.js';

const text = `digitechinfra
QAZI NAUMAN MUJAHID
Chief Executive Officer (CEO)
+92 317 6688855
nauman@digitechinfra.com
B-9, Commissioner Society,
Abul Hasan Isphahani Rd,
Karachi, 75300
www.digitechinfra.com`;

console.log(JSON.stringify(parseOCRText(text), null, 2));
