import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Camera,
  UploadCloud,
  X,
  RefreshCw,
  Scan,
  CheckCircle2,
  CameraOff,
  SwitchCamera,
  Users,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import OCRReviewModal from "@/components/scanner/OCRReviewModal";
import { storageService } from "@/lib/db";

// ─── Camera Modal (rendered into document.body via portal) ───────────────────
function CameraModal({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedRef = useRef(false);

  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // ── start / restart stream ──────────────────────────────────────────────────
  const startCamera = useCallback(
    async (mode: "environment" | "user") => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      capturedRef.current = false;
      setStatus("loading");

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch (err: unknown) {
        const e = err as DOMException;
        setStatus("error");
        if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
          setErrorMsg(
            "Camera access was denied. Please allow camera permission in your browser settings and try again."
          );
        } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
          setErrorMsg("No camera found on this device.");
        } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
          setErrorMsg(
            "Camera is currently in use by another application. Please close it and try again."
          );
        } else {
          setErrorMsg(`Camera error: ${e.message || e.name}`);
        }
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;

      await new Promise<void>((resolve) => {
        const onReady = () => {
          video.removeEventListener("loadedmetadata", onReady);
          resolve();
        };
        if (video.readyState >= 1) {
          resolve();
        } else {
          video.addEventListener("loadedmetadata", onReady);
        }
      });

      try {
        await video.play();
      } catch {
        // play() can throw on unmount race — silently ignore
      }

      setStatus("live");
    },
    []
  );

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doCapture = useCallback(() => {
    if (capturedRef.current) return;
    capturedRef.current = true;

    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const cap = document.createElement("canvas");
    cap.width = video.videoWidth;
    cap.height = video.videoHeight;
    const ctx = cap.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    cap.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `card-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        onCapture(file);
      },
      "image/jpeg",
      0.95
    );
  }, [onCapture]);

  const switchCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#090D16",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Full-screen video ── */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: status === "live" ? "block" : "none",
        }}
      />

      {/* ── Business Card Alignment Frame Overlay ── */}
      {status === "live" && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6 z-10">
          <div className="w-full max-w-sm aspect-[1.75/1] rounded-2xl border-2 border-white/60 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]">
            {/* Corner focus brackets */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#007BC2] rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#007BC2] rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#007BC2] rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#007BC2] rounded-br-lg" />

            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/90 text-xs font-semibold uppercase tracking-wider bg-black/50 px-3.5 py-1.5 rounded-full backdrop-blur-md border border-white/20">
                Position Business Card Here
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading state ── */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-[#007BC2] animate-spin" />
          <p className="text-sm font-medium">Initializing camera…</p>
        </div>
      )}

      {/* ── Error state ── */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="bg-red-500/20 p-4 rounded-full">
            <CameraOff className="w-10 h-10 text-red-400" />
          </div>
          <p className="text-white font-bold text-lg">Camera Unavailable</p>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">{errorMsg}</p>
          <button
            onClick={() => startCamera(facingMode)}
            className="mt-2 px-6 py-2.5 rounded-full border border-white/20 text-white text-xs font-semibold hover:bg-white/10 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Top Bar ── */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-white/90 hover:text-white transition-colors text-xs font-semibold py-2 px-4 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <span className="text-white/80 text-xs font-medium tracking-wide hidden sm:block">
          Aventure Aviation Camera Capture
        </span>
      </div>

      {/* ── Bottom HUD ── */}
      <div className="absolute bottom-0 inset-x-0 z-20 p-6 pb-[max(env(safe-area-inset-bottom,24px),24px)] bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col items-center">
        {status === "live" && (
          <div className="flex items-center justify-center w-full max-w-xs relative">
            <button
              onClick={switchCamera}
              className="absolute left-4 w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white backdrop-blur-md border border-white/15"
              title="Switch camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>

            <button
              onClick={doCapture}
              aria-label="Capture"
              className="w-18 h-18 rounded-full flex items-center justify-center bg-white/15 backdrop-blur-md border-2 border-[#007BC2] active:scale-95 transition-all shadow-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-white shadow-xl" />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Main ScanPage ────────────────────────────────────────────────────────────
export default function ScanPage() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [ocrData, setOcrData] = useState<any>(null);
  const [rawText, setRawText] = useState("");
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live query for verified contacts count
  const verifiedContacts = useLiveQuery(() => storageService.getVerifiedContacts());

  const processFile = (file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10 MB.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
    e.target.value = "";
  };

  const handleCameraCapture = (file: File) => {
    setIsCameraOpen(false);
    processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleScan = async () => {
    if (!selectedFile) return;
    setIsScanning(true);
    setScanProgress(15);

    const formData = new FormData();
    formData.append("image", selectedFile);

    const interval = setInterval(() => {
      setScanProgress((p) => (p < 90 ? p + 12 : p));
    }, 350);

    try {
      const response = await fetch("/api/ocr", { method: "POST", body: formData });
      clearInterval(interval);
      setScanProgress(100);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to scan business card");
      }

      const data = await response.json();
      setOcrData(data.parsed);
      setRawText(data.rawText);
      setIsReviewModalOpen(true);
    } catch (error: any) {
      clearInterval(interval);
      toast.error(
        error.message ||
        "Unable to read this card. Check your connection and try again."
      );
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanProgress(0), 500);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  return (
    <>
      {isCameraOpen && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {/* Hidden file input always available */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24 space-y-10">
        {!selectedFile ? (
          /* ── 1. PREMIUM AVENTURE AVIATION WELCOME LANDING SCREEN ── */
          <div className="space-y-8 sm:space-y-10">
            {/* Hero Header & Official Logo */}
            <div className="text-center space-y-5">
              {/* Eyebrow Badge */}
              {/* <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#007BC2]/10 text-[#007BC2] border border-[#007BC2]/25 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#007BC2] animate-pulse" />
                <span className="tracking-wide uppercase text-[11px] font-bold">
                  Aventure Aviation • Enterprise Contact Capture
                </span>
              </div> */}

              {/* Official Aventure Aviation Logo Asset */}
              {/* <div className="flex justify-center items-center py-2">
                <img
                  src="/Picture1.png"
                  alt="Aventure Aviation"
                  className="h-14 sm:h-20 md:h-24 w-auto object-contain max-w-[85vw] sm:max-w-md filter drop-shadow-xs transition-transform duration-300 hover:scale-102"
                />
              </div> */}

              {/* Hero Headings */}
              <div className="space-y-3 max-w-3xl mx-auto">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.18]">
                  Turn business cards into<br className="hidden sm:block" />{" "}
                  <span className="text-[#007BC2] bg-gradient-to-r from-[#007BC2] to-[#2E3192] bg-clip-text text-transparent inline-block">
                    verified contacts.
                  </span>
                </h1>
                <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base md:text-lg max-w-3xl mx-auto leading-relaxed font-normal md:whitespace-nowrap">
                  Scan or upload a business card to extract, review, and save verified contact details.
                </p>
              </div>

            </div>

            {/* Interactive Scanning Visual & Primary / Secondary CTAs Card */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl shadow-slate-200/50 dark:shadow-none p-6 sm:p-10 text-center overflow-hidden transition-all duration-300 hover:border-[#007BC2]/40 group"
            >
              {/* Subtle Aviation/Scanning Backdrop Gradients */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#007BC2]/5 via-transparent to-transparent opacity-60" />
              <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-[#007BC2]/10 blur-3xl pointer-events-none" />
              <div className="absolute -left-16 -bottom-16 w-48 h-48 rounded-full bg-[#2E3192]/10 blur-3xl pointer-events-none" />

              {/* Business Card Scanning Frame Representation */}
              <div className="relative max-w-sm mx-auto mb-8 p-5 sm:p-6 rounded-2xl border-2 border-dashed border-[#007BC2]/40 bg-slate-50/80 dark:bg-slate-950/60 shadow-inner group-hover:border-[#007BC2] transition-colors duration-300">
                {/* Corner Bracket Reticles */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-[#007BC2] rounded-tl-md" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-[#007BC2] rounded-tr-md" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-[#007BC2] rounded-bl-md" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-[#007BC2] rounded-br-md" />

                {/* Laser scan line animation */}
                <div className="animate-scanline opacity-80" />

                {/* Card Mockup Graphic */}
                <div className="flex flex-col gap-2.5 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#007BC2]/15 text-[#007BC2] flex items-center justify-center font-bold text-xs">
                        AA
                      </div>
                      <div>
                        <div className="h-2.5 w-24 bg-slate-800 dark:bg-slate-200 rounded-full" />
                        <div className="h-2 w-16 bg-slate-300 dark:bg-slate-700 rounded-full mt-1" />
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-[#007BC2] uppercase tracking-wider bg-[#007BC2]/10 px-2 py-0.5 rounded-full">
                      OCR Ready
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-0.5">
                    <div className="h-2 w-36 bg-slate-300 dark:bg-slate-700 rounded-full" />
                    <div className="h-2 w-28 bg-slate-200 dark:bg-slate-800 rounded-full" />
                  </div>
                </div>
              </div>

              {/* CTAs Action Buttons Container */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full max-w-sm sm:max-w-md mx-auto relative z-10 pt-2">
                {/* Primary Action: Scan Business Card */}
                <Button
                  size="lg"
                  className="w-full sm:flex-1 h-14 px-6 text-base sm:text-lg font-bold bg-[#007BC2] hover:bg-[#0064a0] active:scale-[0.98] text-white !rounded-2xl shadow-lg shadow-[#007BC2]/25 hover:shadow-xl hover:shadow-[#007BC2]/35 transition-all gap-3 border-0 flex items-center justify-center"
                  onClick={() => setIsCameraOpen(true)}
                >
                  <Camera className="w-5 h-5 text-white shrink-0" />
                  <span>Scan Business Card</span>
                </Button>

                {/* Secondary Action: Upload Card */}
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:flex-1 h-14 px-6 text-base sm:text-lg font-bold border-2 border-[#007BC2]/35 hover:border-[#007BC2] hover:bg-[#007BC2]/5 active:scale-[0.98] text-[#007BC2] dark:text-slate-100 !rounded-2xl transition-all gap-3 flex items-center justify-center bg-white dark:bg-slate-900 shadow-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="w-5 h-5 text-[#007BC2] shrink-0" />
                  <span>Upload Card</span>
                </Button>
              </div>


              <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 font-medium">
                Supports JPG, PNG or WEBP up to 10 MB. Drag & drop image anywhere above.
              </p>
            </div>

            {/* Real Verified Contacts Summary */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs">
              {verifiedContacts && verifiedContacts.length > 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                  <div className="flex items-center gap-3 text-left w-full sm:w-auto min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between sm:justify-start gap-2 w-full">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                          Verified Contacts
                        </h4>
                        <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                          {verifiedContacts.length} {verifiedContacts.length === 1 ? 'Saved' : 'Saved'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 hidden sm:block">
                        Access and export your extracted business contact queue anytime.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/verified')}
                    className="h-10 px-4 text-xs font-semibold rounded-xl border-slate-300 dark:border-slate-700 gap-1.5 shrink-0 hover:bg-[#007BC2]/10 hover:text-[#007BC2] hover:border-[#007BC2]/40 transition-colors w-full sm:w-auto"
                  >
                    View Contacts <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                        No contacts saved yet
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Your verified contacts will appear here after your first scan.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/verified')}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    View Queue →
                  </Button>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* ── 2. CARD LOADED & OCR PROCESSING WORKFLOW ── */
          <div className="rounded-3xl border border-border bg-card shadow-xl overflow-hidden">
            <div className="flex flex-col md:flex-row md:h-80">
              {/* Card Image Preview with Scanning Animation */}
              <div className="md:w-5/12 bg-slate-100/80 dark:bg-slate-900/50 border-b md:border-b-0 md:border-r border-border flex items-center justify-center p-6 min-h-[220px] md:min-h-0 shrink-0 relative overflow-hidden">
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Business Card Preview"
                    className="max-h-full max-w-full object-contain rounded-xl shadow-md border border-slate-200 dark:border-slate-800"
                  />
                )}
                {/* Laser scan line sweep when scanning */}
                {isScanning && <div className="animate-scanline" />}
              </div>

              {/* Status Details & Actions */}
              <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between gap-6 bg-background">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-foreground">Card Image Loaded</h3>
                        <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>

                  {/* Processing Status Checklist */}
                  {isScanning ? (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
                      <div className="flex justify-between text-xs font-bold text-foreground">
                        <span className="flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#007BC2]" />
                          Analyzing business card…
                        </span>
                        <span>{scanProgress}%</span>
                      </div>
                      <Progress value={scanProgress} className="h-2 rounded-full" />
                      <div className="space-y-1 pt-1 text-xs text-muted-foreground">
                        <p className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                          <span>✓</span> Image uploaded & validated
                        </p>
                        <p className="flex items-center gap-2 text-foreground font-medium">
                          <span>●</span> Extracting text & contact information...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs text-muted-foreground leading-relaxed">
                      Ready to process card details using server-side OCR engine.
                    </div>
                  )}
                </div>

                {/* Primary & Action Buttons */}
                <div className="flex gap-2.5 pt-2">
                  <Button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="flex-1 h-11 text-xs font-bold gap-2 rounded-xl bg-[#007BC2] hover:bg-[#0064a0] text-white shadow-md shadow-[#007BC2]/20"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Processing OCR…
                      </>
                    ) : (
                      <>
                        <Scan className="w-4 h-4" />
                        Scan & Extract Contact
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={clearSelection}
                    disabled={isScanning}
                    className="h-11 w-11 rounded-xl p-0"
                    title="Change card / Return to welcome screen"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsCameraOpen(true)}
                    disabled={isScanning}
                    className="h-11 w-11 rounded-xl p-0"
                    title="Retake camera capture"
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <OCRReviewModal
        isOpen={isReviewModalOpen}
        setIsOpen={setIsReviewModalOpen}
        ocrData={ocrData}
        rawText={rawText}
        originalImage={selectedFile!}
        imageUrl={previewUrl!}
        onSuccess={() => {
          setIsReviewModalOpen(false);
          clearSelection();
        }}
      />
    </>
  );
}


