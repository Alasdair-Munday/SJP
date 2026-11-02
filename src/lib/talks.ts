import fallbackTalks from "../data/talks-fallback.json";
import { getAudioComTalks } from "./talks/audio-com";

export type Talk = {
  id?: string;
  title: string;
  speaker: string;
  date: string;
  series: string;
  passage: string;
  audioUrl: string;
  description: string;
  duration: number;
  imageUrl?: string;
  sourceUrl?: string;
  audioType?: string;
};

export const talkAnchorId = (talk: Pick<Talk, "id" | "date" | "title">) => {
  const slug = `${talk.id || `${talk.date}-${talk.title}`}`
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `talk-${slug || "untitled"}`;
};

let cachedTalksPromise: Promise<Talk[]> | null = null;
let cacheExpiresAt = 0;

export async function getTalks(): Promise<Talk[]> {
  if (!cachedTalksPromise || Date.now() >= cacheExpiresAt) {
    cacheExpiresAt = Date.now() + 5 * 60 * 1000;
    cachedTalksPromise = (async () => {
      try {
        const items = await getAudioComTalks();
        if (!items.length) throw new Error("Audio.com API returned no talk items.");
        return items;
      } catch (error) {
        console.warn(
          "[talks] Using saved recordings because the Audio.com API is unavailable.",
          error,
        );
        return fallbackTalks.items;
      }
    })();
  }

  return cachedTalksPromise;
}
