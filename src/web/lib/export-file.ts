import { ApiError, apiResponse } from './api';

export async function exportFile(path: string, fallbackName: string, failure: string) {
  const response = await apiResponse(path, { cache: 'no-store' });
  if (!response.ok) throw new ApiError(failure, response.status);
  const name =
    /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ??
    fallbackName;
  const url = URL.createObjectURL(await response.blob());
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
