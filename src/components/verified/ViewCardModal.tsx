import { useState, useEffect } from "react";
import { Eye, X, Download, Mail, Phone, MapPin, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ContactRecord } from "@/types";

interface Props {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  record: ContactRecord | null;
}

export default function ViewCardModal({ isOpen, setIsOpen, record }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (record?.originalImage) {
      const url = URL.createObjectURL(record.originalImage);
      setImageUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setImageUrl(null);
    }
  }, [record]);

  if (!record) return null;

  const handleDownloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = record.originalFileName || `card-${record.id}.jpg`;
    a.click();
  };

  const vData = record.verifiedData;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 bg-background shadow-2xl rounded-2xl border">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20 shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Scanned Card Preview</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Scanned on {new Date(record.createdAt).toLocaleDateString()}
                </DialogDescription>
              </div>
            </div>
            {imageUrl && (
              <Button variant="outline" size="sm" onClick={handleDownloadImage}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Download Card
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
          {/* Card Image Display */}
          <div className="lg:w-1/2 p-6 bg-slate-950 flex items-center justify-center relative min-h-[250px] lg:min-h-0 shrink-0">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={vData.fullName || "Business Card"}
                className="max-w-full max-h-full object-contain rounded-lg drop-shadow-2xl border border-slate-800"
              />
            ) : (
              <div className="text-slate-400 text-sm">No image available</div>
            )}
          </div>

          {/* Contact Details Display */}
          <div className="lg:w-1/2 overflow-y-auto p-6 space-y-6 bg-card">
            <div>
              <h3 className="text-2xl font-bold text-foreground">{vData.fullName || "—"}</h3>
              <p className="text-sm font-medium text-primary mt-0.5">{vData.jobTitle || "No Title Specified"}</p>
              <p className="text-sm text-muted-foreground">{vData.companyName || "No Company Specified"}</p>
            </div>

            <div className="space-y-3 pt-2 text-sm border-t">
              {vData.email && (
                <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-primary shrink-0" />
                  <a href={`mailto:${vData.email}`} className="hover:underline truncate">{vData.email}</a>
                </div>
              )}

              {vData.phone && (
                <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <Phone className="w-4 h-4 text-primary shrink-0" />
                  <span>{vData.phone} {vData.alternatePhone && ` / ${vData.alternatePhone}`}</span>
                </div>
              )}

              {vData.website && (
                <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <Globe className="w-4 h-4 text-primary shrink-0" />
                  <a href={vData.website.startsWith("http") ? vData.website : `https://${vData.website}`} target="_blank" rel="noreferrer" className="hover:underline truncate">
                    {vData.website}
                  </a>
                </div>
              )}

              {(vData.address || vData.city || vData.country) && (
                <div className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    {vData.address && <div>{vData.address}</div>}
                    <div>
                      {[vData.city, vData.country].filter(Boolean).join(", ")}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {vData.notes && (
              <div className="pt-3 border-t space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{vData.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-muted/10 flex justify-end shrink-0">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            <X className="w-4 h-4 mr-2" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
