type ImageCdnOptions = {
  width?: number;
  quality?: number;
};

const canUseNetlifyImageCdn = () => {
  if (!import.meta.env.PROD || typeof window === 'undefined') return false;
  return !['localhost', '127.0.0.1'].includes(window.location.hostname);
};

export function netlifyImageUrl(url: string, options: ImageCdnOptions = {}) {
  if (!url || !/^https?:\/\//i.test(url) || !canUseNetlifyImageCdn()) return url;

  const params = new URLSearchParams({ url });
  if (options.width) params.set('w', String(Math.round(options.width)));
  if (options.quality) params.set('q', String(Math.round(options.quality)));
  return `/.netlify/images?${params.toString()}`;
}

export function uniqueImageUrls(urls: Array<string | undefined>) {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}
