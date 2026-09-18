import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  ZoomIn,
  Calendar,
  User,
  Building2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { storageService } from "@/lib/db";
import { checkDuplicateContact } from "@/lib/duplicateChecker";
import DuplicateWarningModal from "./DuplicateWarningModal";
import type { OCRData, ContactRecord } from "@/types";

const schema = z
  .object({
    fullName: z.string().optional(),
    companyName: z.string().optional(),
    jobTitle: z.string().optional(),
    email: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
        "Please enter a valid email address (e.g. name@example.com)"
      ),
    phone: z.string().optional(),
    alternatePhone: z.string().optional(),
    website: z
      .string()
      .optional()
      .refine(
        (val) => !val || val.includes("."),
        "Please enter a valid website (e.g. www.example.com)"
      ),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    
    // Meeting Context Fields
    metAt: z.string().optional(),
    contactType: z.string().optional(),
    interest: z.string().optional(),
    relationshipOwner: z.string().optional(),
    notes: z.string().optional(),
    followUpDate: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasNameOrCompany = Boolean(data.fullName?.trim() || data.companyName?.trim());
    if (!hasNameOrCompany) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter either a full name or company name",
        path: ["fullName"],
      });
    }
    const hasEmailOrPhone = Boolean(
      data.email?.trim() || data.phone?.trim() || data.alternatePhone?.trim()
    );
    if (!hasEmailOrPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter at least one phone number or email",
        path: ["email"],
      });
    }
  });

type FormData = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  ocrData: OCRData | null;
  rawText?: string;
  originalImage?: Blob | File | null;
  imageUrl?: string | null;
  onSuccess: () => void;
  isDemo?: boolean;
  isManualEntry?: boolean;
}

export default function OCRReviewModal({
  isOpen,
  setIsOpen,
  ocrData,
  rawText = "",
  originalImage = null,
  imageUrl = null,
  onSuccess,
  isDemo = false,
  isManualEntry = false,
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
  const [isMeetingContextOpen, setIsMeetingContextOpen] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
    reset,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: ocrData?.fullName || "",
      companyName: ocrData?.companyName || "",
      jobTitle: ocrData?.jobTitle || "",
      email: ocrData?.email || "",
      phone: ocrData?.phone || "",
      alternatePhone: ocrData?.alternatePhone || "",
      website: ocrData?.website || "",
      address: ocrData?.address || "",
      city: ocrData?.city || "",
      country: ocrData?.country || "",
      metAt: ocrData?.metAt || "",
      contactType: ocrData?.contactType || "",
      interest: ocrData?.interest || "",
      relationshipOwner: ocrData?.relationshipOwner || "",
      notes: ocrData?.notes || "",
      followUpDate: ocrData?.followUpDate || "",
    },
  });

  const formValues = watch();

  useEffect(() => {
    if (isOpen) {
      reset({
        fullName: ocrData?.fullName || "",
        companyName: ocrData?.companyName || "",
        jobTitle: ocrData?.jobTitle || "",
        email: ocrData?.email || "",
        phone: ocrData?.phone || "",
        alternatePhone: ocrData?.alternatePhone || "",
        website: ocrData?.website || "",
        address: ocrData?.address || "",
        city: ocrData?.city || "",
        country: ocrData?.country || "",
        metAt: ocrData?.metAt || "",
        contactType: ocrData?.contactType || "",
        interest: ocrData?.interest || "",
        relationshipOwner: ocrData?.relationshipOwner || "",
        notes: ocrData?.notes || "",
        followUpDate: ocrData?.followUpDate || "",
      });
      setSavedRecord(null);
      setDuplicateMatch(null);
    }
  }, [isOpen, ocrData, reset]);

  const saveRecordToDB = async (verifiedData: OCRData) => {
    setIsSaving(true);
    try {
      const record: ContactRecord = {
        id: crypto.randomUUID(),
        originalImage: originalImage || undefined,
        originalFileName: (originalImage as File)?.name || (isDemo ? "demo-card.jpg" : "manual-contact.jpg"),
        createdAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        rawOCRText: rawText || "",
        ocrData: ocrData || verifiedData,
        verifiedData: verifiedData,
        status: "VERIFIED" as const,
        isDemo: Boolean(isDemo),
      };

      await storageService.saveRecord(record);
      setSavedRecord(record);
      toast.success("Contact saved successfully!");
    } catch {
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
      metAt: data.metAt?.trim() || "",
      contactType: data.contactType?.trim() || "",
      interest: data.interest?.trim() || "",
      relationshipOwner: data.relationshipOwner?.trim() || "",
      notes: data.notes?.trim() || "",
      followUpDate: data.followUpDate || "",
      isDemo: Boolean(isDemo),
    };

    // Duplicate Check
    const dupResult = await checkDuplicateContact(verifiedData);
    if (dupResult.isDuplicate && dupResult.matchedRecord) {
      setDuplicateMatch({
        record: dupResult.matchedRecord,
        reason: dupResult.matchReason || "A contact with matching details was found.",
        pendingVerifiedData: verifiedData,
      });
      setIsDuplicateModalOpen(true);
      return;
    }

    await saveRecordToDB(verifiedData);
  };

  const shouldFlagForVerification = (name: keyof FormData, value: string | undefined): boolean => {
    if (isManualEntry) return false;
    if (isDemo) {
      return name === "website" &&
        (value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "") !== "www.aerosyntech.com";
    }
    if (!value || !value.trim()) return true;

    const val = value.trim();
    if (name === "fullName") {
      if (!val.includes(" ") && val.length <= 4) return true;
      if (/[•@#$%&*+=0-9]/.test(val)) return true;
    }
    if (name === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) return true;
    }
    if (name === "phone" || name === "alternatePhone") {
      const digits = val.replace(/\D/g, "");
      if (digits.length > 0 && digits.length < 7) return true;
    }
    return false;
  };

  const renderField = (
    label: string,
    name: keyof FormData,
    type = "text",
    placeholder = `Enter ${label.toLowerCase()}`,
    helperText?: string
  ) => {
    const isEdited = Boolean(dirtyFields[name]);
    const currentValue = (formValues as any)[name];
    const needsVerification = shouldFlagForVerification(name, currentValue);
    const isDemoWebsite = isDemo && name === "website";

    return (
      <div key={name} className="space-y-1.5">
        <div className="flex justify-between items-center flex-wrap gap-1">
          <Label
            htmlFor={name}
            className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm"
          >
            {label}
            {["fullName", "companyName"].includes(name) && (
              <span className="text-muted-foreground font-normal ml-1 text-[11px]">
                (Required if other empty)
              </span>
            )}
            {["email", "phone"].includes(name) && (
              <span className="text-muted-foreground font-normal ml-1 text-[11px]">
                (Required if other empty)
              </span>
            )}
          </Label>

          {/* Status Badge */}
          <div className="text-[10px] font-semibold flex items-center gap-1">
            {isDemoWebsite && needsVerification ? (
              <span className="text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200 dark:border-amber-900/40">
                <AlertCircle className="w-3 h-3" /> Please confirm
              </span>
            ) : isDemoWebsite ? (
              <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Corrected
              </span>
            ) : isDemo ? (
              <span className="text-brand bg-brand/10 px-2 py-0.5 rounded-md font-bold">
                Demo contact
              </span>
            ) : isEdited ? (
              <span className="text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                ✏ Edited
              </span>
            ) : isManualEntry ? (
              <span className="text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                Manual
              </span>
            ) : needsVerification ? (
              <span className="text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200 dark:border-amber-900/40">
                <AlertCircle className="w-3 h-3 text-amber-500" /> Needs review
              </span>
            ) : currentValue ? (
              <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                Read from card
              </span>
            ) : null}
          </div>
        </div>

        <Input
          id={name}
          type={type}
          {...register(name)}
          aria-describedby={isDemoWebsite ? `${name}-review-hint` : undefined}
          className={`h-10 text-sm rounded-xl ${
            errors[name]
              ? "border-destructive focus-visible:ring-destructive"
              : isEdited
              ? "border-amber-400 focus-visible:ring-amber-400 font-medium"
              : needsVerification
              ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/20"
              : "border-slate-200 dark:border-slate-800 focus-visible:ring-brand"
          }`}
          placeholder={placeholder}
        />
        {isDemoWebsite && (
          <p id={`${name}-review-hint`} aria-live="polite" className={`text-[11px] leading-relaxed ${needsVerification ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
            {needsVerification
              ? "Please confirm against the card. One character may have been misread."
              : "Website matches the demo card."}
          </p>
        )}
        {helperText && !errors[name] && (
          <p className="text-[11px] text-muted-foreground">{helperText}</p>
        )}
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
        <DialogContent
          className={
            savedRecord
              ? "max-w-md w-[92vw] p-6 sm:p-7 rounded-3xl border border-border shadow-2xl bg-background"
              : "flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-2xl border bg-background p-0 shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:w-[92vw] sm:max-w-[92vw] lg:max-w-5xl"
          }
        >
          {/* ── SUCCESS STATE VIEW ──────────────────────────────────── */}
          {savedRecord ? (
            <div className="flex flex-col items-center text-center py-4 px-2">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 ring-8 ring-emerald-500/5">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
                  Contact Saved
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-xs leading-relaxed">
                  <span className="font-semibold text-foreground">
                    {savedRecord.verifiedData.fullName || "Contact"}
                  </span>{" "}
                  has been added to your reviewed contacts.
                </p>
              </div>

              {/* Compact Saved Contact Card */}
              <div className="w-full p-4 rounded-2xl border border-border bg-slate-50 dark:bg-slate-900/50 text-left space-y-1.5 my-5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-foreground truncate">
                    {savedRecord.verifiedData.fullName || savedRecord.verifiedData.companyName || "Saved Contact"}
                  </h4>
                  {savedRecord.isDemo && (
                    <span className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                      Demo contact
                    </span>
                  )}
                </div>
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
                {savedRecord.verifiedData.contactType && (
                  <span className="inline-block mt-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded">
                    {savedRecord.verifiedData.contactType}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
                <Button
                  size="default"
                  className="w-full sm:w-1/2 font-semibold text-xs sm:text-sm h-11 rounded-xl bg-brand text-white hover:bg-brand-hover shadow-xs"
                  onClick={onSuccess}
                >
                  Scan Another Card
                </Button>

                <Button
                  variant="outline"
                  size="default"
                  className="w-full sm:w-1/2 font-semibold text-xs sm:text-sm h-11 rounded-xl gap-1.5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  onClick={() => {
                    setIsOpen(false);
                    onSuccess();
                    navigate("/verified");
                  }}
                >
                  View Reviewed Contacts <ArrowRight className="w-4 h-4 text-brand" />
                </Button>
              </div>
            </div>
          ) : (
            /* ── CONTACT REVIEW FORM VIEW ────────────────────────────── */
            <>
              {/* Header with clear trust notice */}
              <DialogHeader className="shrink-0 border-b bg-slate-50/60 p-4 pb-3 dark:bg-slate-900/60 sm:p-5 sm:pb-3.5">
                <div className="flex items-start justify-between gap-2 pr-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-lg sm:text-xl font-extrabold tracking-tight">
                        Review Contact
                      </DialogTitle>
                      {isDemo && (
                        <span className="text-[11px] font-bold text-brand bg-brand/10 px-2.5 py-0.5 rounded-full border border-brand/20">
                          Demo contact
                        </span>
                      )}
                    </div>
                    {/* Trust Notice as required */}
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Please review before saving.
                      </span>
                      <span className="text-slate-500">OCR can make mistakes.</span>
                    </p>
                  </div>
                </div>
              </DialogHeader>

              {/* Modal Body: Split view on Desktop */}
              <div className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto overscroll-contain bg-slate-50/40 lg:flex-row lg:overflow-hidden">
                {/* Left: Card Preview Panel (Mobile top banner or Desktop side panel) */}
                {imageUrl ? (
                  <div className="group relative h-[160px] min-h-[160px] shrink-0 overflow-hidden border-b border-border bg-slate-100/70 p-3 dark:bg-slate-900/40 sm:h-[190px] sm:min-h-[190px] lg:h-auto lg:min-h-0 lg:w-5/12 lg:border-b-0 lg:border-r lg:p-6 flex flex-col items-center justify-center">
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img
                        src={imageUrl}
                        alt="Business Card Preview"
                        className="max-h-full max-w-full rounded-xl border border-slate-200 object-contain shadow-sm dark:border-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setIsZoomImageOpen(true)}
                        className="absolute right-2 top-2 flex items-center gap-1 rounded-lg border border-border bg-background/90 px-2 py-1 text-[11px] font-medium text-foreground opacity-90 shadow-xs backdrop-blur-xs transition-colors hover:bg-background hover:opacity-100"
                      >
                        <ZoomIn className="w-3 h-3 text-brand" /> Full View
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-100/50 dark:bg-slate-900/30 border-b border-border lg:w-4/12 lg:border-b-0 lg:border-r flex items-center justify-center text-center">
                    <div className="space-y-1">
                      <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                        <User className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Manual Entry
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Enter contact details directly
                      </p>
                    </div>
                  </div>
                )}

                {/* Right: Scrollable Form Panel */}
                <div className="shrink-0 bg-background p-4 sm:p-6 lg:w-7/12 lg:flex-1 lg:shrink lg:overflow-y-auto space-y-6">
                  <form
                    id="ocr-review-form"
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    {/* Contact Details Section */}
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between border-b pb-1.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-brand" />
                          Contact details
                        </h4>
                        <span className="text-[11px] text-muted-foreground">All fields editable</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="sm:col-span-2">
                          {renderField("Full name", "fullName", "text", "e.g. Daniel Rahman")}
                        </div>
                        {renderField("Job title", "jobTitle", "text", "e.g. Business Development Manager")}
                        {renderField("Company", "companyName", "text", "e.g. AeroSyn Tech Solutions")}
                        {renderField("Mobile", "phone", "tel", "e.g. +1 (555) 284-7712")}
                        {renderField("Office phone", "alternatePhone", "tel", "e.g. +1 (555) 284-7700")}
                        {renderField("Email", "email", "email", "e.g. daniel.rahman@example.com")}
                        {renderField("Website", "website", "text", "e.g. www.aerosyn-example.com")}
                        <div className="sm:col-span-2">
                          {renderField("Address", "address", "text", "e.g. 1200 Innovation Drive, Suite 410, NY")}
                        </div>
                      </div>
                    </div>

                    {/* Section 5: Meeting Context (Optional, lightweight, collapsible) */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setIsMeetingContextOpen(!isMeetingContextOpen)}
                        className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-brand" />
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                            Meeting context
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                            Optional
                          </span>
                        </div>
                        {isMeetingContextOpen ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>

                      {isMeetingContextOpen && (
                        <div className="p-3.5 sm:p-4 pt-1 space-y-3.5 border-t border-slate-200/60 dark:border-slate-800/60 bg-background/50">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* Met at / event / location */}
                            <div className="space-y-1.5">
                              <Label
                                htmlFor="metAt"
                                className="font-semibold text-xs text-slate-800 dark:text-slate-200"
                              >
                                Met at / event / location
                              </Label>
                              <Input
                                id="metAt"
                                {...register("metAt")}
                                className="h-10 text-sm rounded-xl"
                                placeholder="e.g. Tech Expo, Booth 410"
                              />
                            </div>

                            {/* Contact type */}
                            <div className="space-y-1.5">
                              <Label
                                htmlFor="contactType"
                                className="font-semibold text-xs text-slate-800 dark:text-slate-200"
                              >
                                Contact type
                              </Label>
                              <select
                                id="contactType"
                                {...register("contactType")}
                                className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-background focus:ring-2 focus:ring-brand outline-none"
                              >
                                <option value="">Select contact type…</option>
                                <option value="Prospect">Prospect</option>
                                <option value="Customer">Customer</option>
                                <option value="Supplier">Supplier</option>
                                <option value="Partner">Partner</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>

                            {/* Product or business interest */}
                            <div className="space-y-1.5">
                              <Label
                                htmlFor="interest"
                                className="font-semibold text-xs text-slate-800 dark:text-slate-200"
                              >
                                Product or business interest
                              </Label>
                              <Input
                                id="interest"
                                {...register("interest")}
                                className="h-10 text-sm rounded-xl"
                                placeholder="e.g. Enterprise integration"
                              />
                            </div>

                            {/* Relationship owner / salesperson */}
                            <div className="space-y-1.5">
                              <Label
                                htmlFor="relationshipOwner"
                                className="font-semibold text-xs text-slate-800 dark:text-slate-200"
                              >
                                Relationship owner / salesperson
                              </Label>
                              <Input
                                id="relationshipOwner"
                                {...register("relationshipOwner")}
                                className="h-10 text-sm rounded-xl"
                                placeholder="e.g. Sales Team"
                              />
                            </div>

                            {/* Suggested follow-up date */}
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label
                                htmlFor="followUpDate"
                                className="font-semibold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                              >
                                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                Suggested follow-up date
                              </Label>
                              <Input
                                id="followUpDate"
                                type="date"
                                {...register("followUpDate")}
                                className="h-10 text-sm rounded-xl"
                              />
                            </div>

                            {/* Notes */}
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label
                                htmlFor="notes"
                                className="font-semibold text-xs text-slate-800 dark:text-slate-200"
                              >
                                Notes
                              </Label>
                              <textarea
                                id="notes"
                                {...register("notes")}
                                rows={2}
                                className="w-full p-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-background focus:ring-2 focus:ring-brand outline-none resize-none"
                                placeholder="Add key discussion points or next steps…"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              {/* Sticky Footer Actions */}
              <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md dark:bg-slate-900/95 sm:gap-3 sm:p-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  disabled={isSaving}
                  className="h-11 rounded-xl px-3 sm:px-4 text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4 mr-1.5" /> Cancel
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    form="ocr-review-form"
                    disabled={isSaving}
                    className="h-11 min-h-[44px] rounded-xl bg-brand px-5 sm:px-7 text-xs sm:text-sm font-bold text-white shadow-md shadow-brand/25 hover:bg-brand-hover active:scale-[0.98] transition-all"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving…
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" /> Save reviewed contact
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
      {imageUrl && (
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
      )}
    </>
  );
}
