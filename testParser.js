import { parseOCRText } from './server/services/cardParser.js';

const text1 = `Zaid Bin Asim
Data Engineer
VISION71 ™
TECHNOLOGIES
Custom Software • Web & App Development • Dashboards
Head Office: 96-A SMCHS, Karachi 74400, Pakistan. | WhatsApp: +92-319-1980857 | Email: zaid.sd@vision71tech.com 1`;

const text2 = `digitechinfra
QAZI NAUMAN MUJAHID
Chief Executive Officer (CEO)
+92 317 6688855
nauman@digitechinfra.com
B-9, Commissioner Society,
Abul Hasan Isphahani Rd,
Karachi, 75300
www.digitechinfra.com`;

console.log("--- Vision71 ---");
console.log(JSON.stringify(parseOCRText(text1), null, 2));

console.log("--- Digitech Infra ---");
console.log(JSON.stringify(parseOCRText(text2), null, 2));


