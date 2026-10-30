import { getStore } from "@netlify/blobs";
import type { Talk } from "../talks";

const AUDIO_COM_API_URL = "https://api.audio.com/v1";
const AUDIO_COM_TOKEN_URL = "https://api.audio.com/auth/token";
const AUDIO_COM_PROFILE_URL = "https://audio.com/stjohnsparksheffield";
const DEFAULT_AUDIO_COM_USERNAME = "stjohnsparksheffield";
const TOKEN_STORE_NAME = "audio-com-oauth-v1";
const TOKEN_STORE_KEY = "tokens";
const PAGE_SIZE = 100;

type AudioComPlayback = {
  duration?: number;
  url?: string;
  waveform?: string;
};

export type AudioComAudio = {
  author_name?: string;
  category?: string;
  date_created?: number;
  date_updated?: number;
  description?: string;
  id?: string;
  image?: string;
  is_downloadable?: boolean;
  is_listed?: boolean;
  license?: string;
  play?: AudioComPlayback;
  slug?: string;
  tags?: string[];
  title?: string;
  username?: string;
};

type AudioComTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
};

type TokenState = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type NetlifyRuntime = typeof globalThis & {
  Netlify?: { env?: { get: (name: string) => string | undefined } };
};

export class AudioComApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AudioComApiError";
    this.status = status;
  }
}

const readEnv = (name: string) =>
  (globalThis as NetlifyRuntime).Netlify?.env?.get(name) ||
  process.env[name] ||
  "";

const expectedUsername = () =>
  readEnv("AUDIO_COM_USERNAME") || DEFAULT_AUDIO_COM_USERNAME;

let tokenStatePromise: Promise<TokenState> | null = null;

const getTokenStore = () =>
  getStore({ name: TOKEN_STORE_NAME, consistency: "strong" });

const loadTokenState = async (): Promise<TokenState> => {
  try {
    const stored = await getTokenStore().get(TOKEN_STORE_KEY, { type: "json" });
    if (
      stored &&
      typeof stored === "object" &&
      "accessToken" in stored &&
      "refreshToken" in stored &&
      "expiresAt" in stored
    ) {
      return stored as TokenState;
    }
  } catch {
    // Netlify Blobs is unavailable during local builds and before first deploy.
  }

  return {
    accessToken: readEnv("AUDIO_COM_ACCESS_TOKEN"),
    refreshToken: readEnv("AUDIO_COM_REFRESH_TOKEN"),
    expiresAt: 0,
  };
};

const saveTokenState = async (state: TokenState) => {
  try {
    await getTokenStore().setJSON(TOKEN_STORE_KEY, state);
  } catch {
    // A warm function can still reuse the refreshed token in memory.
  }
};

const refreshAccessToken = async (state: TokenState): Promise<TokenState> => {
  const clientId = readEnv("AUDIO_COM_CLIENT_ID");
  const refreshToken = state.refreshToken || readEnv("AUDIO_COM_REFRESH_TOKEN");

  if (!clientId || !refreshToken) {
    throw new Error(
      "Audio.com API credentials are missing. Set AUDIO_COM_CLIENT_ID and AUDIO_COM_REFRESH_TOKEN.",
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const response = await fetch(AUDIO_COM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new AudioComApiError(
      `Audio.com token refresh failed: ${response.status}`,
      response.status,
    );
  }

  const token = (await response.json()) as AudioComTokenResponse;
  if (!token.access_token) {
    throw new Error("Audio.com token refresh returned no access token.");
  }

  const refreshedState = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || refreshToken,
    expiresAt: Date.now() + Math.max(Number(token.expires_in) || 3600, 60) * 1000,
  };
  await saveTokenState(refreshedState);
  return refreshedState;
};

const getAccessToken = async (forceRefresh = false) => {
  if (!tokenStatePromise) tokenStatePromise = loadTokenState();
  let state = await tokenStatePromise;

  const expiresSoon = state.expiresAt > 0 && state.expiresAt <= Date.now() + 60_000;
  if (forceRefresh || !state.accessToken || expiresSoon) {
    tokenStatePromise = refreshAccessToken(state);
    state = await tokenStatePromise;
  }

  return state.accessToken;
};

const apiRequest = async <T>(path: string): Promise<T> => {
  const request = async (forceRefresh = false) => {
    const accessToken = await getAccessToken(forceRefresh);
    return fetch(`${AUDIO_COM_API_URL}${path}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(8000),
    });
  };

  let response = await request();
  if (response.status === 401) response = await request(true);

  if (!response.ok) {
    throw new AudioComApiError(
      `Audio.com API request failed: ${response.status}`,
      response.status,
    );
  }

  return (await response.json()) as T;
};

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const toIsoDate = (timestamp = 0) => {
  const date = new Date(timestamp * 1000);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const parseDatedTitle = (rawTitle: string, uploadedDate: string) => {
  const title = stripHtml(rawTitle);
  const match = title.match(
    /^(?<day>\d{2})[/-](?<month>\d{2})[/-](?<year>\d{2}|\d{4})(?:\s*\/\/\s*|\s+)(?<message>.+?)(?:\s*\/\/\s*|\s+-\s+)(?<speaker>.+)$/,
  );

  if (!match?.groups) {
    return { title, speaker: "St John's Park", date: uploadedDate };
  }

  const year = match.groups.year.length === 2
    ? `20${match.groups.year}`
    : match.groups.year;
  const titleDate = `${year}-${match.groups.month}-${match.groups.day}`;

  return {
    title: match.groups.message.trim(),
    speaker: match.groups.speaker.trim(),
    date: titleDate <= uploadedDate ? titleDate : uploadedDate,
  };
};

const toTalk = (audio: AudioComAudio): Talk | null => {
  if (
    !audio.id ||
    !audio.slug ||
    !audio.title ||
    !audio.is_listed ||
    !audio.play?.url ||
    audio.username !== expectedUsername()
  ) {
    return null;
  }

  const uploadedDate = toIsoDate(audio.date_created);
  const parsedTitle = parseDatedTitle(audio.title, uploadedDate);

  return {
    id: `audio-com:${audio.id}`,
    title: parsedTitle.title,
    speaker: parsedTitle.speaker,
    date: parsedTitle.date,
    series: "Sunday Talks",
    passage: "",
    audioUrl: `/podcast/audio/${encodeURIComponent(audio.id)}`,
    sourceUrl: `${AUDIO_COM_PROFILE_URL}/audio/${encodeURIComponent(audio.slug)}`,
    imageUrl: audio.image || "",
    description:
      stripHtml(audio.description || "") ||
      "Sunday teaching from our church family.",
    duration: Math.round((Number(audio.play.duration) || 0) / 1000),
    audioType: "audio/mpeg",
  };
};

const sortByDateDescending = (left: Talk, right: Talk) =>
  right.date.localeCompare(left.date) || left.title.localeCompare(right.title);

export const getAudioComTalks = async (): Promise<Talk[]> => {
  const audio: AudioComAudio[] = [];

  for (let page = 1; ; page += 1) {
    const items = await apiRequest<AudioComAudio[]>(
      `/audio/list?sort=newest&page=${page}&per-page=${PAGE_SIZE}`,
    );
    audio.push(...items);
    if (items.length < PAGE_SIZE) break;
  }

  return audio
    .map(toTalk)
    .filter((talk): talk is Talk => Boolean(talk))
    .sort(sortByDateDescending);
};

export const getAudioComAudio = async (id: string) => {
  const audio = await apiRequest<AudioComAudio>(
    `/audio/view?id=${encodeURIComponent(id)}`,
  );

  if (
    !audio.is_listed ||
    !audio.play?.url ||
    audio.username !== expectedUsername()
  ) {
    throw new AudioComApiError("Audio.com recording was not found.", 404);
  }

  return audio;
};
