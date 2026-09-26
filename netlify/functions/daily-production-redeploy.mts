declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
};

function isTwoPmInLondon(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return parts.find((part) => part.type === "hour")?.value === "14";
}

export default async () => {
  // Netlify schedules run in UTC. Running hourly and checking London time keeps
  // this at 14:00 local time across both GMT and BST.
  if (!isTwoPmInLondon()) {
    console.log("Skipping daily redeploy: it is not 14:00 in Europe/London.");
    return;
  }

  const buildHookUrl = Netlify.env.get("PRODUCTION_BUILD_HOOK_URL");

  if (!buildHookUrl) {
    console.error(
      "PRODUCTION_BUILD_HOOK_URL is not configured; production redeploy was not triggered.",
    );
    return;
  }

  const response = await fetch(buildHookUrl, { method: "POST" });

  if (!response.ok) {
    throw new Error(
      `Production build hook failed with HTTP ${response.status}: ${await response.text()}`,
    );
  }

  console.log("Triggered the daily 14:00 Europe/London production redeploy.");
};

export const config = {
  schedule: "0 * * * *",
};
