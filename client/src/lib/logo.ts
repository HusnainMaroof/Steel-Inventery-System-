const MAX_EDGE = 720;
const MAX_DATA_CHARS = 900_000;

export async function fileToLogoDataUrl(file: File): Promise<string> {
  const type = file.type;
  if (type !== "image/png" && type !== "image/jpeg" && type !== "image/webp") {
    throw new Error("Use a PNG, JPG or WebP image.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image is too large. Use a file under 8 MB.");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not read that image.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const preferPng = type === "image/png";
  const primary = canvas.toDataURL(preferPng ? "image/png" : "image/jpeg", 0.84);
  if (primary.length <= MAX_DATA_CHARS) return primary;
  const jpeg = canvas.toDataURL("image/jpeg", 0.72);
  if (jpeg.length <= MAX_DATA_CHARS) return jpeg;
  throw new Error("That image is still too big after shrinking. Try a simpler logo.");
}
