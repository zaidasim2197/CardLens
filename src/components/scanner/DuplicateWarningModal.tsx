import { AlertTriangle, User, Building2, Mail, Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ContactRecord } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  existingContact: ContactRecord | null;
  matchReason?: string;
  onSaveAnyway: () => void;
  onViewExisting: () => void;
}

export default function DuplicateWarningModal({
  isOpen,
  onClose,
  existingContact,
  matchReason,
  onSaveAnyway,
  onViewExisting,
}: Props) {
  if (!existingContact) return null;
  const v = existingContact.verifiedData;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[92vw] sm:max-w-[490px] p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-border shadow-2xl bg-background max-h-[90dvh] overflow-y-auto">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground leading-snug">
                Possible existing contact found.
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Please review it before creating a second record.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Clear Match Reason Banner */}
        <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-300/60 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 font-medium flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          <span className="break-all">{matchReason || "A contact with matching details was found."}</span>
        </div>

        {/* Existing Contact Summary Card */}
        <div className="my-2 p-3.5 sm:p-4 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Existing Saved Record
            </span>
            <span>
              {new Date(existingContact.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div className="flex items-start gap-3 pt-1">
            <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0 font-bold text-sm">
              {v.fullName ? v.fullName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <h4 className="text-sm font-bold text-foreground truncate">
                {v.fullName || "Unnamed Contact"}
              </h4>
              {v.jobTitle && (
                <p className="text-xs text-muted-foreground truncate">{v.jobTitle}</p>
              )}
              {v.companyName && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{v.companyName}</span>
                </div>
              )}
              {v.email && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <Mail className="w-3.5 h-3.5 shrink-0 text-brand" />
                  <span className="truncate">{v.email}</span>
                </div>
              )}
              {v.phone && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <Phone className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span>{v.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 flex flex-col gap-2.5 sm:flex-col">
          <Button
            size="default"
            onClick={onViewExisting}
            className="h-11 w-full rounded-xl bg-brand px-4 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-brand-hover transition-colors"
          >
            Review existing contact
          </Button>
          <Button
            variant="outline"
            size="default"
            onClick={onSaveAnyway}
            className="h-11 w-full rounded-xl border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 text-xs sm:text-sm font-semibold text-foreground transition-colors"
          >
            Save as a new contact
          </Button>
          <Button
            variant="ghost"
            size="default"
            onClick={onClose}
            className="h-10 w-full rounded-xl text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Go back and edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
