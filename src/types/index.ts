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
  
  // Meeting context (optional relationship details)
  metAt?: string;
  contactType?: string;
  interest?: string;
  relationshipOwner?: string;
  followUpDate?: string;
  
  // Flag for deterministic demo
  isDemo?: boolean;
}

export type RecordStatus = 
  | "SCANNED" 
  | "VERIFIED"
  | "ARCHIVED";

export interface ContactRecord {
  id: string; // uuid
  originalImage?: Blob; // The actual image data (optional for manual/synthetic entries)
  originalFileName: string;
  createdAt: string; // ISO date
  verifiedAt?: string;
  
  rawOCRText: string;
  ocrData: OCRData;
  verifiedData: OCRData;
  
  status: RecordStatus;
  isDemo?: boolean;
}

