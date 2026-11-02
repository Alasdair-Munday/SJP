import type { APIRoute } from "astro";
import { AudioComApiError, getAudioComAudio } from "../../../lib/talks/audio-com";

export const prerender = false;

const redirectToAudio: APIRoute = async ({ params }) => {
  const id = params.id || "";
  if (!/^\d+$/.test(id)) {
    return new Response("Invalid recording ID.", { status: 400 });
  }

  try {
    const audio = await getAudioComAudio(id);
    return new Response(null, {
      status: 307,
      headers: {
        Location: audio.play!.url!,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    const status = error instanceof AudioComApiError && error.status === 404 ? 404 : 502;
    return new Response(
      status === 404 ? "Recording not found." : "Recording is temporarily unavailable.",
      { status },
    );
  }
};

export const GET = redirectToAudio;
export const HEAD = redirectToAudio;
