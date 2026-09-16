import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Save, X, Bot, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { storageService } from "@/lib/db";
import type { OCRData } from "@/types";

const schema = z.object({
  fullName: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  alternatePhone: z.string().optional(),
  website: z.string().refine(val => !val || val.includes('.'), "Invalid URL").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.fullName && !data.companyName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either Full Name or Company Name is required",
      path: ["fullName"],
    });
  }
  if (!data.email && !data.phone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either Email or Phone is required",
      path: ["email"],
    });
  }
});

type FormData = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  ocrData: OCRData;
  rawText: string;
  originalImage: File;
  imageUrl: string;
  onSuccess: () => void;
}

export default function OCRReviewModal({ isOpen, setIsOpen, ocrData, rawText, originalImage, imageUrl, onSuccess }: Props) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ...ocrData }
  });

  useEffect(() => {
    if (isOpen && ocrData) {
      reset(ocrData);
    }
  }, [isOpen, ocrData, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      // Validate and clean up
      const verifiedData = {
        fullName: data.fullName?.trim() || "",
        companyName: data.companyName?.trim() || "",
        jobTitle: data.jobTitle?.trim() || "",
        email: data.email?.trim().toLowerCase() || "",
        phone: data.phone?.trim() || "",
        alternatePhone: data.alternatePhone?.trim() || "",
        website: data.website?.trim() || "",
        address: data.address?.trim() || "",
        city: data.city?.trim() || "",
        country: data.country?.trim() || "",
        notes: data.notes?.trim() || "",
      };

      // Check duplicates (Mock duplicate check for now, later enhance)
      // Save to IndexedDB
      const record = {
        id: crypto.randomUUID(),
        originalImage: originalImage, // storing the File blob directly
        originalFileName: originalImage.name,
        createdAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        rawOCRText: rawText,
        ocrData: ocrData,
        verifiedData: verifiedData,
        status: "VERIFIED" as const,
      };

      await storageService.saveRecord(record);
      
      toast.success("Contact verified and added to your contacts list.");
      onSuccess();
    } catch (error) {
      toast.error("Failed to save contact. Please try again.");
    }
  };

  const Field = ({ label, name, type = "text" }: { label: string, name: keyof FormData, type?: string }) => {
    const isOcrDetected = ocrData && !!(ocrData as any)[name];
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between items-start md:items-center flex-wrap gap-1">
          <Label htmlFor={name} className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
            {label}
            {["fullName", "companyName"].includes(name) && <span className="text-muted-foreground font-normal ml-1 text-xs">(Req. if other empty)</span>}
            {["email", "phone"].includes(name) && <span className="text-muted-foreground font-normal ml-1 text-xs">(Req. if other empty)</span>}
          </Label>
          <div className="text-[10px] uppercase font-medium flex items-center gap-1 text-muted-foreground shrink-0">
             {isOcrDetected ? <><Bot className="w-3 h-3 text-blue-500"/> Detected</> : <><User className="w-3 h-3"/> Empty</>}
          </div>
        </div>
        <Input
          id={name}
          type={type}
          {...register(name)}
          className={errors[name] ? "border-destructive focus-visible:ring-destructive" : ""}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
        {errors[name] && <p className="text-xs text-destructive font-medium">{errors[name]?.message}</p>}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[90vw] lg:max-w-6xl max-h-[95vh] sm:max-h-[90vh] p-0 overflow-hidden flex flex-col bg-slate-50">
        <DialogHeader className="p-4 md:p-6 pb-4 border-b bg-white shrink-0">
          <DialogTitle className="text-xl md:text-2xl">Review Scanned Information</DialogTitle>
          <DialogDescription className="text-sm">
            Verify the information extracted from your business card before saving. Edit any incorrect fields.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
          {/* Left: Image */}
          <div className="lg:w-2/5 p-4 md:p-6 bg-slate-100 flex items-center justify-center border-b lg:border-b-0 lg:border-r overflow-hidden relative min-h-[200px] lg:min-h-0 shrink-0">
            <div className="absolute inset-4 flex items-center justify-center">
              <img src={imageUrl} alt="Business Card" className="max-w-full max-h-full object-contain drop-shadow-xl rounded-md" />
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:w-3/5 overflow-y-auto bg-white p-4 md:p-6 flex-1">
            <form id="ocr-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 md:gap-x-6 md:gap-y-5">
              <div className="sm:col-span-2">
                <Field label="Full Name" name="fullName" />
              </div>
              <Field label="Company Name" name="companyName" />
              <Field label="Job Title" name="jobTitle" />
              <Field label="Email Address" name="email" type="email" />
              <Field label="Phone Number" name="phone" type="tel" />
              <Field label="Alternate Phone" name="alternatePhone" type="tel" />
              <Field label="Website" name="website" type="text" />
              <div className="sm:col-span-2">
                <Field label="Address" name="address" />
              </div>
              <Field label="City" name="city" />
              <Field label="Country" name="country" />
              <div className="sm:col-span-2">
                <Field label="Notes" name="notes" />
              </div>
            </form>
          </div>
        </div>

        <div className="p-4 border-t bg-white flex justify-end gap-3 shrink-0">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
          <Button type="submit" form="ocr-form">
            <Save className="w-4 h-4 mr-2" /> Save to Verified Contacts
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
