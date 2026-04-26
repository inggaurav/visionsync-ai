// Gemini API key — stored in browser localStorage, never transmitted elsewhere

const STORAGE_KEY = 'visionsync_gemini_api_key';

export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

/** Gemini keys always start with "AIzaSy" and are 39 chars long */
export function isValidKeyFormat(key: string): boolean {
  const k = key.trim();
  return k.startsWith('AIzaSy') && k.length === 39;
}

/** Returns masked version: AIzaSy••••••••••••••••••••••••••Xxxx */
export function maskedKey(): string {
  const k = getApiKey();
  if (!k) return '';
  return `${k.slice(0, 6)}${'•'.repeat(k.length - 10)}${k.slice(-4)}`;
}
