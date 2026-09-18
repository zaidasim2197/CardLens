import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Save, X, UserCheck, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { storageService } from "@/lib/db";
import { cropBusinessCardImage } from "@/lib/imageCrop";
import type { ContactRecord, OCRData } from "@/types";

interface Props {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  record: ContactRecord | null;
  onSuccess?: () => void;
}

export default function EditContactModal({ isOpen, setIsOpen, record, onSuccess }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<File | null>(null);

  const { register, handleSubmit, reset } = useForm<OCRData>({
    defaultValues: record?.verifiedData || {
      fullName: "",
      jobTitle: "",
      companyName: "",
      email: "",
      phone: "",
      alternatePhone: "",
      website: "",
      address: "",
      city: "",
      country: "",
      metAt: "",
      contactType: "",
      interest: "",
      relationshipOwner: "",
      followUpDate: "",
      notes: ""
    }
  });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (isOpen && record) {
      reset(record.verifiedData);
      setImageUrl(null);
      setCroppedImage(null);
      if (record.originalImage) {
        void cropBusinessCardImage(record.originalImage, record.originalFileName)
          .then((cropped) => {
            if (cancelled) return;
            objectUrl = URL.createObjectURL(cropped);
            setCroppedImage(cropped);
            setImageUrl(objectUrl);
          })
          .catch(() => {
            if (cancelled) return;
            if (record.originalImage) {
              objectUrl = URL.createObjectURL(record.originalImage);
            }
            setCroppedImage(null);
            setImageUrl(objectUrl);
          });
      } else {
        setCroppedImage(null);
        setImageUrl(null);
      }
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, record, reset]);

  if (!record) return null;

  const onSubmit = async (data: OCRData) => {
    try {
      const updatedVerifiedData: OCRData = {
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
        followUpDate: data.followUpDate || "",
        notes: data.notes?.trim() || "",
      };

      await storageService.updateRecord(record.id, {
        verifiedData: updatedVerifiedData,
        verifiedAt: new Date().toISOString(),
        ...(croppedImage
          ? {
              originalImage: croppedImage,
              originalFileName: croppedImage.name,
            }
          : {}),
      });

      toast.success("Contact details updated successfully.");
      setIsOpen(false);
      if (onSuccess) onSuccess();
    } catch {
      toast.error("Failed to update contact. Please try again.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-2xl border bg-background p-0 shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:w-[90vw] sm:max-w-5xl">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b bg-slate-50/50 p-4 pb-3 dark:bg-slate-900/50 sm:p-5 sm:pb-4 md:p-6 md:pb-4">
          <div className="flex items-center gap-3 pr-8">
            <div className="bg-brand/10 p-2.5 rounded-xl text-brand shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl md:text-2xl font-bold tracking-tight">Edit Contact Information</DialogTitle>
              <DialogDescription className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Update details for <span className="font-semibold text-foreground">{record.verifiedData.fullName || record.verifiedData.companyName || "this contact"}</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body: Split view on Desktop */}
        <div className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto overscroll-contain bg-slate-50/50 lg:flex-row lg:overflow-hidden">
          {/* Card Image Reference Panel */}
          {imageUrl && (
            <div className="flex h-[190px] min-h-[190px] shrink-0 flex-col overflow-hidden border-b border-border bg-slate-100/70 p-3 dark:bg-slate-900/40 sm:h-[230px] sm:min-h-[230px] sm:p-4 lg:h-auto lg:min-h-0 lg:w-5/12 lg:border-b-0 lg:border-r lg:p-6">
              <div className="mb-2 flex shrink-0 items-center gap-1.5 self-start text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:mb-3 sm:text-xs">
                <CreditCard className="w-3.5 h-3.5 text-brand" /> Scanned Card Reference
              </div>
              <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-xl">
                <img
                  src={imageUrl}
                  alt="Business Card Reference"
                  className="h-full w-full rounded-xl border border-slate-200 object-contain shadow-md dark:border-slate-800"
                />
              </div>
            </div>
          )}

          {/* Form Panel */}
          <div className={`shrink-0 bg-background p-4 sm:p-5 md:p-6 lg:flex-1 lg:shrink lg:overflow-y-auto ${!imageUrl ? 'w-full' : 'lg:w-7/12'}`}>
            <form id="edit-contact-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Identity Group */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                  Identity Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label htmlFor="fullName" className="font-semibold text-sm">Full Name</Label>
                    <Input id="fullName" {...register("fullName")} placeholder="e.g. Daniel Rahman" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="companyName" className="font-semibold text-sm">Company Name</Label>
                    <Input id="companyName" {...register("companyName")} placeholder="e.g. AeroSyn Tech Solutions" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="jobTitle" className="font-semibold text-sm">Job Title</Label>
                    <Input id="jobTitle" {...register("jobTitle")} placeholder="e.g. Business Development Manager" className="h-10" />
                  </div>
                </div>
              </div>

              {/* Contact Details Group */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                  Contact & Online
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="font-semibold text-sm">Email Address</Label>
                    <Input id="email" type="text" {...register("email")} placeholder="e.g. name@example.com" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="font-semibold text-sm">Phone Number</Label>
                    <Input id="phone" type="text" {...register("phone")} placeholder="e.g. +1 (555) 284-7712" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="alternatePhone" className="font-semibold text-sm">Alternate Phone</Label>
                    <Input id="alternatePhone" type="text" {...register("alternatePhone")} placeholder="e.g. +1 (555) 284-7700" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="website" className="font-semibold text-sm">Website</Label>
                    <Input id="website" type="text" {...register("website")} placeholder="e.g. www.example.com" className="h-10" />
                  </div>
                </div>
              </div>

              {/* Meeting Context Group */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                  Meeting Context (Optional)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="metAt" className="font-semibold text-sm">Met at / Location</Label>
                    <Input id="metAt" {...register("metAt")} placeholder="e.g. Tech Expo, Booth 410" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="contactType" className="font-semibold text-sm">Contact Type</Label>
                    <select
                      id="contactType"
                      {...register("contactType")}
                      className="w-full h-10 px-3 text-sm rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select type…</option>
                      <option value="Prospect">Prospect</option>
                      <option value="Customer">Customer</option>
                      <option value="Supplier">Supplier</option>
                      <option value="Partner">Partner</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="interest" className="font-semibold text-sm">Product or Interest</Label>
                    <Input id="interest" {...register("interest")} placeholder="e.g. Workflow integration" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="relationshipOwner" className="font-semibold text-sm">Relationship Owner</Label>
                    <Input id="relationshipOwner" {...register("relationshipOwner")} placeholder="e.g. Sales Team" className="h-10" />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <Label htmlFor="followUpDate" className="font-semibold text-sm">Suggested Follow-up Date</Label>
                    <Input id="followUpDate" type="date" {...register("followUpDate")} className="h-10" />
                  </div>
                </div>
              </div>

              {/* Location & Notes Group */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                  Address & Notes
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label htmlFor="address" className="font-semibold text-sm">Street Address</Label>
                    <Input id="address" {...register("address")} placeholder="e.g. 1200 Innovation Drive, Suite 410" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="city" className="font-semibold text-sm">City</Label>
                    <Input id="city" {...register("city")} placeholder="e.g. New York" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="country" className="font-semibold text-sm">Country</Label>
                    <Input id="country" {...register("country")} placeholder="e.g. USA" className="h-10" />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <Label htmlFor="notes" className="font-semibold text-sm">Notes</Label>
                    <textarea
                      id="notes"
                      rows={3}
                      {...register("notes")}
                      placeholder="Additional notes or discussion context..."
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-2 border-t bg-slate-50/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md dark:bg-slate-900/95 sm:gap-3 sm:p-4">
          <Button
            type="button"
            variant="outline"
            className="h-10 px-4 rounded-xl text-xs font-semibold border-brand/40 text-brand bg-brand/5 hover:bg-brand/15 hover:border-brand transition-all gap-1.5"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-4 h-4 text-brand" /> Cancel
          </Button>
          <Button
            type="submit"
            form="edit-contact-form"
            className="h-10 px-5 rounded-xl font-bold text-xs bg-brand hover:bg-brand-hover text-white shadow-md shadow-brand/20 gap-1.5"
          >
            <Save className="w-4 h-4 text-white" /> Save Changes
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
