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
      <DialogContent className="sm:max-w-[480px] p-6 rounded-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Possible existing contact found
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {matchReason ? `${matchReason}. Please review it before creating a second record.` : "Please review it before creating a second record."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Existing Contact Summary Card */}
        <div className="my-2 p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Existing Saved Contact
            </span>
            <span className="text-[11px] text-muted-foreground">
              Saved {new Date(existingContact.createdAt).toLocaleDateString()} at {new Date(existingContact.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>

          <div className="flex items-start gap-3 pt-1">
            <div className="w-9 h-9 rounded-full bg-amber-200/60 dark:bg-amber-800/40 flex items-center justify-center shrink-0 text-amber-800 dark:text-amber-200 font-bold text-sm">
              {v.fullName ? v.fullName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-foreground truncate">
                {v.fullName || "Unnamed Contact"}
              </h4>
              {v.jobTitle && (
                <p className="text-xs text-muted-foreground truncate">{v.jobTitle}</p>
              )}
              {v.companyName && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <Building2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{v.companyName}</span>
                </div>
              )}
              {v.email && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Mail className="w-3 h-3 shrink-0 text-amber-600" />
                  <span className="truncate">{v.email}</span>
                </div>
              )}
              {v.phone && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span>{v.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-10 w-full rounded-xl border-slate-900/30 bg-slate-900/5 px-3 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white hover:border-slate-900 hover:bg-slate-900/10 dark:hover:bg-slate-800 sm:w-auto cursor-pointer"
          >
            Go back and edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onViewExisting}
            className="h-10 w-full rounded-xl border-slate-900/30 px-3 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:text-white hover:bg-slate-900/10 dark:hover:bg-slate-800 sm:w-auto cursor-pointer"
          >
            Review existing contact
          </Button>
          <Button
            size="sm"
            onClick={onSaveAnyway}
            className="h-10 w-full rounded-xl bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 px-4 text-xs font-bold text-white dark:text-slate-900 shadow-xs sm:w-auto cursor-pointer"
          >
            Save as a new contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
