import { toResponsiveImageUrl } from './responsiveImage';

export const DEFAULT_SQUARE_IMAGE_SIZE = 720;

// If the URL is a Cloudinary delivery URL, inject a square crop + optimization transform.
// Otherwise, return the original URL.
export function toSquareImageUrl(
  url: string,
  size: number = DEFAULT_SQUARE_IMAGE_SIZE
): string {
  if (!url) return url;
  if (!Number.isFinite(size) || size <= 0) return url;

  return toResponsiveImageUrl(url, { width: size, height: size, quality: 78, fit: 'cover' });
}

