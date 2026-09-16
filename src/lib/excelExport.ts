import * as XLSX from "xlsx";
import type { ContactRecord } from "@/types";

export function exportToExcel(records: ContactRecord[], filename: string) {
  const data = records.map((record) => ({
    "Record ID": record.id,
    "Full Name": record.verifiedData.fullName,
    "Job Title": record.verifiedData.jobTitle,
    "Company Name": record.verifiedData.companyName,
    "Email": record.verifiedData.email,
    "Phone": record.verifiedData.phone,
    "Alternate Phone": record.verifiedData.alternatePhone,
    "Website": record.verifiedData.website,
    "Address": record.verifiedData.address,
    "City": record.verifiedData.city,
    "Country": record.verifiedData.country,
    "Notes": record.verifiedData.notes,
    
    "OCR Full Name": record.ocrData.fullName,
    "OCR Company": record.ocrData.companyName,
    "OCR Email": record.ocrData.email,
    "OCR Phone": record.ocrData.phone,
    "OCR Address": record.ocrData.address,
    
    "Verification Status": record.status,
    
    "Scanned At": new Date(record.createdAt).toLocaleString(),
    "Verified At": record.verifiedAt ? new Date(record.verifiedAt).toLocaleString() : "N/A",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  const wscols = [
    { wch: 36 }, // Record ID
    { wch: 20 }, // Name
    { wch: 20 }, // Title
    { wch: 25 }, // Company
    { wch: 30 }, // Email
    { wch: 15 }, // Phone
    { wch: 15 }, // Alt Phone
    { wch: 25 }, // Website
    { wch: 30 }, // Address
    { wch: 15 }, // City
    { wch: 15 }, // Country
    { wch: 40 }, // Notes
    // ... rest can be auto or defaults
  ];
  worksheet["!cols"] = wscols;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");

  XLSX.writeFile(workbook, filename);
}
