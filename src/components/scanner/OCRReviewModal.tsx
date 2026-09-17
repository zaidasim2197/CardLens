import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Save, X, AlertCircle, CheckCircle2, ArrowRight, RefreshCw, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { storageService } from "@/lib/db";
import { checkDuplicateContact } from "@/lib/duplicateChecker";
import DuplicateWarningModal from "./DuplicateWarningModal";
import type { OCRData, ContactRecord } from "@/types";

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

export default function OCRReviewModal({
  isOpen,
  setIsOpen,
  ocrData,
  rawText,
  originalImage,
  imageUrl,
  onSuccess,
}: Props) {
  const navigate = useNavigate();

  const [isSaving, setIsSaving] = useState(false);
  const [savedRecord, setSavedRecord] = useState<ContactRecord | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<{
    record: ContactRecord;
    reason: string;
    pendingVerifiedData: OCRData;
  } | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isZoomImageOpen, setIsZoomImageOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
    reset,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ...ocrData },
  });

  const formValues = watch();

  useEffect(() => {
    if (isOpen && ocrData) {
      reset(ocrData);
      setSavedRecord(null);
      setDuplicateMatch(null);
    }
  }, [isOpen, ocrData, reset]);

  const saveRecordToDB = async (verifiedData: OCRData) => {
    setIsSaving(true);
    try {
      const record: ContactRecord = {
        id: crypto.randomUUID(),
        originalImage: originalImage,
        originalFileName: originalImage.name,
        createdAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        rawOCRText: rawText,
        ocrData: ocrData,
        verifiedData: verifiedData,
        status: "VERIFIED" as const,
      };

      await storageService.saveRecord(record);
      setSavedRecord(record);
      toast.success("Contact saved successfully!");
    } catch (error) {
      toast.error("Failed to save contact. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    const verifiedData: OCRData = {
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

    // Duplicate Check
    const dupResult = await checkDuplicateContact(verifiedData);
    if (dupResult.isDuplicate && dupResult.matchedRecord) {
      setDuplicateMatch({
        record: dupResult.matchedRecord,
        reason: dupResult.matchReason || "Duplicate found",
        pendingVerifiedData: verifiedData,
      });
      setIsDuplicateModalOpen(true);
      return;
    }

    await saveRecordToDB(verifiedData);
  };

  const shouldFlagForVerification = (name: keyof FormData, value: string | undefined): boolean => {
    if (!value || !value.trim()) return true;

    const val = value.trim();

    if (name === "fullName") {
      // 1. Single word without space and <= 5 letters (e.g. ATECH, TECH, CEO) -> suspicious as full name
      if (!val.includes(" ") && val.length <= 5 && /^[A-Z0-9]+$/i.test(val)) return true;
      // 2. Contains non-alphanumeric symbols like bullets, @, www, http, numbers
      if (/[•@#\$%^&\*_\+=\[\]{}|\\<>\/0-9]/.test(val)) return true;
      // 3. Contains company terms
      const companyTerms = ["infra", "corp", "inc", "ltd", "limited", "solutions", "tech", "technologies", "systems", "group", "llc"];
      if (companyTerms.some(term => val.toLowerCase().includes(term))) return true;
    }

    if (name === "companyName") {
      // Starts with bullet points or punctuation symbols
      if (/^[•\-\/:\.,#]/.test(val)) return true;
    }

    if (name === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) return true;
    }

    if (name === "phone" || name === "alternatePhone") {
      const digits = val.replace(/\D/g, "");
      if (digits.length > 0 && digits.length < 7) return true;
    }

    if (name === "website") {
      if (!val.includes(".")) return true;
    }

    return false;
  };

  const Field = ({
    label,
    name,
    type = "text",
  }: {
    label: string;
    name: keyof FormData;
    type?: string;
  }) => {
    const isEdited = Boolean(dirtyFields[name]);
    const currentValue = (formValues as any)[name];
    const needsVerification = shouldFlagForVerification(name, currentValue);

    return (
      <div className="space-y-1.5">
        <div className="flex justify-between items-center flex-wrap gap-1">
          <Label htmlFor={name} className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
            {label}
            {["fullName", "companyName"].includes(name) && (
              <span className="text-muted-foreground font-normal ml-1 text-[11px]">(Req. if other empty)</span>
            )}
            {["email", "phone"].includes(name) && (
              <span className="text-muted-foreground font-normal ml-1 text-[11px]">(Req. if other empty)</span>
            )}
          </Label>

          {/* Confidence / Status Badge */}
          <div className="text-[10px] font-semibold flex items-center gap-1">
            {isEdited ? (
              <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                ✏ Edited
              </span>
            ) : needsVerification ? (
              <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-200 dark:border-amber-900/40">
                <AlertCircle className="w-3 h-3 text-amber-500" /> Please verify
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                Extracted
              </span>
            )}
          </div>
        </div>

        <Input
          id={name}
          type={type}
          {...register(name)}
          className={`h-10 text-sm ${
            errors[name]
              ? "border-destructive focus-visible:ring-destructive"
              : isEdited
              ? "border-amber-400 focus-visible:ring-amber-400 font-medium"
              : needsVerification
              ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20"
              : ""
          }`}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
        {errors[name] && (
          <p className="text-xs text-destructive font-medium mt-1">
            {errors[name]?.message}
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className={savedRecord ? "max-w-md w-[92vw] p-6 sm:p-7 rounded-3xl border border-border shadow-2xl bg-background" : "w-[95vw] max-w-[95vw] sm:max-w-[90vw] lg:max-w-6xl max-h-[92vh] sm:max-h-[90vh] p-0 overflow-hidden flex flex-col bg-background rounded-2xl border shadow-2xl"}>
          {/* ── SUCCESS STATE VIEW ──────────────────────────────────── */}
          {savedRecord ? (
            <div className="flex flex-col items-center text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  Contact Saved Successfully
                </h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  The verified business card details have been securely saved.
                </p>
              </div>

              {/* Compact Saved Contact Card */}
              <div className="w-full p-4 rounded-2xl border border-border bg-slate-50 dark:bg-slate-900/50 text-left space-y-1.5 my-5">
                <h4 className="font-bold text-sm text-foreground">
                  {savedRecord.verifiedData.fullName || savedRecord.verifiedData.companyName || "Saved Contact"}
                </h4>
                {savedRecord.verifiedData.jobTitle && (
                  <p className="text-xs text-muted-foreground font-medium">
                    {savedRecord.verifiedData.jobTitle}
                  </p>
                )}
                {savedRecord.verifiedData.companyName && (
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {savedRecord.verifiedData.companyName}
                  </p>
                )}
                {savedRecord.verifiedData.email && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1.5 border-t border-border/50">
                    ✉ {savedRecord.verifiedData.email}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
                <Button
                  size="default"
                  className="w-full sm:w-1/2 font-semibold text-xs h-10 rounded-xl bg-[#007BC2] text-white hover:bg-[#0064a0] shadow-md shadow-[#007BC2]/20"
                  onClick={onSuccess}
                >
                  Scan Another Card
                </Button>

                <Button
                  variant="outline"
                  size="default"
                  className="w-full sm:w-1/2 font-semibold text-xs h-10 rounded-xl gap-1.5 border-border"
                  onClick={() => {
                    setIsOpen(false);
                    onSuccess();
                    navigate("/verified");
                  }}
                >
                  View Contacts <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            /* ── REVIEW FORM VIEW ────────────────────────────────────── */
            <>
              {/* Header */}
              <DialogHeader className="p-5 md:p-6 pb-4 border-b bg-muted/20 shrink-0">
                <DialogTitle className="text-xl md:text-2xl font-bold tracking-tight">
                  Review Contact
                </DialogTitle>
                <DialogDescription className="text-xs md:text-sm text-muted-foreground mt-0.5">
                  Review the information extracted from your business card before saving. Edit any incorrect fields.
                </DialogDescription>
              </DialogHeader>

              {/* Modal Body: Split view on Desktop */}
              <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0 bg-slate-50/50">
                {/* Left: Card Preview Panel */}
                <div className="lg:w-5/12 p-4 md:p-6 bg-slate-100/70 dark:bg-slate-900/40 flex flex-col justify-center items-center border-b lg:border-b-0 lg:border-r border-border overflow-hidden min-h-[220px] lg:min-h-0 shrink-0 relative group">
                  <div className="absolute inset-4 flex items-center justify-center">
                    <img
                      src={imageUrl}
                      alt="Business Card Preview"
                      className="max-w-full max-h-full object-contain rounded-xl shadow-md border border-slate-200 dark:border-slate-800"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsZoomImageOpen(true)}
                    className="absolute top-4 right-4 bg-background/80 hover:bg-background text-foreground p-2 rounded-xl border border-border shadow-sm transition-colors opacity-80 hover:opacity-100 flex items-center gap-1.5 text-xs font-medium"
                  >
                    <ZoomIn className="w-3.5 h-3.5 text-primary" /> Full View
                  </button>
                </div>

                {/* Right: Editable Form Panel */}
                <div className="lg:w-7/12 overflow-y-auto bg-background p-5 md:p-6 flex-1 space-y-6">
                  <form
                    id="ocr-review-form"
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    {/* Identity Group */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1.5">
                        Identity Details
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <Field label="Full Name" name="fullName" />
                        </div>
                        <Field label="Company Name" name="companyName" />
                        <Field label="Job Title" name="jobTitle" />
                      </div>
                    </div>

                    {/* Contact Info Group */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1.5">
                        Contact Info & Online
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Email Address" name="email" type="email" />
                        <Field label="Phone Number" name="phone" type="tel" />
                        <Field label="Alternate Phone" name="alternatePhone" type="tel" />
                        <Field label="Website" name="website" type="text" />
                      </div>
                    </div>

                    {/* Location & Notes Group */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1.5">
                        Location & Notes
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <Field label="Street Address" name="address" />
                        </div>
                        <Field label="City" name="city" />
                        <Field label="Country" name="country" />
                        <div className="sm:col-span-2">
                          <Field label="Notes" name="notes" />
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t bg-background flex items-center justify-between gap-3 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isSaving}
                  className="rounded-xl text-xs font-semibold"
                >
                  <X className="w-4 h-4 mr-1.5" /> Cancel
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    form="ocr-review-form"
                    disabled={isSaving}
                    className="h-10 px-6 rounded-xl font-bold text-xs bg-[#007BC2] text-white hover:bg-[#0064a0] shadow-md shadow-[#007BC2]/20"
                  >

                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving…
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" /> Save Contact
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate Warning Modal */}
      {duplicateMatch && (
        <DuplicateWarningModal
          isOpen={isDuplicateModalOpen}
          onClose={() => setIsDuplicateModalOpen(false)}
          existingContact={duplicateMatch.record}
          matchReason={duplicateMatch.reason}
          onSaveAnyway={() => {
            setIsDuplicateModalOpen(false);
            saveRecordToDB(duplicateMatch.pendingVerifiedData);
          }}
          onViewExisting={() => {
            setIsDuplicateModalOpen(false);
            setIsOpen(false);
            onSuccess();
            navigate("/verified");
          }}
        />
      )}

      {/* Zoom Image Dialog */}
      <Dialog open={isZoomImageOpen} onOpenChange={setIsZoomImageOpen}>
        <DialogContent className="max-w-4xl p-2 bg-background border-border">
          <div className="relative flex items-center justify-center max-h-[85vh] overflow-hidden">
            <img
              src={imageUrl}
              alt="Business card high res"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

