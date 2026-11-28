export function newsletterOptions(params: URLSearchParams) {
  return {
    campaign: params.get("campaign") ?? "",
    includedPosts: params.has("select") ? new Set(params.getAll("post")) : undefined,
    includedEvents: params.has("select") ? new Set(params.getAll("event")) : undefined,
  };
}

export function newsletterQuery(date: string, options: ReturnType<typeof newsletterOptions>) {
  const params = new URLSearchParams({ date });
  if (options.campaign) params.set("campaign", options.campaign);
  if (options.includedPosts) {
    params.set("select", "1");
    for (const post of options.includedPosts) params.append("post", post);
    for (const event of options.includedEvents ?? []) params.append("event", event);
  }
  return params.toString();
}
