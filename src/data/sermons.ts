export interface Sermon {
    title: string;
    speaker: string;
    date: string; // YYYY-MM-DD
    series: string;
    passage: string;
    audioUrl: string; // URL to the MP3
    description: string;
    duration: number; // in seconds
}

export const sermons: Sermon[] = [
    {
        title: "The Life of Abraham",
        speaker: "Emma Fern",
        date: "2026-01-25",
        series: "The Family of God",
        passage: "Genesis 16",
        audioUrl: "",
        description: "Continuing The Family of God series through the life of Abraham.",
        duration: 1800
    },
    {
        title: "Marriage",
        speaker: "Revd Luke Graham",
        date: "2026-01-18",
        series: "The Family of God",
        passage: "Genesis 12:10-20",
        audioUrl: "https://www.saintjohnspark.org.uk/wp-content/uploads/2026/01/18-01-2026-Revd-Luke-Graham-Genesis-12v10-20-The-Family-of-God.mp3",
        description: "The Family of God series in Genesis.",
        duration: 1800
    },
    {
        title: "The Family of God",
        speaker: "Revd Luke Graham",
        date: "2026-01-11",
        series: "The Family of God",
        passage: "Genesis 12:1-9",
        audioUrl: "https://www.saintjohnspark.org.uk/wp-content/uploads/2026/01/11-01-2026-Revd-Luke-Graham-Genesis-12v1-9-The-Family-of-God.mp3",
        description: "Walking through Genesis and God's covenant family.",
        duration: 1800
    },
    {
        title: "Sunday Talk",
        speaker: "Lucy Wren",
        date: "2026-01-04",
        series: "Sunday Talks",
        passage: "",
        audioUrl: "https://www.saintjohnspark.org.uk/wp-content/uploads/2026/01/04-01-2026-Lucy-Wren.mp3",
        description: "Sunday teaching from our church family.",
        duration: 1800
    },
    {
        title: "Jesus the Humble King",
        speaker: "Revd Luke Graham",
        date: "2025-12-28",
        series: "Advent",
        passage: "Luke 2:8-16",
        audioUrl: "https://www.saintjohnspark.org.uk/wp-content/uploads/2026/01/28-12-2025-Bess-cooper-Luke-2v8–16-Humble-King.mp3",
        description: "Advent reflections on Jesus as the humble King.",
        duration: 1800
    },
    {
        title: "Christmas Day",
        speaker: "Revd Dominic Wachira Maina",
        date: "2025-12-25",
        series: "Christmas",
        passage: "",
        audioUrl: "https://www.saintjohnspark.org.uk/wp-content/uploads/2026/01/25-12-2025-Revd-Dominic-Wachira-Maina-Christmas-Day.mp3",
        description: "Christmas Day celebration.",
        duration: 1800
    },
    {
        title: "Jesus the Eternal King",
        speaker: "Revd Luke Graham",
        date: "2025-12-21",
        series: "Advent",
        passage: "Luke 1:26-38",
        audioUrl: "https://www.saintjohnspark.org.uk/wp-content/uploads/2026/01/21-12-2025-Revd-Luke-Graham-Luke-1v26–38-Eternal-King.mp3",
        description: "Advent reflections on Jesus as the eternal King.",
        duration: 1800
    },
    {
        title: "Jesus the Light Bringer",
        speaker: "Lucy Uren",
        date: "2025-12-07",
        series: "Advent",
        passage: "Genesis 3:8-19; Isaiah 9:2-7",
        audioUrl: "https://www.saintjohnspark.org.uk/wp-content/uploads/2025/12/07-12-2025-Lucy-Uren-Genesis-3v8-19-Isaiah-9v2-7-Jesus-as-the-Light-Bringer.mp3",
        description: "Advent teaching on Jesus bringing light into darkness.",
        duration: 1800
    },
    {
        title: "What Child Is This?",
        speaker: "Revd Al Munday",
        date: "2025-11-30",
        series: "Advent",
        passage: "Genesis 3:8-19",
        audioUrl: "https://www.saintjohnspark.org.uk/wp-content/uploads/2025/12/30-11-2025-Revd-Al-Munday-Genesis-3v8-19-What-child-is-this.mp3",
        description: "Advent series opening message.",
        duration: 1800
    }
];
