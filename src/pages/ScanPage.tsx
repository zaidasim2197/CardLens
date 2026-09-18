import { hasReadableContact, NO_CONTACT_MESSAGE } from "../../shared/contactValidation.mjs";
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
  AlertTriangle,
  Play,
  Edit3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import OCRReviewModal from "@/components/scanner/OCRReviewModal";
import { storageService } from "@/lib/db";
import { cropBusinessCardImage } from "@/lib/imageCrop";
import { cn } from "@/lib/utils";
import type { OCRData } from "@/types";

// ─── Synthetic Demo Contact (Completely Zero OCR) ─────────────────────────────
const PREPARED_DEMO_CONTACT: OCRData = {
  fullName: "Daniel Rahman",
  jobTitle: "Business Development Manager",
  companyName: "AeroSyn Tech Solutions",
  phone: "+1 (555) 284-7712",
  alternatePhone: "+1 (555) 284-7700",
  email: "daniel.rahman@aerosyntech.com",
  // Deliberate single-character OCR mistake to demonstrate the review step.
  website: "www.aerosynteeh.com",
  address: "425 Madison Avenue, Suite 1200, New York, NY 10017, USA",
  city: "New York",
  country: "USA",
  metAt: "Enterprise Tech Showcase 2026",
  contactType: "Prospect",
  interest: "Workflow Automation & Contact Review",
  relationshipOwner: "V71 Team",
  notes: "Met at showcase booth. Requested a prototype walkthrough for the Q3 pipeline review.",
  followUpDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  isDemo: true,
};

const DEMO_RAW_TEXT = `AeroSyn Tech Solutions
IDEAS FOR A BRIGHTER TOMORROW
PEOPLE TECHNOLOGY PROGRESS

Daniel Rahman
Business Development Manager

Mobile: +1 (555) 284-7712
Office: +1 (555) 284-7700
Email: daniel.rahman@aerosyntech.com
Web: www.aerosyntech.com
Address: 425 Madison Avenue, Suite 1200, New York, NY 10017, USA

A SMARTER TOMORROW TOGETHER`;

// ─── Camera Modal (rendered into document.body via portal) ───────────────────
function CameraModal({
  onCapture,
  onClose,
  onTryDemo,
  onUploadImage,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
  onTryDemo: () => void;
  onUploadImage: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardFrameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedRef = useRef(false);

  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

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
            "Camera access was denied. Please allow camera permission in browser settings, or use the demo card below."
          );
        } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
          setErrorMsg("No camera found on this device.");
        } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
          setErrorMsg("Camera is in use by another app. Close it and try again.");
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
        // silently ignore
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
  }, [facingMode, startCamera]);

  const doCapture = useCallback(() => {
    if (capturedRef.current) return;

    const video = videoRef.current;
    const cardFrame = cardFrameRef.current;
    if (!video || !video.videoWidth || !cardFrame) return;

    capturedRef.current = true;

    const videoRect = video.getBoundingClientRect();
    const frameRect = cardFrame.getBoundingClientRect();
    const coverScale = Math.max(
      videoRect.width / video.videoWidth,
      videoRect.height / video.videoHeight
    );
    const renderedWidth = video.videoWidth * coverScale;
    const renderedHeight = video.videoHeight * coverScale;
    const renderedOffsetX = (videoRect.width - renderedWidth) / 2;
    const renderedOffsetY = (videoRect.height - renderedHeight) / 2;

    const requestedX = (frameRect.left - videoRect.left - renderedOffsetX) / coverScale;
    const requestedY = (frameRect.top - videoRect.top - renderedOffsetY) / coverScale;
    const sourceX = Math.max(0, requestedX);
    const sourceY = Math.max(0, requestedY);
    const sourceWidth = Math.min(frameRect.width / coverScale, video.videoWidth - sourceX);
    const sourceHeight = Math.min(frameRect.height / coverScale, video.videoHeight - sourceY);

    const cap = document.createElement("canvas");
    cap.width = Math.max(1, Math.round(sourceWidth));
    cap.height = Math.max(1, Math.round(sourceHeight));
    const ctx = cap.getContext("2d")!;
    ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, cap.width, cap.height);

    cap.toBlob(
      (blob) => {
        if (!blob) {
          capturedRef.current = false;
          return;
        }
        const file = new File([blob], `card-${Date.now()}-cropped.jpg`, {
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
        background: "#181817",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Video stream */}
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

      {/* Frame Reticle Overlay */}
      {status === "live" && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6 z-10">
          <div
            ref={cardFrameRef}
            className="w-full max-w-sm aspect-[1.75/1] rounded-2xl border-2 border-white/60 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
          >
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white/90 rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white/90 rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white/90 rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white/90 rounded-br-lg" />

            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/90 text-xs font-semibold tracking-wide bg-black/50 px-3.5 py-1.5 rounded-full backdrop-blur-md border border-white/20">
                Position Business Card
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <p className="text-sm font-medium">Initializing camera…</p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center max-w-md mx-auto">
          <div className="bg-red-500/20 p-4 rounded-full">
            <CameraOff className="w-10 h-10 text-red-400" />
          </div>
          <p className="text-white font-bold text-lg">Camera Unavailable</p>
          <p className="text-white/60 text-xs sm:text-sm leading-relaxed">{errorMsg}</p>
          <div className="flex flex-col gap-2 w-full pt-2">
            <button
              onClick={() => startCamera(facingMode)}
              className="w-full h-11 rounded-xl bg-brand text-white text-xs sm:text-sm font-bold hover:bg-brand-hover transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => {
                onClose();
                onTryDemo();
              }}
              className="w-full h-11 rounded-xl border border-white/20 bg-white/10 text-white text-xs sm:text-sm font-semibold hover:bg-white/15 transition-colors"
            >
              Try Demo Card (No Camera Needed)
            </button>
            <button
              onClick={() => {
                onClose();
                onUploadImage();
              }}
              className="w-full h-10 rounded-xl text-white/70 hover:text-white text-xs font-medium transition-colors"
            >
              Upload Card Image Instead
            </button>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-white/90 hover:text-white transition-colors text-xs font-semibold py-2 px-4 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <span className="text-white/80 text-xs font-medium tracking-wide hidden sm:block">
          CardSnap Camera Capture
        </span>
      </div>

      {/* Bottom HUD */}
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
              className="w-18 h-18 rounded-full flex items-center justify-center bg-white/15 backdrop-blur-md border-2 border-white/80 active:scale-95 transition-all shadow-2xl"
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

// ─── Main ScanPage Component ──────────────────────────────────────────────────
export default function ScanPage() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [ocrData, setOcrData] = useState<OCRData | null>(null);
  const [rawText, setRawText] = useState("");
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // States: "idle" | "card_selected" | "failure"
  const [viewState, setViewState] = useState<"idle" | "card_selected" | "failure">("idle");
  const [failureError, setFailureError] = useState<string>("");
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [demoStage, setDemoStage] = useState<"detecting" | "extracting" | "parsing" | "done">("detecting");
  const [isManualEntry, setIsManualEntry] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live query for reviewed contacts
  const reviewedContacts = useLiveQuery(() => storageService.getVerifiedContacts());

  // ─── Real Upload Processing ─────────────────────────────────────────────────
  const processFile = async (file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10 MB.");
      return;
    }
    try {
      const croppedFile = await cropBusinessCardImage(file, file.name);
      if (previewUrl && !isDemoMode) URL.revokeObjectURL(previewUrl);
      setSelectedFile(croppedFile);
      setPreviewUrl(URL.createObjectURL(croppedFile));
      setIsDemoMode(false);
      setIsManualEntry(false);
      setViewState("card_selected");
    } catch {
      triggerFailure("We could not prepare this image. Please try another photo.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) void processFile(e.target.files[0]);
    e.target.value = "";
  };

  const handleCameraCapture = (file: File) => {
    setIsCameraOpen(false);
    void processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void processFile(file);
  };

  // ─── Real Scan / OCR API Call ───────────────────────────────────────────────
  const handleRealScan = async () => {
    if (!selectedFile) return;
    setIsReviewModalOpen(false);
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
      if (!hasReadableContact(data.rawText, data.parsed)) {
        throw new Error(NO_CONTACT_MESSAGE);
      }
      setOcrData(data.parsed);
      setRawText(data.rawText);
      setIsDemoMode(false);
      setIsManualEntry(false);
      setIsReviewModalOpen(true);
      setViewState("idle");
    } catch (error: unknown) {
      clearInterval(interval);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to read this card. Check your connection and try again.";
      triggerFailure(message);
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanProgress(0), 500);
    }
  };

  // ─── Deterministic Demo Flow (ZERO OCR REQUESTS, REALISTIC IN-PLACE ANIMATION) ────────
  const handleTryDemo = () => {
    if (isDemoRunning) return;
    setIsDemoMode(true);
    setIsManualEntry(false);
    setIsDemoRunning(true);
    setDemoStage("detecting");

    // Preload demo card image for modal review
    setPreviewUrl("/demo-card.png");
    setSelectedFile(null);

    // Step 1: Detect card edges in reticle (0ms -> 950ms)
    // Step 2: Optical text line extraction (950ms -> 2000ms)
    setTimeout(() => {
      setDemoStage("extracting");
    }, 950);

    // Step 3: Entity structuring (Name, Phone, Email, Address) (2000ms -> 2900ms)
    setTimeout(() => {
      setDemoStage("parsing");
    }, 2000);

    // Step 4: Verification pass complete (2900ms -> 3450ms)
    setTimeout(() => {
      setDemoStage("done");
      setOcrData(PREPARED_DEMO_CONTACT);
      setRawText(DEMO_RAW_TEXT);
    }, 2900);

    // Step 5: Smoothly present the contact review modal
    setTimeout(() => {
      setIsDemoRunning(false);
      setIsReviewModalOpen(true);
    }, 3450);
  };

  // ─── Manual Entry Flow ──────────────────────────────────────────────────────
  const handleManualEntry = () => {
    setIsDemoMode(false);
    setIsManualEntry(true);
    setOcrData({
      fullName: "",
      companyName: "",
      jobTitle: "",
      email: "",
      phone: "",
      alternatePhone: "",
      website: "",
      address: "",
      city: "",
      country: "",
      notes: "",
      metAt: "",
      contactType: "",
      interest: "",
      relationshipOwner: "",
      followUpDate: "",
    });
    setRawText("");
    setSelectedFile(null);
    setPreviewUrl(null);
    setViewState("idle");
    setIsReviewModalOpen(true);
  };

  // ─── Failure / Recovery Trigger ─────────────────────────────────────────────
  const triggerFailure = (msg?: string) => {
    setFailureError(
      msg || "The image may be unclear or could not be processed. Try again or choose another option."
    );
    setViewState("failure");
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (previewUrl && !isDemoMode) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setViewState("idle");
  };

  return (
    <>
      {isCameraOpen && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setIsCameraOpen(false)}
          onTryDemo={handleTryDemo}
          onUploadImage={() => fileInputRef.current?.click()}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
      />

      <div className="scan-workspace max-w-xl mx-auto py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* ── STATE A: IDLE / LANDING SCREEN (Mobile-First, Spacious, Minimal) ── */}
        {viewState === "idle" && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
            {/* Headline & Short Supporting Copy */}
            <div className="scan-intro text-center space-y-3 pt-2 sm:pt-4">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.2]">
                Turn business cards into{" "}
                <span className="headline-accent inline-block">
                  reviewed contacts.
                </span>
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm md:text-base max-w-md mx-auto leading-relaxed">
                Capture a card. Refine the details. Keep the connection.
              </p>
            </div>

            {/* Clean Business-Card Preview / Capture Area */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="capture-surface relative rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 sm:p-7 shadow-xs hover:border-brand/40 transition-colors text-center overflow-hidden"
            >
              {/* Card visual container with corner brackets and real demo card */}
              <div
                onClick={() => {
                  if (!isDemoRunning) handleTryDemo();
                }}
                className={cn(
                  "card-stage relative max-w-sm sm:max-w-md mx-auto mb-6 p-2.5 sm:p-3 rounded-2xl sm:rounded-3xl border transition-all duration-300 group select-none",
                  isDemoRunning
                    ? "border-brand bg-brand/5 shadow-md shadow-brand/10"
                    : "border-slate-200 dark:border-slate-800 hover:border-brand/60 bg-slate-50/70 dark:bg-slate-950/40 cursor-pointer"
                )}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!isDemoRunning) handleTryDemo();
                  }
                }}
                aria-label="Try demo card"
              >
                {/* Corner focus brackets */}
                <div
                  className={cn(
                    "absolute -top-1 -left-1 w-4.5 h-4.5 border-t-3 border-l-3 rounded-tl-sm transition-colors duration-300",
                    isDemoRunning
                      ? "border-brand"
                      : "border-slate-400 dark:border-slate-600 group-hover:border-brand"
                  )}
                />
                <div
                  className={cn(
                    "absolute -top-1 -right-1 w-4.5 h-4.5 border-t-3 border-r-3 rounded-tr-sm transition-colors duration-300",
                    isDemoRunning
                      ? "border-brand"
                      : "border-slate-400 dark:border-slate-600 group-hover:border-brand"
                  )}
                />
                <div
                  className={cn(
                    "absolute -bottom-1 -left-1 w-4.5 h-4.5 border-b-3 border-l-3 rounded-bl-sm transition-colors duration-300",
                    isDemoRunning
                      ? "border-brand"
                      : "border-slate-400 dark:border-slate-600 group-hover:border-brand"
                  )}
                />
                <div
                  className={cn(
                    "absolute -bottom-1 -right-1 w-4.5 h-4.5 border-b-3 border-r-3 rounded-br-sm transition-colors duration-300",
                    isDemoRunning
                      ? "border-brand"
                      : "border-slate-400 dark:border-slate-600 group-hover:border-brand"
                  )}
                />

                {/* The Demo Card Container - perfectly framed without background, realistic paper shadow */}
                <div className="relative w-full aspect-[936/548] rounded-xl sm:rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-200/90 dark:border-slate-700/80 flex items-center justify-center">
                  <img
                    src="/demo-card.png"
                    alt="Demo Card - Daniel Rahman, AeroSyn Tech Solutions"
                    className="w-full h-full object-contain pointer-events-none"
                  />

                  {/* In-place Laser Scanning Animation (NO SEPARATE SCREEN) */}
                  {isDemoRunning && (
                    <>
                      {/* Laser beam */}
                      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-brand to-transparent shadow-[0_0_16px_4px_rgba(36,35,33,0.18)] animate-scanline pointer-events-none z-10" />
                      <div className="absolute inset-0 bg-brand/5 pointer-events-none" />

                      {/* In-place status pill */}
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 backdrop-blur-[1.5px] transition-all z-20">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white shadow-xl border border-slate-200/80 dark:border-slate-700 text-xs font-bold tracking-tight animate-in zoom-in-95 duration-200">
                          {demoStage === "detecting" ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand" />
                              <span>Detecting business card…</span>
                            </>
                          ) : demoStage === "extracting" ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand" />
                              <span>Reading contact details…</span>
                            </>
                          ) : demoStage === "parsing" ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand" />
                              <span>Structuring contact fields…</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Contact ready!</span>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Professional Demo Indicator placed cleanly below the card */}
              <div className="flex items-center justify-center -mt-2 mb-6">
                <span
                  className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-medium border border-slate-200/80 dark:border-slate-700/60"
                >
                  Demo card
                </span>
              </div>

              {/* Action Buttons (Hierarchy: Primary Scan -> Secondary Upload -> Tertiary Demo) */}
              <div className="flex flex-col gap-2.5 w-full max-w-sm mx-auto">
                {/* 1. Primary CTA: Scan a business card */}
                <Button
                  size="lg"
                  disabled={isDemoRunning}
                  className="w-full h-12 sm:h-13 text-sm sm:text-base font-bold bg-brand hover:bg-brand-hover active:scale-[0.99] text-white rounded-2xl shadow-md shadow-brand/20 transition-all gap-2.5 flex items-center justify-center min-h-[48px]"
                  onClick={() => setIsCameraOpen(true)}
                >
                  <Camera className="w-4 h-4 text-white shrink-0" />
                  <span>Scan a business card</span>
                </Button>

                {/* 2. Secondary CTA: Upload a card image */}
                <Button
                  variant="outline"
                  size="lg"
                  disabled={isDemoRunning}
                  className="w-full h-12 sm:h-13 text-sm sm:text-base font-semibold border border-slate-200 dark:border-slate-700 hover:border-brand/60 hover:bg-brand/5 active:scale-[0.99] text-slate-800 dark:text-slate-200 rounded-2xl transition-all gap-2.5 flex items-center justify-center bg-white dark:bg-slate-900 min-h-[48px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="w-4 h-4 text-brand shrink-0" />
                  <span>Upload a card image</span>
                </Button>

                {/* 3. Tertiary CTA: Try demo card */}
                <Button
                  variant="ghost"
                  size="default"
                  disabled={isDemoRunning}
                  className="w-full h-11 text-xs sm:text-sm font-semibold text-brand hover:bg-brand/10 rounded-xl transition-all gap-2 flex items-center justify-center mt-1"
                  onClick={handleTryDemo}
                >
                  {isDemoRunning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand" />
                      <span>Reading demo card…</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-brand fill-brand/20" />
                      <span>Try demo card</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Minimal Supporting Copy */}
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 font-medium">
                JPG, PNG or WEBP · Up to 10 MB. You can also drag & drop.
              </p>
            </div>

            {/* Reviewed Contacts Summary Panel */}
            <div className="collection-summary rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-4 sm:p-5 shadow-2xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                        Reviewed contacts
                      </h4>
                      {reviewedContacts && reviewedContacts.length > 0 && (
                        <span className="px-2 py-0.2 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {reviewedContacts.length}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Stored in this demo browser only.
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/verified")}
                  className="h-9 px-3 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-700 text-brand hover:bg-brand/10 transition-colors shrink-0"
                >
                  View <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STATE B: REAL CARD LOADED & READY FOR OCR ── */}
        {viewState === "card_selected" && selectedFile && (
          <div className="rounded-3xl border border-border bg-card shadow-xl overflow-hidden animate-in fade-in duration-200">
            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-foreground">
                      Card Image Loaded
                    </h3>
                    <p className="text-[11px] text-muted-foreground break-all">
                      {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  aria-label="Choose another image"
                  className="h-11 w-11 p-0 rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Image Preview with scanning line if running */}
              <div className="relative rounded-2xl overflow-hidden border border-border bg-slate-100 dark:bg-slate-900 aspect-[1.75/1] flex items-center justify-center">
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Card Preview"
                    className="max-h-full max-w-full object-contain"
                  />
                )}
                {isScanning && <div className="animate-scanline" />}
              </div>

              {/* Scanning status */}
              {isScanning ? (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border space-y-2">
                  <div className="flex justify-between text-xs font-bold text-foreground">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand" />
                      Extracting contact details…
                    </span>
                    <span>{scanProgress}%</span>
                  </div>
                  <Progress value={scanProgress} className="h-2 rounded-full" />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  Review before saving. OCR extracts details for your confirmation.
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2.5 pt-1">
                <Button
                  onClick={handleRealScan}
                  disabled={isScanning}
                  className="flex-1 h-12 text-xs sm:text-sm font-bold gap-2 rounded-xl bg-brand hover:bg-brand-hover text-white shadow-md shadow-brand/20"
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
                  className="h-12 w-12 rounded-xl p-0 shrink-0"
                  title="Choose another image"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STATE D: FAILURE / RECOVERY EXPERIENCE (4 Distinct Actions) ── */}
        {viewState === "failure" && (
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 text-center space-y-6 shadow-xl animate-in zoom-in-95 duration-200 max-w-md mx-auto">
            {/* Warning Icon */}
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            {/* Error Copy */}
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                We couldn’t read this card.
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {failureError ||
                  "The image may be unclear or could not be processed. Try again or choose another option."}
              </p>
            </div>

            {/* 4 Hierarchical Recovery Actions */}
            <div className="flex flex-col gap-2.5 w-full pt-1">
              {/* 1. Primary: Try again */}
              <Button
                size="lg"
                onClick={() => {
                  setViewState("idle");
                  setIsCameraOpen(true);
                }}
                className="w-full h-12 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-xs sm:text-sm min-h-[44px]"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try again
              </Button>

              {/* 2. Secondary: Upload another image */}
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setViewState("idle");
                  fileInputRef.current?.click();
                }}
                className="w-full h-12 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground font-semibold text-xs sm:text-sm min-h-[44px]"
              >
                <UploadCloud className="w-4 h-4 mr-2 text-brand" />
                Upload another image
              </Button>

              {/* 3. Tertiary: Use demo card */}
              <Button
                variant="outline"
                size="default"
                onClick={handleTryDemo}
                className="w-full h-11 rounded-xl border-brand/30 bg-brand/5 hover:bg-brand/15 text-brand font-semibold text-xs sm:text-sm min-h-[44px]"
              >
                <Play className="w-3.5 h-3.5 mr-2" />
                Use demo card
              </Button>

              {/* 4. Quiet Tertiary: Enter details manually */}
              <Button
                variant="ghost"
                size="default"
                onClick={handleManualEntry}
                className="w-full h-10 rounded-xl text-muted-foreground hover:text-foreground font-medium text-xs sm:text-sm"
              >
                <Edit3 className="w-3.5 h-3.5 mr-2" />
                Enter details manually
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      <OCRReviewModal
        isOpen={isReviewModalOpen}
        setIsOpen={setIsReviewModalOpen}
        ocrData={ocrData}
        rawText={rawText}
        originalImage={selectedFile}
        imageUrl={previewUrl}
        isDemo={isDemoMode}
        isManualEntry={isManualEntry}
        onSuccess={() => {
          setIsReviewModalOpen(false);
          clearSelection();
        }}
      />
    </>
  );
}
