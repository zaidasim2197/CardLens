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
  FileEdit,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import OCRReviewModal from "@/components/scanner/OCRReviewModal";
import { SINGLE_DEMO_CARD } from "@/config/demoCards";
import type { OCRData } from "@/types";
import { storageService } from "@/lib/db";
import { cropBusinessCardImage, combineFrontAndBackCards } from "@/lib/imageCrop";

// ─── Camera Modal (rendered into document.body via portal) ───────────────────
function CameraModal({
  onCapture,
  onClose,
}: {
  onCapture: (file: File, backFile?: File, frontFile?: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardFrameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedRef = useRef(false);

  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const [step, setStep] = useState<"FRONT" | "BACK">("FRONT");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);

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

  const doCapture = useCallback(async () => {
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

    const requestedX =
      (frameRect.left - videoRect.left - renderedOffsetX) / coverScale;
    const requestedY =
      (frameRect.top - videoRect.top - renderedOffsetY) / coverScale;
    const sourceX = Math.max(0, requestedX);
    const sourceY = Math.max(0, requestedY);
    const sourceWidth = Math.min(
      frameRect.width / coverScale,
      video.videoWidth - sourceX
    );
    const sourceHeight = Math.min(
      frameRect.height / coverScale,
      video.videoHeight - sourceY
    );

    const cap = document.createElement("canvas");
    cap.width = Math.max(1, Math.round(sourceWidth));
    cap.height = Math.max(1, Math.round(sourceHeight));
    const ctx = cap.getContext("2d")!;
    ctx.drawImage(
      video,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      cap.width,
      cap.height
    );

    cap.toBlob(
      async (blob) => {
        if (!blob) {
          capturedRef.current = false;
          return;
        }
        const capturedFile = new File([blob], `card-${Date.now()}-cropped.jpg`, {
          type: "image/jpeg",
        });

        if (step === "FRONT") {
          // Step 1: Front Side captured!
          setFrontFile(capturedFile);
          setFrontPreview(URL.createObjectURL(capturedFile));
          setStep("BACK");
          capturedRef.current = false;
          toast.success("Front side captured! Now scan the back side (or click finish).");
        } else {
          // Step 2: Back Side captured!
          if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
          if (frontFile) {
            try {
              const compositeFile = await combineFrontAndBackCards(frontFile, capturedFile);
              onCapture(compositeFile, capturedFile, frontFile);
            } catch {
              onCapture(frontFile);
            }
          } else {
            onCapture(capturedFile);
          }
        }
      },
      "image/jpeg",
      0.95
    );
  }, [step, frontFile, onCapture]);

  const handleFinishFrontOnly = () => {
    if (!frontFile) return;
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    onCapture(frontFile);
  };

  const handleRetakeFront = () => {
    setFrontFile(null);
    setFrontPreview(null);
    setStep("FRONT");
    capturedRef.current = false;
  };

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

      {/* ── Alignment Overlay ── */}
      {status === "live" && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4 z-10">
          <div
            ref={cardFrameRef}
            className="relative w-full max-w-sm aspect-[1.75/1] rounded-2xl border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
          >
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-slate-900 dark:border-white rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-slate-900 dark:border-white rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-slate-900 dark:border-white rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-slate-900 dark:border-white rounded-br-lg" />

            <div className="absolute inset-0 flex items-center justify-center text-center px-4">
              <span className="text-white/90 text-xs font-semibold uppercase tracking-wider bg-black/60 px-3.5 py-1.5 rounded-full backdrop-blur-md border border-white/20">
                {step === "FRONT" ? "Position Front of Card Here" : "Position Back of Card Here (Optional)"}
              </span>
            </div>
            <div className="animate-scanline opacity-90" />
          </div>
        </div>
      )}

      {/* ── Loading state ── */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70 z-10">
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <p className="text-sm font-medium">Initializing camera…</p>
        </div>
      )}

      {/* ── Error state ── */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center z-10">
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

        {/* Step Indicator Pill */}
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15">
          <span className={`w-2 h-2 rounded-full ${step === "FRONT" ? "bg-white animate-pulse" : "bg-emerald-400"}`} />
          <span className="text-white text-xs font-bold tracking-wide">
            {step === "FRONT" ? "Step 1 of 2: Front Side" : "Step 2 of 2: Back Side"}
          </span>
        </div>
      </div>

      {/* ── Bottom HUD ── */}
      {status === "live" && (
        <div className="absolute bottom-0 inset-x-0 z-20 p-6 pb-[max(env(safe-area-inset-bottom,24px),24px)] bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col items-center gap-4">

          {/* Secondary Action Bar when in Step 2 */}
          {step === "BACK" && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleFinishFrontOnly}
                className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-xs font-bold border border-white/20 transition-all flex items-center gap-1.5 shadow-md"
              >
                Finish (Front Side Only)
              </button>
              <button
                onClick={handleRetakeFront}
                className="px-3 py-2 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white text-xs font-medium border border-white/10 transition-all"
              >
                Retake Front
              </button>
            </div>
          )}

          <div className="flex items-center justify-between w-full max-w-sm px-4 relative">
            {/* Front Thumbnail Badge if captured */}
            {frontPreview ? (
              <button
                onClick={handleRetakeFront}
                className="w-14 h-10 rounded-lg border-2 border-emerald-400 overflow-hidden relative group shadow-lg shrink-0"
                title="Click to retake front side"
              >
                <img src={frontPreview} alt="Front side" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-[9px] font-bold text-emerald-300">
                  ✓ Front
                </div>
              </button>
            ) : (
              <button
                onClick={switchCamera}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white backdrop-blur-md border border-white/15 shrink-0"
                title="Switch Camera"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            )}

            {/* Shutter Button */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={doCapture}
                className="w-18 h-18 rounded-full border-4 border-white bg-slate-900 hover:bg-black active:scale-95 transition-transform flex items-center justify-center shadow-lg shadow-slate-900/40 cursor-pointer dark:bg-white dark:hover:bg-slate-100"
                title={step === "FRONT" ? "Capture Front Side" : "Capture Back Side & Scan Both"}
              >
                <div className="w-12 h-12 rounded-full border-2 border-white/80 dark:border-slate-900/80 bg-transparent flex items-center justify-center">
                  <span className="text-[10px] font-extrabold uppercase text-white dark:text-slate-900 tracking-tighter text-center leading-tight">
                    {step === "FRONT" ? "Front" : "Back"}
                  </span>
                </div>
              </button>
            </div>

            {/* Right switch camera if thumbnail is on left */}
            {frontPreview ? (
              <button
                onClick={switchCamera}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white backdrop-blur-md border border-white/15 shrink-0"
                title="Switch Camera"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-12" />
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

// ─── Main ScanPage Component ──────────────────────────────────────────────────
export default function ScanPage() {
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const [ocrData, setOcrData] = useState<any>(null);
  const [rawText, setRawText] = useState("");
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live query for verified contacts count
  const verifiedContacts = useLiveQuery(() => storageService.getVerifiedContacts());

  const processFile = async (file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error("File size must be less than 1.5 MB.");
      return;
    }
    try {
      const croppedFile = await cropBusinessCardImage(file, file.name);
      if (previewUrl && previewUrl !== "/democard.png") URL.revokeObjectURL(previewUrl);
      setScanError(null);
      setIsDemoMode(false);
      setFrontFile(croppedFile);
      setBackFile(null);
      setSelectedFile(croppedFile);
      setPreviewUrl(URL.createObjectURL(croppedFile));
    } catch {
      toast.error("We could not prepare this image. Please try another photo.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) void processFile(e.target.files[0]);
    e.target.value = "";
  };

  const handleCameraCapture = (file: File, backImage?: File, frontImage?: File) => {
    setIsCameraOpen(false);
    setScanError(null);
    setIsDemoMode(false);

    if (backImage && frontImage) {
      setFrontFile(frontImage);
      setBackFile(backImage);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      toast.success("2-Sided Card captured! Both Front and Back will be scanned by OCR.");
    } else {
      setFrontFile(file);
      setBackFile(null);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void processFile(file);
  };

  const handleScan = async () => {
    if (!selectedFile) return;
    setScanError(null);
    setIsReviewModalOpen(false);

    // ── Demo card shortcut: skip OCR entirely, use pre-baked data ──
    // This handles the case where the user dismisses the review popup
    // then clicks "Scan & Extract" again on the already-loaded demo file.
    if (isDemoMode || selectedFile.name === "democard.png") {
      setIsScanning(true);
      setScanProgress(40);
      const timer = setInterval(() => setScanProgress((p) => (p < 90 ? p + 25 : p)), 150);
      setTimeout(() => {
        clearInterval(timer);
        setScanProgress(100);
        setIsScanning(false);
        setOcrData(SINGLE_DEMO_CARD.preparedData);
        setRawText(SINGLE_DEMO_CARD.rawOCRText);
        setIsDemoMode(true);
        setIsReviewModalOpen(true);
        setTimeout(() => setScanProgress(0), 400);
      }, 600);
      return;
    }

    setIsScanning(true);
    setScanProgress(15);

    const formData = new FormData();
    if (frontFile && backFile) {
      formData.append("image", frontFile);
      formData.append("imageBack", backFile);
    } else {
      formData.append("image", frontFile || selectedFile);
    }

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
      if (!hasReadableContact(data.rawText, data.parsed)) throw new Error(NO_CONTACT_MESSAGE);
      setOcrData(data.parsed);
      setRawText(data.rawText);
      setIsReviewModalOpen(true);
    } catch (error: unknown) {
      clearInterval(interval);
      const message = error instanceof Error ? error.message : "Unable to read this card. Check your connection and try again.";
      setScanError(message);
      toast.error(message);
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanProgress(0), 500);
    }
  };

  const handleTriggerDemoCard = async () => {
    setScanError(null);

    let demoFile: File;
    try {
      const res = await fetch("/democard.png");
      const blob = await res.blob();
      demoFile = new File([blob], "democard.png", { type: "image/png" });
    } catch {
      demoFile = new File([new Blob(["demo-card"])], "democard.png", { type: "image/png" });
    }

    setSelectedFile(demoFile);
    setPreviewUrl(SINGLE_DEMO_CARD.imagePath);
    setIsScanning(true);
    setScanProgress(35);

    const timer = setInterval(() => {
      setScanProgress((p) => (p < 90 ? p + 30 : p));
    }, 200);

    setTimeout(() => {
      clearInterval(timer);
      setScanProgress(100);
      setIsScanning(false);
      setOcrData(SINGLE_DEMO_CARD.preparedData);
      setRawText(SINGLE_DEMO_CARD.rawOCRText);
      setIsDemoMode(true);
      setIsReviewModalOpen(true);
      setTimeout(() => setScanProgress(0), 400);
    }, 800);
  };

  const handleManualEntry = () => {
    setScanError(null);
    const blankData: OCRData = {
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
      notes: "",
    };
    const dummyBlob = new Blob(["manual-entry"], { type: "image/png" });
    const dummyFile = new File([dummyBlob], "manual-entry.png", { type: "image/png" });
    setSelectedFile(dummyFile);
    setPreviewUrl("/democard.png");
    setOcrData(blankData);
    setRawText("Manual Contact Entry");
    setIsDemoMode(false);
    setIsReviewModalOpen(true);
  };

  const clearSelection = () => {
    setScanError(null);
    setSelectedFile(null);
    if (previewUrl && previewUrl !== "/democard.png") URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setIsDemoMode(false);
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
          /* ── 1. CARDSNAP BY V71 LANDING SCREEN ── */
          <div className="space-y-8 sm:space-y-10">
            {/* Hero Header */}
            <div className="text-center space-y-4">
              {/* Eyebrow Badge */}
              {/* <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-900/10 text-slate-900 border border-slate-900/25 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-slate-900 animate-pulse" />
                <span className="tracking-wide uppercase text-[11px] font-bold">
                  CardSnap by V71 • Business Card Capture & Contact Review
                </span>
              </div> */}

              {/* Hero Headings */}
              <div className="space-y-3 max-w-3xl mx-auto pt-1">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white leading-[1.18]">
                  Turn business cards into<br className="hidden sm:block" />{" "}
                  <span className="text-slate-900 dark:text-white bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent inline-block">
                    reviewed contacts.
                  </span>
                </h1>
                <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed font-normal">
                  Capture a card, confirm the details, and pass a clean contact record into your approved workflow.
                </p>
              </div>
            </div>

            {/* Failure/Recovery Banner (If previous scan encountered an error) */}
            {scanError && (
              <div className="rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Scan Error Recovery
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {scanError} Choose an alternative recovery option below:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs font-semibold rounded-xl border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => setIsCameraOpen(true)}
                  >
                    <Camera className="w-3.5 h-3.5 mr-1 text-slate-700 dark:text-slate-300" /> Try again
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs font-semibold rounded-xl border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud className="w-3.5 h-3.5 mr-1 text-slate-700 dark:text-slate-300" /> Upload card
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs font-semibold rounded-xl border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={handleTriggerDemoCard}
                  >
                    <Play className="w-3.5 h-3.5 mr-1 text-slate-700 dark:text-slate-300" /> Use demo card
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs font-semibold rounded-xl border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={handleManualEntry}
                  >
                    <FileEdit className="w-3.5 h-3.5 mr-1 text-slate-700 dark:text-slate-300" /> Manual entry
                  </Button>
                </div>
              </div>
            )}

            {/* Interactive Scanning Visual & CTAs Card */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl shadow-slate-200/50 dark:shadow-none p-6 sm:p-10 text-center overflow-hidden transition-all duration-300 hover:border-slate-400 dark:hover:border-slate-600 group"
            >
              {/* Subtle Scanning Backdrop Gradients */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-slate-900/5 via-transparent to-transparent opacity-60 dark:from-white/5" />
              <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-slate-900/5 dark:bg-white/5 blur-3xl pointer-events-none" />
              <div className="absolute -left-16 -bottom-16 w-48 h-48 rounded-full bg-slate-800/5 dark:bg-slate-700/5 blur-3xl pointer-events-none" />

              {/* Business Card Scanning Frame Representation - Fitted Edge-to-Edge with No White Bezels */}
              <div className="relative max-w-sm sm:max-w-md mx-auto mb-8 p-3 sm:p-4 rounded-2xl border-2 border-dashed border-slate-400/60 dark:border-slate-600/60 bg-slate-50/80 dark:bg-slate-950/60 shadow-inner group-hover:border-slate-900 dark:group-hover:border-white transition-colors duration-300">
                {/* Corner Bracket Reticles */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-slate-900 dark:border-white rounded-tl-md z-30" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-slate-900 dark:border-white rounded-tr-md z-30" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-slate-900 dark:border-white rounded-bl-md z-30" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-slate-900 dark:border-white rounded-br-md z-30" />

                {/* Prepared Demo Card Image Graphic Display */}
                <div className="relative aspect-[1.75/1] w-full rounded-xl overflow-hidden shadow-md flex items-center justify-center bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                  <img
                    src="/democard.png"
                    alt="Sample Business Card"
                    className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-102"
                  />

                  {/* Laser scan line animation animating up and down directly ON TOP of the demo card */}
                  <div className="animate-scanline opacity-90 rounded-xl z-20 pointer-events-none" />

                  <div className="absolute top-2.5 right-2.5 text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider bg-white/95 dark:bg-slate-900/95 px-2.5 py-0.5 rounded-full border border-slate-900/30 dark:border-white/30 shadow-xs z-30">
                    Demo Card
                  </div>
                </div>
              </div>

              {/* CTAs Action Buttons Container (3 Distinct Actions - Single Line on Mobile) */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xl mx-auto relative z-10 pt-2">
                {/* Primary Action: Scan a business card */}
                <Button
                  size="lg"
                  className="w-full sm:flex-1 h-13 px-4 sm:px-5 text-xs sm:text-base font-bold bg-slate-900 hover:bg-black active:scale-[0.98] text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 rounded-2xl shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 transition-all gap-2 flex flex-row items-center justify-center border-0 whitespace-nowrap cursor-pointer"
                  onClick={() => setIsCameraOpen(true)}
                >
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-white dark:text-slate-900 shrink-0" />
                  <span className="whitespace-nowrap">Scan a business card</span>
                </Button>

                {/* Secondary Action: Upload a card image */}
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:flex-1 h-13 px-4 sm:px-5 text-xs sm:text-base font-bold border-2 border-slate-900/30 dark:border-slate-700 hover:border-slate-900 dark:hover:border-slate-400 hover:bg-slate-900/5 dark:hover:bg-slate-800/40 active:scale-[0.98] text-slate-900 dark:text-white rounded-2xl transition-all gap-2 flex flex-row items-center justify-center bg-white dark:bg-slate-900 shadow-xs whitespace-nowrap cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900 dark:text-white shrink-0" />
                  <span className="whitespace-nowrap">Upload a card image</span>
                </Button>

                {/* Tertiary Action: Try demo card */}
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto h-13 px-4 sm:px-5 text-xs sm:text-base font-bold border-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 hover:border-slate-400 active:scale-[0.98] rounded-2xl transition-all gap-2 flex flex-row items-center justify-center shadow-xs whitespace-nowrap cursor-pointer"
                  onClick={handleTriggerDemoCard}
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-slate-300 shrink-0" />
                  <span className="whitespace-nowrap">Try demo card</span>
                </Button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-5 font-medium">
                Supports JPG, PNG or WEBP up to 1.5 MB. Drag & drop image anywhere above.
              </p>
            </div>

            {/* Real Reviewed Contacts Summary */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs">
              {verifiedContacts && verifiedContacts.length > 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                  <div className="flex items-center gap-3 text-left w-full sm:w-auto min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between sm:justify-start gap-2 w-full">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                          Reviewed Contacts
                        </h4>
                        <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900/10 text-slate-900 dark:bg-white/15 dark:text-white border border-slate-900/20 dark:border-white/30 whitespace-nowrap">
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
                    className="h-9 px-3.5 text-xs font-semibold rounded-xl border-slate-900/30 dark:border-slate-700 text-slate-900 dark:text-white bg-slate-900/5 dark:bg-slate-800/50 hover:bg-slate-900/10 dark:hover:bg-slate-800 hover:border-slate-900 transition-all gap-1.5 shrink-0 w-full sm:w-auto cursor-pointer"
                  >
                    View Reviewed Contacts <ArrowRight className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 text-left">
                  <div className="flex items-start gap-3 text-left">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 text-left">
                        No contacts saved yet
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-left">
                        Your reviewed contacts will appear here after your first scan.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/verified')}
                    className="h-9 px-3.5 text-xs font-semibold rounded-xl border-slate-900/30 dark:border-slate-700 text-slate-900 dark:text-white bg-slate-900/5 dark:bg-slate-800/50 hover:bg-slate-900/10 dark:hover:bg-slate-800 hover:border-slate-900 transition-all gap-1.5 shrink-0 cursor-pointer"
                  >
                    View Queue <ArrowRight className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── 2. CARD LOADED & OCR PROCESSING WORKFLOW ── */
          <div className="rounded-3xl border border-border bg-card shadow-xl overflow-hidden">
            <div className="flex flex-col md:flex-row min-h-[320px]">
              {/* Card Image Preview with Scanning Animation */}
              <div className="md:w-72 lg:w-80 bg-slate-100/80 dark:bg-slate-900/50 border-b md:border-b-0 md:border-r border-border flex items-center justify-center p-5 sm:p-6 min-h-[220px] md:min-h-0 shrink-0 relative overflow-hidden">
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Business Card Preview"
                    className="max-h-full max-w-full object-contain rounded-xl shadow-md border border-slate-200 dark:border-slate-800"
                  />
                )}
                {/* Laser scan line sweep when scanning */}
                {isScanning && <div className="animate-scanline opacity-90" />}
              </div>

              {/* Status Details & Actions */}
              <div className="flex-1 p-5 sm:p-6 lg:p-7 flex flex-col justify-between gap-5 bg-background min-w-0">
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-base text-foreground truncate">Card Image Loaded</h3>
                        <p className="text-xs text-muted-foreground truncate">{selectedFile.name}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground shrink-0 whitespace-nowrap">
                      {selectedFile.size > 1024 ? (selectedFile.size / 1024 / 1024).toFixed(2) : "0.48"} MB
                    </span>
                  </div>

                  {/* Processing Status Checklist */}
                  {isScanning ? (
                    <div className="space-y-3 py-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-900 dark:text-white flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Extracting text & parsing fields…
                        </span>
                        <span>{scanProgress}%</span>
                      </div>
                      <Progress value={scanProgress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        OCR engine is reading full name, company, email, phone, and address…
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Click <strong className="text-foreground">Scan & Extract</strong> to process this image with our OCR engine and review extracted contact fields before saving.
                    </p>
                  )}
                </div>

                {/* Actions — Primary full-width, secondary responsive grid */}
                <div className="flex flex-col gap-2.5 pt-2 w-full">
                  {/* Primary CTA — always full width */}
                  <Button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="w-full h-11 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 shadow-md shadow-slate-900/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Processing…
                      </>
                    ) : (
                      <>
                        <Scan className="w-4 h-4 text-white dark:text-slate-900" /> Scan &amp; Extract Contact
                      </>
                    )}
                  </Button>

                  {/* Secondary actions:
                      Mobile  → Change Image full-width, then Retake | Cancel in 2-col
                      sm+     → all three in a flat 3-col grid                         */}
                  <div className="flex flex-col sm:hidden gap-2">
                    <Button
                      variant="outline"
                      onClick={clearSelection}
                      disabled={isScanning}
                      className="w-full h-10 rounded-xl text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-slate-800/60 cursor-pointer"
                    >
                      Change Image
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsCameraOpen(true)}
                        disabled={isScanning}
                        className="h-10 rounded-xl text-xs font-semibold border-slate-900/20 dark:border-slate-700 text-slate-900 dark:text-white bg-slate-900/5 dark:bg-slate-800/40 hover:bg-slate-900/10 dark:hover:bg-slate-800 hover:border-slate-900/40 flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Retake camera capture"
                      >
                        <Camera className="w-3.5 h-3.5" /><span>Retake</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={clearSelection}
                        disabled={isScanning}
                        className="h-10 rounded-xl text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-900/5 dark:hover:bg-slate-800/60 flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Return to welcome screen"
                      >
                        <X className="w-3.5 h-3.5" /><span>Cancel</span>
                      </Button>
                    </div>
                  </div>

                  {/* sm+ flat 3-col */}
                  <div className="hidden sm:grid sm:grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      onClick={clearSelection}
                      disabled={isScanning}
                      className="h-10 rounded-xl text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-slate-800/60 cursor-pointer"
                    >
                      Change Image
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsCameraOpen(true)}
                      disabled={isScanning}
                      className="h-10 rounded-xl text-xs font-semibold border-slate-900/20 dark:border-slate-700 text-slate-900 dark:text-white bg-slate-900/5 dark:bg-slate-800/40 hover:bg-slate-900/10 dark:hover:bg-slate-800 hover:border-slate-900/40 flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Retake camera capture"
                    >
                      <Camera className="w-3.5 h-3.5" /><span>Retake</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={clearSelection}
                      disabled={isScanning}
                      className="h-10 rounded-xl text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-900/5 dark:hover:bg-slate-800/60 flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Return to welcome screen"
                    >
                      <X className="w-3.5 h-3.5" /><span>Cancel</span>
                    </Button>
                  </div>
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
        isDemo={isDemoMode}
        onSuccess={() => {
          setIsReviewModalOpen(false);
          clearSelection();
        }}
      />
    </>
  );
}



