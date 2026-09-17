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
    "Verification Status": record.status,
    "Scanned At": new Date(record.createdAt).toLocaleString(),
    "Verified At": record.verifiedAt ? new Date(record.verifiedAt).toLocaleString() : "N/A",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  const wscols = [
    { wch: 36 }, // Record ID
    { wch: 22 }, // Full Name
    { wch: 22 }, // Job Title
    { wch: 25 }, // Company Name
    { wch: 30 }, // Email
    { wch: 18 }, // Phone
    { wch: 18 }, // Alternate Phone
    { wch: 25 }, // Website
    { wch: 32 }, // Address
    { wch: 16 }, // City
    { wch: 16 }, // Country
    { wch: 35 }, // Notes
    { wch: 18 }, // Verification Status
    { wch: 22 }, // Scanned At
    { wch: 22 }, // Verified At
  ];
  worksheet["!cols"] = wscols;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");

  XLSX.writeFile(workbook, filename);
}
