export function buildMapUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export async function openMapLocation(lat: number, lng: number) {
  const url = buildMapUrl(lat, lng);
  const openedWindow = window.open(url, "_blank", "noopener,noreferrer");

  if (openedWindow) {
    return { opened: true, url };
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    }
  } catch {
    // ignore clipboard failures
  }

  return { opened: false, url };
}