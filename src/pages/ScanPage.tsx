import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  UploadCloud,
  X,
  RefreshCw,
  Scan,
  FileImage,
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
      // kill previous stream
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
            "Camera access was denied. Please allow camera permission in your browser and try again."
          );
        } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
          setErrorMsg("No camera found on this device.");
        } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
          setErrorMsg(
            "Camera is in use by another application. Close it and try again."
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

      // Wait for metadata before playing — avoids the "stuck on loading" bug
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

  // mount
  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── capture ─────────────────────────────────────────────────────────────────
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

  // ── switch camera ────────────────────────────────────────────────────────────
  const switchCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  };

  // ── portal renders outside the clipping AppLayout ───────────────────────────
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#000",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Full-screen video — no letterbox ── */}
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

      {/* ── Loading state ── */}
      {status === "loading" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <p className="text-sm">Starting camera…</p>
        </div>
      )}

      {/* ── Error state ── */}
      {status === "error" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "0 32px",
            textAlign: "center",
          }}
        >
          <div className="bg-red-500/20 p-4 rounded-full">
            <CameraOff className="w-10 h-10 text-red-400" />
          </div>
          <p className="text-white font-semibold text-base">Camera Unavailable</p>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">{errorMsg}</p>
          <button
            onClick={() => startCamera(facingMode)}
            className="mt-2 px-5 py-2 rounded-full border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Top bar — floats OVER the video ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "env(safe-area-inset-top, 12px) 16px 12px",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, transparent 100%)",
        }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-white/85 hover:text-white transition-colors text-sm font-medium py-1.5 px-3 rounded-full hover:bg-white/10 active:scale-95"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <div style={{ width: 80 }} />
      </div>

      {/* ── Bottom HUD — floats OVER the video ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          padding: `20px 24px max(env(safe-area-inset-bottom, 28px), 28px)`,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0.30) 60%, transparent 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {status === "live" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              position: "relative",
            }}
          >
            <button
              onClick={switchCamera}
              style={{ position: "absolute", left: "max(0px, calc(50% - 90px))" }}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white/80 hover:text-white backdrop-blur-md border border-white/10"
              title="Switch camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>

            <button
              onClick={doCapture}
              aria-label="Capture"
              className="relative w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-200 active:scale-92 bg-white/10 backdrop-blur-md border border-white/20"
            >
              <div className="w-[54px] h-[54px] rounded-full bg-white shadow-xl transition-all duration-200" />
            </button>

            <div style={{ position: "absolute", right: "max(0px, calc(50% - 90px))", width: 48, height: 48 }} />
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
    // reset so the same file can be re-selected
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
    setScanProgress(10);

    const formData = new FormData();
    formData.append("image", selectedFile);

    const interval = setInterval(() => {
      setScanProgress((p) => (p < 90 ? p + 10 : p));
    }, 400);

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
      {/* Camera is portaled to document.body — escapes overflow:hidden on layout */}
      {isCameraOpen && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center bg-primary/10 p-3 rounded-2xl mb-1">
            <Scan className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Scan a Business Card
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-sm mx-auto">
            Capture or upload a card to instantly extract and save contact info.
          </p>
        </div>

        {/* ── Drop zone ────────────────────────────────────────────── */}
        {!selectedFile ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="group rounded-2xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-primary/5 transition-all duration-200 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
            />

            <div className="flex flex-col items-center py-14 px-6 text-center space-y-5">
              <div className="relative">
                <div className="bg-background border shadow-sm p-4 rounded-2xl group-hover:shadow-md group-hover:border-primary/30 transition-all">
                  <UploadCloud className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center">
                  <FileImage className="w-3 h-3" />
                </div>
              </div>

              <div className="space-y-1">
                <p className="font-semibold text-base">Drop your card image here</p>
                <p className="text-sm text-muted-foreground">
                  or click to browse · JPG, PNG, WEBP up to 10 MB
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto pt-1">
                <Button
                  size="sm"
                  className="h-10 px-6 gap-2 w-full sm:w-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <UploadCloud className="w-4 h-4" />
                  Upload Image
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 px-6 gap-2 w-full sm:w-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCameraOpen(true);
                  }}
                >
                  <Camera className="w-4 h-4" />
                  Use Camera
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* ── Preview card ─────────────────────────────────────── */
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="flex flex-col md:flex-row md:h-72">
              {/* image */}
              <div className="md:w-5/12 bg-slate-950 flex items-center justify-center p-4 min-h-[200px] md:min-h-0 shrink-0">
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Business Card"
                    className="max-h-full max-w-full object-contain rounded-lg shadow-xl"
                  />
                )}
              </div>

              {/* info + actions */}
              <div className="flex-1 p-6 flex flex-col justify-between gap-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-semibold text-base">Image Ready</h3>
                  </div>

                  <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm divide-y divide-border/50">
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">File</span>
                      <span className="font-medium text-foreground truncate max-w-[160px] text-right">
                        {selectedFile.name}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Size</span>
                      <span className="font-medium text-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                </div>

                {isScanning && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="animate-pulse">Analyzing card…</span>
                      <span>{scanProgress}%</span>
                    </div>
                    <Progress value={scanProgress} className="h-1.5" />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="flex-1 h-10 gap-2"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Scanning…
                      </>
                    ) : (
                      <>
                        <Scan className="w-4 h-4" />
                        Scan Card
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={clearSelection}
                    disabled={isScanning}
                    className="h-10 w-10"
                    title="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsCameraOpen(true)}
                    disabled={isScanning}
                    className="h-10 w-10"
                    title="Retake with camera"
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Feature cards ────────────────────────────────────────── */}

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
