type HapticPattern = number | number[];

export function vibrate(pattern: HapticPattern): void {
  if (typeof window === "undefined") {
    return;
  }

  const nav = window.navigator as Navigator & { vibrate?: (p: HapticPattern) => boolean };
  if (typeof nav.vibrate !== "function") {
    return;
  }

  nav.vibrate(pattern);
}
