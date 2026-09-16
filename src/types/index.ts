export interface OCRData {
  fullName: string;
  jobTitle: string;
  companyName: string;
  email: string;
  phone: string;
  alternatePhone: string;
  website: string;
  address: string;
  city: string;
  country: string;
  notes: string;
}

export type RecordStatus = 
  | "SCANNED" 
  | "VERIFIED"
  | "ARCHIVED";

export interface ContactRecord {
  id: string; // uuid
  originalImage: Blob; // The actual image data
  originalFileName: string;
  createdAt: string; // ISO date
  verifiedAt?: string;
  
  rawOCRText: string;
  ocrData: OCRData;
  verifiedData: OCRData;
  
  status: RecordStatus;
}

