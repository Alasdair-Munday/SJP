import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
});
const { mapAudioComAudio } = await server.ssrLoadModule("/src/lib/talks/audio-com.ts");

const author = "stjohnsparksheffield";
const item = {
  id: "1878753755177196",
  username: author,
  is_listed: true,
  title: "11/10/2026 Matthew 5 - Open Doors - Lee Proudlove",
  slug: "open-doors",
  date_created: Date.parse("2026-10-11") / 1000,
  play: { duration: 2352501, url: "https://example.test/talk.mp3" },
  description: "<p>Hope &amp; welcome</p>",
  image: "https://audio.com/cover.jpeg",
};

try {
  await test("maps Audio.com recordings into first-party talks", () => {
    const talk = mapAudioComAudio(item, author);

    assert.deepEqual(talk, {
      id: "audio-com:1878753755177196",
      title: "Matthew 5 - Open Doors",
      speaker: "Lee Proudlove",
      date: "2026-10-11",
      series: "Sunday Talks",
      passage: "",
      audioUrl: "/podcast/audio/1878753755177196",
      sourceUrl: "https://audio.com/stjohnsparksheffield/audio/open-doors",
      imageUrl: "https://audio.com/cover.jpeg",
      description: "Hope & welcome",
      duration: 2353,
      audioType: "audio/mpeg",
    });
  });

  await test("uses the upload date when a title contains a future date", () => {
    const talk = mapAudioComAudio(
      { ...item, title: "06-09-2029 Creation - Renewal - Tim Cooper" },
      author,
    );

    assert.equal(talk?.date, "2026-10-11");
    assert.equal(talk?.title, "Creation - Renewal");
    assert.equal(talk?.speaker, "Tim Cooper");
  });

  await test("excludes unlisted recordings, other authors, and incomplete records", () => {
    assert.equal(mapAudioComAudio({ ...item, is_listed: false }, author), null);
    assert.equal(mapAudioComAudio({ ...item, username: "someone-else" }, author), null);
    assert.equal(mapAudioComAudio({ ...item, id: undefined }, author), null);
    assert.equal(mapAudioComAudio({ ...item, play: undefined }, author), null);
  });
} finally {
  await server.close();
}
