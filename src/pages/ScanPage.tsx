import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  UploadCloud,
  X,
  RefreshCw,
  Scan,
  CheckCircle2,
  CameraOff,
  SwitchCamera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import OCRReviewModal from "@/components/scanner/OCRReviewModal";

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
          <div className="w-full max-w-sm aspect-[1.75/1] rounded-2xl border-2 border-white/60 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
            {/* Corner focus brackets */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />

            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/70 text-xs font-semibold uppercase tracking-wider bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                Position Business Card Here
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading state ── */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
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
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-white/90 hover:text-white transition-colors text-xs font-semibold py-2 px-4 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <span className="text-white/80 text-xs font-medium tracking-wide hidden sm:block">
          CardLens Camera Capture
        </span>
      </div>

      {/* ── Bottom HUD ── */}
      <div className="absolute bottom-0 inset-x-0 z-20 p-6 pb-[max(env(safe-area-inset-bottom,24px),24px)] bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center">
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
              className="w-18 h-18 rounded-full flex items-center justify-center bg-white/15 backdrop-blur-md border-2 border-white/30 active:scale-95 transition-all shadow-2xl"
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [ocrData, setOcrData] = useState<any>(null);
  const [rawText, setRawText] = useState("");
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24">
        {/* ── Page Header ──────────────────────────────────────────── */}
        <div className="text-center space-y-2.5">
          {/* <div className="inline-flex items-center gap-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-sm">
            <Scan className="w-3.5 h-3.5 text-blue-400 dark:text-blue-600" />
            <span>Business Card Capture</span>
          </div> */}
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Scan a Business Card
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            Capture a business card and we'll extract the contact details for you.
          </p>
        </div>

        {/* ── Upload & Scan Card Container ─────────────────────────── */}
        {!selectedFile ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="group relative rounded-3xl border-2 border-dashed border-slate-200 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600 bg-background hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-all duration-300 cursor-pointer p-8 sm:p-12 text-center overflow-hidden shadow-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
            />

            {/* Corner guide indicators for business card frame */}
            <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-slate-300 dark:border-slate-700 group-hover:border-slate-900 dark:group-hover:border-white transition-colors" />
            <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-slate-300 dark:border-slate-700 group-hover:border-slate-900 dark:group-hover:border-white transition-colors" />
            <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-slate-300 dark:border-slate-700 group-hover:border-slate-900 dark:group-hover:border-white transition-colors" />
            <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-slate-300 dark:border-slate-700 group-hover:border-slate-900 dark:group-hover:border-white transition-colors" />

            <div className="flex flex-col items-center space-y-6 max-w-md mx-auto">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:scale-105 transition-transform duration-200">
                  <UploadCloud className="w-8 h-8 text-slate-700 dark:text-slate-300 group-hover:text-slate-950 dark:group-hover:text-white" />
                </div>
                {/* <div className="absolute -bottom-1 -right-1 bg-slate-950 text-white rounded-full p-1 shadow-md">
                  <FileImage className="w-3.5 h-3.5" />
                </div> */}
              </div>

              <div className="space-y-1.5">
                <h3 className="font-bold text-lg text-foreground">
                  Drop your business card here
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Upload an image or use your camera
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full pt-2">
                <Button
                  size="default"
                  className="h-11 px-7 gap-2.5 w-full sm:w-auto font-semibold bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 shadow-sm rounded-xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <UploadCloud className="w-4 h-4" />
                  Upload Card
                </Button>
                <Button
                  variant="outline"
                  size="default"
                  className="h-11 px-7 gap-2.5 w-full sm:w-auto font-semibold rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCameraOpen(true);
                  }}
                >
                  <Camera className="w-4 h-4" />
                  Use Camera
                </Button>
              </div>

              <p className="text-[11px] font-medium text-muted-foreground/80 tracking-wide uppercase pt-2">
                JPG, PNG or WEBP • Maximum 10 MB
              </p>
            </div>
          </div>
        ) : (
          /* ── Preview Card & Processing State ──────────────────── */
          <div className="rounded-3xl border border-border bg-card shadow-lg overflow-hidden">
            <div className="flex flex-col md:flex-row md:h-80">
              {/* Card Image Preview with Scanning Animation */}
              <div className="md:w-5/12 bg-slate-100/70 dark:bg-slate-900/40 border-b md:border-b-0 md:border-r border-border flex items-center justify-center p-6 min-h-[220px] md:min-h-0 shrink-0 relative overflow-hidden">
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
                        <h3 className="font-bold text-base text-foreground">Image Loaded</h3>
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
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                          Analyzing your card…
                        </span>
                        <span>{scanProgress}%</span>
                      </div>
                      <Progress value={scanProgress} className="h-2 rounded-full" />
                      <div className="space-y-1 pt-1 text-xs text-muted-foreground">
                        <p className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                          <span>✓</span> Image uploaded & validated
                        </p>
                        <p className="flex items-center gap-2 text-foreground font-medium">
                          <span>●</span> Reading text and contact information...
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
                    className="flex-1 h-11 text-xs font-bold gap-2 rounded-xl bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950"
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
                    title="Remove card"
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

