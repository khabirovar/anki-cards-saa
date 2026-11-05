import type { Card } from "../types/card";

let cache: Promise<Card[]> | null = null;

export function loadCards(): Promise<Card[]> {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}cards.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`cards.json: HTTP ${res.status}`);
        return res.json() as Promise<Card[]>;
      })
      .catch((err) => {
        // Don't poison the cache with a rejected promise forever — clear it so
        // the next call (e.g. after the user's connection recovers) retries.
        cache = null;
        throw err;
      });
  }
  return cache;
}
