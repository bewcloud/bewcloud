export const PHOTO_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'svg', 'bmp', 'gif', 'tiff', 'webp', 'heic'] as const;
export const PHOTO_VIDEO_EXTENSIONS = ['heif', 'webm', 'mp4', 'mov'] as const;
export const PHOTO_EXTENSIONS = [...PHOTO_IMAGE_EXTENSIONS, ...PHOTO_VIDEO_EXTENSIONS] as const;
