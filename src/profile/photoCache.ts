/** Смена главного фото сохраняет дополнительные, но не возвращает старое главным. */
export function replaceMainPhoto(photos: string[] | undefined, url: string): string[] {
  return [url, ...(photos ?? []).slice(1).filter(x => x !== url)];
}
