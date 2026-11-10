// Thin wrapper around window.Telegram.WebApp. Every access is optional-chained so
// the app runs (with graceful no-ops) in a plain browser during local development.

interface TelegramWebApp {
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  BackButton: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
    selectionChanged(): void;
  };
  CloudStorage?: CloudStorageLike;
  isVersionAtLeast?(version: string): boolean;
  showConfirm?(message: string, cb: (confirmed: boolean) => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

import { THEME_BACKGROUND, THEME_HEADER } from "./theme";
import type { CloudStorageLike } from "./cloudProgress";

// A function, not a value read once at module load: telegram-web-app.js is
// loaded via a plain blocking <script> tag with no error handling, so on a
// slow or dropped connection it can still be loading (or have failed) at the
// moment this module first runs. Reading window.Telegram?.WebApp fresh on
// every call means the app picks it up as soon as it becomes available,
// instead of permanently freezing on `undefined`.
export function getTg(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

// The official telegram-web-app.js always defines window.Telegram.WebApp, even
// outside a real Telegram client — but there it reports a stub "version 6.0"
// where most methods *throw* WebAppMethodUnsupported synchronously instead of
// just being absent. Every call needs this guard, not just optional chaining.
export function safeTg(fn: (webApp: TelegramWebApp) => void): void {
  const tg = getTg();
  if (!tg) return;
  try {
    fn(tg);
  } catch {
    // unsupported on this client/version — no-op
  }
}

export function initTelegram(): void {
  safeTg((w) => w.ready());
  safeTg((w) => w.expand());
  safeTg((w) => w.disableVerticalSwipes?.());
  // The theme is fixed regardless of the user's Telegram theme (see theme.ts);
  // tint Telegram's own chrome to match so the native header doesn't clash.
  safeTg((w) => w.setHeaderColor?.(THEME_HEADER));
  safeTg((w) => w.setBackgroundColor?.(THEME_BACKGROUND));
}

// Telegram's native dialog where supported (Bot API 6.2+); window.confirm is
// unreliable inside some Telegram webviews.
export function confirmAction(message: string): Promise<boolean> {
  const tg = getTg();
  return new Promise((resolve) => {
    try {
      if (tg?.showConfirm && tg.isVersionAtLeast?.("6.2")) {
        tg.showConfirm(message, resolve);
        return;
      }
    } catch {
      // unsupported on this client — fall through to the browser dialog
    }
    resolve(window.confirm(message));
  });
}
