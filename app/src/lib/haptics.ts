import { getTg } from "./telegram";

export function flipHaptic(): void {
  try {
    getTg()?.HapticFeedback?.impactOccurred("light");
  } catch {
    // no-op: haptics are a nice-to-have, never block the UI on failure
  }
}
