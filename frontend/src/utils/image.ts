export const DEFAULT_SQUARE_IMAGE_SIZE = 1500;

// If the URL is a Cloudinary delivery URL, inject a square crop + optimization transform.
// Otherwise, return the original URL.
export function toSquareImageUrl(
  url: string,
  size: number = DEFAULT_SQUARE_IMAGE_SIZE
): string {
  if (!url) return url;
  if (!Number.isFinite(size) || size <= 0) return url;

  const marker = '/upload/';
  if (!url.includes('res.cloudinary.com') || !url.includes(marker)) return url;

  const [prefix, rest] = url.split(marker);
  if (!prefix || rest === undefined) return url;

  // If the URL already contains transformations, don't try to override them.
  const firstSegment = rest.split('/')[0] || '';
  const looksLikeTransform = /^(?:[a-z]_[^/]+)(?:,[a-z]_[^/]+)*$/i.test(firstSegment);
  if (looksLikeTransform) return url;

  const transform = `c_fill,g_auto,w_${size},h_${size},f_auto,q_auto`;
  return `${prefix}${marker}${transform}/${rest}`;
}

