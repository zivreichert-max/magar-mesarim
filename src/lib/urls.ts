// Only http(s) URLs may be rendered as href — DB rows are writable with the
// anon key, so an unchecked href is a stored javascript:-URL injection vector
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}
