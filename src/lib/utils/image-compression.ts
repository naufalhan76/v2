/**
 * image-compression.ts
 *
 * Client-side image compression utility using the Canvas API.
 * No external dependencies. Pure browser code.
 */

export type CompressOptions = {
  /** Longest side in pixels. Default 1600. */
  maxDimension?: number;
  /** JPEG/WebP encode quality 0-1. Default 0.78. */
  quality?: number;
  /** Output mime type. Default 'image/jpeg'. */
  mimeType?: 'image/jpeg' | 'image/webp';
  /** Max output size in bytes. Default 1_000_000. */
  maxBytes?: number;
};

export type CompressResult = {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  mimeType: string;
};

const DEFAULTS = {
  maxDimension: 1600,
  quality: 0.78,
  mimeType: 'image/jpeg' as const,
  maxBytes: 1_000_000,
};

const QUALITY_FLOOR = 0.4;

/**
 * Decode a Blob into an ImageBitmap or HTMLImageElement and return
 * { bitmap, width, height }. Prefers createImageBitmap with EXIF
 * orientation support; falls back to HTMLImageElement.
 */
async function decodeBlobToSource(
  blob: Blob,
): Promise<{ source: ImageBitmap | HTMLImageElement; width: number; height: number }> {
  // Prefer createImageBitmap with imageOrientation to handle EXIF rotation.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Fall through to HTMLImageElement path.
    }
  }

  // Fallback: HTMLImageElement decode.
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('IMAGE_COMPRESSION_FAILED: HTMLImageElement decode error'));
    };

    img.src = url;
  });
}

/**
 * Encode a canvas to a Blob with the given mime type and quality.
 * Returns null if the browser returns nothing (should not happen in practice).
 */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), mimeType, quality);
  });
}

/**
 * Compress a File or Blob to a smaller JPEG (or WebP) Blob.
 *
 * Short-circuit: if the input is already within maxBytes and both dimensions
 * are within maxDimension, the original blob is returned unchanged.
 *
 * Iterative quality fallback: if the first encode exceeds maxBytes, quality
 * is halved once and retried. The floor is 0.4.
 */
export async function compressImage(input: File | Blob, opts?: CompressOptions): Promise<CompressResult> {
  const maxDimension = opts?.maxDimension ?? DEFAULTS.maxDimension;
  const quality = opts?.quality ?? DEFAULTS.quality;
  const mimeType = opts?.mimeType ?? DEFAULTS.mimeType;
  const maxBytes = opts?.maxBytes ?? DEFAULTS.maxBytes;

  // Decode first so we know the dimensions regardless of short-circuit.
  let decoded: { source: ImageBitmap | HTMLImageElement; width: number; height: number };
  try {
    decoded = await decodeBlobToSource(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`IMAGE_COMPRESSION_FAILED: ${msg}`);
  }

  const { source, width, height } = decoded;

  // Short-circuit: already small enough.
  if (input.size < maxBytes && width <= maxDimension && height <= maxDimension) {
    if (source instanceof ImageBitmap) source.close();
    return {
      blob: input,
      width,
      height,
      bytes: input.size,
      mimeType: input.type || mimeType,
    };
  }

  // Calculate target dimensions preserving aspect ratio.
  let targetWidth = width;
  let targetHeight = height;

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      targetWidth = maxDimension;
      targetHeight = Math.round((height * maxDimension) / width);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round((width * maxDimension) / height);
    }
  }

  // Draw onto canvas.
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    if (source instanceof ImageBitmap) source.close();
    throw new Error('IMAGE_COMPRESSION_FAILED: canvas 2d context unavailable');
  }

  ctx.drawImage(source as CanvasImageSource, 0, 0, targetWidth, targetHeight);
  if (source instanceof ImageBitmap) source.close();

  // First encode attempt.
  const encodeQuality = quality;
  let blob = await canvasToBlob(canvas, mimeType, encodeQuality);

  if (!blob) {
    throw new Error('IMAGE_COMPRESSION_FAILED: canvas.toBlob returned null');
  }

  // Iterative quality fallback: halve quality once if still too large.
  if (blob.size > maxBytes) {
    const fallbackQuality = Math.max(encodeQuality / 2, QUALITY_FLOOR);
    if (fallbackQuality !== encodeQuality) {
      const fallbackBlob = await canvasToBlob(canvas, mimeType, fallbackQuality);
      if (fallbackBlob) {
        blob = fallbackBlob;
      }
    }
  }

  return {
    blob,
    width: targetWidth,
    height: targetHeight,
    bytes: blob.size,
    mimeType,
  };
}

/**
 * Convert a Blob to a base64 data URL.
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('IMAGE_COMPRESSION_FAILED: FileReader error'));
    reader.readAsDataURL(blob);
  });
}
