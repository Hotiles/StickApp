/*
 * Fotokomprimering vid import (§3.4): max ~1600 px längsta sida, JPEG ~0.8.
 */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

export async function compressImage(file) {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (bitmap.close) bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) throw new Error('Kunde inte komprimera bilden.');
  return blob;
}

async function loadBitmap(file) {
  if (globalThis.createImageBitmap) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fallback nedan */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Kunde inte läsa bilden.'));
    };
    img.src = url;
  });
}
