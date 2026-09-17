const CARD_ASPECT_RATIO = 1.75;
const MAX_OUTPUT_WIDTH = 1800;

async function decodeImage(image: Blob): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(image, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(image);
  const element = new Image();
  element.decoding = "async";
  element.src = url;
  await element.decode();

  return {
    source: element,
    width: element.naturalWidth,
    height: element.naturalHeight,
    cleanup: () => URL.revokeObjectURL(url),
  };
}

/**
 * Produces a compact, business-card-shaped image before OCR and storage.
 * Phone photos are expected to have the card centred in the upper-middle of
 * the capture frame, matching the camera guide shown by the app.
 */
export async function cropBusinessCardImage(
  image: Blob,
  originalName = "business-card.jpg"
): Promise<File> {
  // Avoid trimming a crop again each time an existing contact is edited.
  if (/-cropped\.jpe?g$/i.test(originalName)) {
    return new File([image], originalName, {
      type: image.type || "image/jpeg",
      lastModified: Date.now(),
    });
  }

  const decoded = await decodeImage(image);

  try {
    const { width, height } = decoded;
    if (!width || !height) throw new Error("Unable to read image dimensions");

    const sourceAspect = width / height;
    let cropWidth: number;
    let cropHeight: number;
    let cropX: number;
    let cropY: number;

    if (sourceAspect < CARD_ASPECT_RATIO) {
      // Portrait and square phone photos: remove the table/background and
      // favour the upper-middle area where the capture guide places the card.
      cropWidth = width * 0.9;
      cropHeight = cropWidth / CARD_ASPECT_RATIO;
      if (cropHeight > height * 0.94) {
        cropHeight = height * 0.94;
        cropWidth = cropHeight * CARD_ASPECT_RATIO;
      }
      cropX = (width - cropWidth) / 2;
      cropY = Math.min(
        height - cropHeight,
        Math.max(0, height * 0.45 - cropHeight / 2)
      );
    } else {
      // Wide captures: retain almost the full height and centre the card.
      cropHeight = height * 0.94;
      cropWidth = cropHeight * CARD_ASPECT_RATIO;
      if (cropWidth > width * 0.98) {
        cropWidth = width * 0.98;
        cropHeight = cropWidth / CARD_ASPECT_RATIO;
      }
      cropX = (width - cropWidth) / 2;
      cropY = (height - cropHeight) / 2;
    }

    const outputScale = Math.min(1, MAX_OUTPUT_WIDTH / cropWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(cropWidth * outputScale));
    canvas.height = Math.max(1, Math.round(cropHeight * outputScale));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to prepare image crop");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      decoded.source,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const croppedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Unable to create image crop"))),
        "image/jpeg",
        0.92
      );
    });

    const baseName = originalName.replace(/\.[^.]+$/, "") || "business-card";
    return new File([croppedBlob], `${baseName}-cropped.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    decoded.cleanup();
  }
}
