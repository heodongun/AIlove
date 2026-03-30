const DEVICE_ID_KEY = "ailove-device-id";
const DRAMA_MODE_KEY = "ailove-drama-mode";
const INFO_PANEL_KEY = "ailove-info-panel";
const SAVED_HIGHLIGHTS_KEY = "ailove-saved-highlights";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getOrCreateViewerId() {
  if (!canUseStorage()) {
    return null;
  }

  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const created = `viewer-${crypto.randomUUID()}`;
  window.localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

export function readDramaModePreference(defaultValue = true) {
  if (!canUseStorage()) {
    return defaultValue;
  }

  const stored = window.localStorage.getItem(DRAMA_MODE_KEY);
  return stored === null ? defaultValue : stored === "1";
}

export function writeDramaModePreference(value: boolean) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(DRAMA_MODE_KEY, value ? "1" : "0");
}

export function readInfoPanelPreference(defaultValue = true) {
  if (!canUseStorage()) {
    return defaultValue;
  }

  const stored = window.localStorage.getItem(INFO_PANEL_KEY);
  return stored === null ? defaultValue : stored === "1";
}

export function writeInfoPanelPreference(value: boolean) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(INFO_PANEL_KEY, value ? "1" : "0");
}

export function readSavedHighlights() {
  if (!canUseStorage()) {
    return new Set<string>();
  }

  const raw = window.localStorage.getItem(SAVED_HIGHLIGHTS_KEY);

  if (!raw) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map((value) => String(value)) : []);
  } catch {
    return new Set<string>();
  }
}

export function toggleSavedHighlight(key: string) {
  const next = readSavedHighlights();

  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }

  if (canUseStorage()) {
    window.localStorage.setItem(SAVED_HIGHLIGHTS_KEY, JSON.stringify([...next]));
  }

  return next;
}
