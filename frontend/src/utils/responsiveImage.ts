type ResponsiveImageOptions = {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain';
  quality?: number;
};

const appendOrReplaceParam = (url: URL, key: string, value: string) => {
  url.searchParams.set(key, value);
};

export function toResponsiveImageUrl(url: string, options: ResponsiveImageOptions = {}): string {
  if (!url) return url;

  const width = Math.max(1, Math.round(options.width ?? 960));
  const height = Math.max(1, Math.round(options.height ?? width));
  const quality = Math.min(100, Math.max(35, Math.round(options.quality ?? 78)));
  const fit = options.fit ?? 'cover';

  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    const [prefix, rest] = url.split('/upload/');
    if (!prefix || rest === undefined) return url;
    const firstSegment = rest.split('/')[0] || '';
    const looksLikeTransform = /^(?:[a-z]_[^/]+)(?:,[a-z]_[^/]+)*$/i.test(firstSegment);
    if (looksLikeTransform) return url;
    const transform = fit === 'contain'
      ? `c_fit,w_${width},h_${height},f_auto,q_${quality}`
      : `c_fill,g_auto,w_${width},h_${height},f_auto,q_${quality}`;
    return `${prefix}/upload/${transform}/${rest}`;
  }

  if (url.includes('images.unsplash.com')) {
    try {
      const parsed = new URL(url);
      appendOrReplaceParam(parsed, 'w', String(width));
      appendOrReplaceParam(parsed, 'q', String(quality));
      appendOrReplaceParam(parsed, 'fm', 'webp');
      appendOrReplaceParam(parsed, 'fit', fit === 'contain' ? 'contain' : 'crop');
      return parsed.toString();
    } catch {
      return url;
    }
  }

  if (url.includes('commons.wikimedia.org/wiki/Special:FilePath/')) {
    try {
      const parsed = new URL(url);
      appendOrReplaceParam(parsed, 'width', String(width));
      return parsed.toString();
    } catch {
      return url;
    }
  }

  if (url.includes('/uploads/')) {
    try {
      const parsed = new URL(url, 'https://brajmart.local');
      appendOrReplaceParam(parsed, 'width', String(width));
      appendOrReplaceParam(parsed, 'height', String(height));
      appendOrReplaceParam(parsed, 'quality', String(quality));
      appendOrReplaceParam(parsed, 'fit', fit);
      return parsed.toString().replace(/^https:\/\/brajmart\.local/, '');
    } catch {
      return url;
    }
  }

  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('width')) appendOrReplaceParam(parsed, 'width', String(width));
    if (parsed.searchParams.has('w')) appendOrReplaceParam(parsed, 'w', String(width));
    if (parsed.searchParams.has('q')) appendOrReplaceParam(parsed, 'q', String(quality));
    return parsed.toString();
  } catch {
    return url;
  }
}
