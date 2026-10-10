export const PHOTO_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'svg', 'bmp', 'gif', 'tiff', 'webp', 'heic'] as const;
export const PHOTO_VIDEO_EXTENSIONS = ['heif', 'webm', 'mp4', 'mov'] as const;
export const PHOTO_EXTENSIONS = [...PHOTO_IMAGE_EXTENSIONS, ...PHOTO_VIDEO_EXTENSIONS] as const;

// MIME type first, extension as fallback: HEIC/HEIF and camera RAW files often arrive with an empty or generic (application/octet-stream) type.
export function isPhotoFile(file: File): boolean {
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
    return true;
  }

  const lowercaseFileName = file.name.toLocaleLowerCase();
  return PHOTO_EXTENSIONS.some((extension) => lowercaseFileName.endsWith(`.${extension}`));
}
