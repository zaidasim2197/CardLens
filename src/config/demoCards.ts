import type { OCRData } from "@/types";

export interface DemoCardConfig {
  id: string;
  title: string;
  personName: string;
  companyName: string;
  imagePath: string;
  preparedData: OCRData;
  rawOCRText: string;
}

export const SINGLE_DEMO_CARD: DemoCardConfig = {
  id: "demo-aerosyntech",
  title: "AeroSynTech Solutions",
  personName: "Daniel Rahman",
  companyName: "AeroSynTech Solutions",
  imagePath: "/democard.png",
  rawOCRText: `AeroSynTech Solutions
Daniel Rahman
Business Development Manager
Mobile: +1 (555) 284-7712
Office: +1 (555) 284-7700
Email: danielrahman@aerosyntech
Website: www.aerosyntech.com
Address: 425 Madison Avenue, Suite 1200, New York, NY 10017, USA`,
  preparedData: {
    fullName: "Daniel Rahman",
    jobTitle: "Business Development Manager",
    companyName: "AeroSynTech Solutions",
    email: "danielrahman@aerosyntech", // Purposefully missing .com to trigger "Please verify" label
    phone: "+1 (555) 284-7712",
    alternatePhone: "+1 (555) 284-7700",
    website: "www.aerosyntech.com",
    address: "425 Madison Avenue, Suite 1200",
    city: "New York",
    country: "USA",
    notes: "",
    meetingContext: {
      metAtLocation: " ",
      contactType: "",
      productInterest: " ",
      relationshipOwner: " ",
      notes: " ",
      followUpDate: " ",
    },
  },
};

export const DEMO_CARDS: DemoCardConfig[] = [SINGLE_DEMO_CARD];
