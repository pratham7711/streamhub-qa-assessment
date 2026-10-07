import { useEffect, useState } from 'react';
import { ApiError, getJson } from './api';

export type ApiState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'ready'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: ApiError };

/**
 * Fetches `url` and re-fetches when it changes; stale responses are aborted.
 * The result is keyed by URL, so a new URL reads as loading from its first
 * render instead of briefly showing the previous URL's data. A null URL skips
 * the fetch and keeps the previous result.
 */
export function useApi<T>(url: string | null): ApiState<T> {
  const [entry, setEntry] = useState<{ url: string | null; state: ApiState<T> }>({ url: null, state: { status: 'loading' } });

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    getJson<T>(url, controller.signal)
      .then((data) => setEntry({ url, state: { status: 'ready', data } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setEntry({
          url,
          state: {
            status: 'error',
            error: error instanceof ApiError ? error : new ApiError(0, 'NETWORK_ERROR', 'The LoanLens API could not be reached.'),
          },
        });
      });
    return () => controller.abort();
  }, [url]);

  return url === null || entry.url === url ? entry.state : { status: 'loading' };
}

export function useElementWidth<T extends HTMLElement>(fallback = 640) {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width] as const;
}
