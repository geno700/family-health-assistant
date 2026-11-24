// Preparing a chosen file for upload: photos are shrunk to at most 1600 px (JPEG), PDFs are
// kept as they are (up to 5 MB). Nothing here reads what a paper says: the app only stores it.

const MAX_SIDE = 1600;
const MAX_PDF = 5 * 1024 * 1024;

const fail = (code) => { const e = new Error(code); e.code = code; throw e; };

/** Returns { bytes: Uint8Array, type: 'image/jpeg' | 'application/pdf' }. */
export async function prepareFile(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
    if (file.size > MAX_PDF) fail('file_too_big');
    return { bytes: new Uint8Array(await file.arrayBuffer()), type: 'application/pdf' };
  }
  if (!String(file.type).startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '')) fail('file_bad');
  let img;
  try {
    img = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    fail('file_bad'); // e.g. a HEIC photo on a browser that can't open it
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) fail('file_bad');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: 'image/jpeg' };
}
