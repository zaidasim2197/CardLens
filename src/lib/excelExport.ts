import * as XLSX from "xlsx";
import type { ContactRecord } from "@/types";

export function exportToExcel(records: ContactRecord[], filename: string) {
  const data = records.map((record) => ({
    "Record ID": record.id,
    "Record Type": record.isDemo || record.verifiedData.isDemo ? "Demo Contact" : "Standard Contact",
    "Full Name": record.verifiedData.fullName,
    "Job Title": record.verifiedData.jobTitle,
    "Company Name": record.verifiedData.companyName,
    "Email": record.verifiedData.email,
    "Phone (Mobile)": record.verifiedData.phone,
    "Alternate Phone (Office)": record.verifiedData.alternatePhone,
    "Website": record.verifiedData.website,
    "Address": record.verifiedData.address,
    "City": record.verifiedData.city,
    "Country": record.verifiedData.country,
    "Met At / Location": record.verifiedData.metAt || "",
    "Contact Type": record.verifiedData.contactType || "",
    "Product / Interest": record.verifiedData.interest || "",
    "Relationship Owner": record.verifiedData.relationshipOwner || "",
    "Suggested Follow-up Date": record.verifiedData.followUpDate || "",
    "Notes": record.verifiedData.notes,
    "Review Status": record.status,
    "Created At": new Date(record.createdAt).toLocaleString(),
    "Reviewed At": record.verifiedAt ? new Date(record.verifiedAt).toLocaleString() : "N/A",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  const wscols = [
    { wch: 36 }, // Record ID
    { wch: 16 }, // Record Type
    { wch: 22 }, // Full Name
    { wch: 22 }, // Job Title
    { wch: 25 }, // Company Name
    { wch: 30 }, // Email
    { wch: 18 }, // Phone (Mobile)
    { wch: 22 }, // Alternate Phone (Office)
    { wch: 25 }, // Website
    { wch: 32 }, // Address
    { wch: 16 }, // City
    { wch: 16 }, // Country
    { wch: 22 }, // Met At / Location
    { wch: 16 }, // Contact Type
    { wch: 24 }, // Product / Interest
    { wch: 20 }, // Relationship Owner
    { wch: 20 }, // Suggested Follow-up Date
    { wch: 35 }, // Notes
    { wch: 16 }, // Review Status
    { wch: 22 }, // Created At
    { wch: 22 }, // Reviewed At
  ];
  worksheet["!cols"] = wscols;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reviewed Contacts");

  XLSX.writeFile(workbook, filename);
}
