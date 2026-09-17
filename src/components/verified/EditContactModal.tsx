import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Save, X, UserCheck, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { storageService } from "@/lib/db";
import type { ContactRecord, OCRData } from "@/types";

interface Props {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  record: ContactRecord | null;
  onSuccess?: () => void;
}

export default function EditContactModal({ isOpen, setIsOpen, record, onSuccess }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

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
      notes: ""
    }
  });

  useEffect(() => {
    if (isOpen && record) {
      reset(record.verifiedData);
      if (record.originalImage) {
        const url = URL.createObjectURL(record.originalImage);
        setImageUrl(url);
        return () => {
          URL.revokeObjectURL(url);
        };
      } else {
        setImageUrl(null);
      }
    }
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
        notes: data.notes?.trim() || "",
      };

      await storageService.updateRecord(record.id, {
        verifiedData: updatedVerifiedData,
        verifiedAt: new Date().toISOString()
      });

      toast.success("Contact details updated successfully.");
      setIsOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error("Failed to update contact. Please try again.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-0 bg-background shadow-2xl rounded-2xl border">
        {/* Header */}
        <DialogHeader className="p-5 md:p-6 pb-4 border-b bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl text-primary shrink-0">
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
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0 bg-slate-50/50">
          {/* Card Image Reference Panel */}
          {imageUrl && (
            <div className="lg:w-5/12 p-4 md:p-6 bg-slate-100/70 dark:bg-slate-900/40 flex flex-col justify-center items-center border-b lg:border-b-0 lg:border-r border-border overflow-hidden min-h-[200px] lg:min-h-0 shrink-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5 self-start">
                <CreditCard className="w-3.5 h-3.5 text-primary" /> Scanned Card Reference
              </div>
              <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
                <img
                  src={imageUrl}
                  alt="Business Card Reference"
                  className="max-w-full max-h-full object-contain rounded-xl shadow-md border border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>
          )}

          {/* Form Panel */}
          <div className={`overflow-y-auto p-5 md:p-6 bg-background flex-1 ${!imageUrl ? 'w-full' : ''}`}>
            <form id="edit-contact-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Identity Group */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                  Identity Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label htmlFor="fullName" className="font-semibold text-sm">Full Name</Label>
                    <Input id="fullName" {...register("fullName")} placeholder="e.g. Qazi Nauman Mujahid" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="companyName" className="font-semibold text-sm">Company Name</Label>
                    <Input id="companyName" {...register("companyName")} placeholder="e.g. Digitech Infra" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="jobTitle" className="font-semibold text-sm">Job Title</Label>
                    <Input id="jobTitle" {...register("jobTitle")} placeholder="e.g. Chief Executive Officer" className="h-10" />
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
                    <Input id="email" type="text" {...register("email")} placeholder="e.g. nauman@digitechinfra.com" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="font-semibold text-sm">Phone Number</Label>
                    <Input id="phone" type="text" {...register("phone")} placeholder="e.g. +92 317 6688855" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="alternatePhone" className="font-semibold text-sm">Alternate Phone</Label>
                    <Input id="alternatePhone" type="text" {...register("alternatePhone")} placeholder="e.g. +92 300 1234567" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="website" className="font-semibold text-sm">Website</Label>
                    <Input id="website" type="text" {...register("website")} placeholder="e.g. www.digitechinfra.com" className="h-10" />
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
                    <Input id="address" {...register("address")} placeholder="e.g. Suite 400, Tech Tower" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="city" className="font-semibold text-sm">City</Label>
                    <Input id="city" {...register("city")} placeholder="e.g. Karachi" className="h-10" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="country" className="font-semibold text-sm">Country</Label>
                    <Input id="country" {...register("country")} placeholder="e.g. Pakistan" className="h-10" />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <Label htmlFor="notes" className="font-semibold text-sm">Notes</Label>
                    <textarea
                      id="notes"
                      rows={3}
                      {...register("notes")}
                      placeholder="Additional notes or meeting context..."
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/10 flex justify-end gap-3 shrink-0">
          <Button type="button" variant="outline" className="rounded-xl text-xs font-semibold" onClick={() => setIsOpen(false)}>
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
          <Button type="submit" form="edit-contact-form" className="h-10 px-5 rounded-xl font-bold text-xs bg-[#007BC2] hover:bg-[#0064a0] text-white shadow-md shadow-[#007BC2]/20">
            <Save className="w-4 h-4 mr-2" /> Save Changes
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
