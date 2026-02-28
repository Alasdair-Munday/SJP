import oauthProvider from "netlify-cms-oauth-provider-node";

const { createHandlers } = oauthProvider as {
  createHandlers: (config: Record<string, unknown>) => {
    begin: (state?: string) => Promise<string>;
    complete: (code?: string, params?: Record<string, string>) => Promise<string>;
  };
};

const resolveSiteUrl = () => {
  const candidates = [
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.DEPLOY_URL,
    process.env.SITE_URL,
    "https://stjohnspark.church",
  ];

  const first = candidates.find((value) => typeof value === "string" && value.length > 0);
  return first as string;
};

const siteUrl = resolveSiteUrl();
const completeUrl =
  process.env.OAUTH_CALLBACK_URL || `${siteUrl}/.netlify/functions/auth/callback`;

const getHandlers = () => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    throw new Error(
      "Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET for Decap OAuth.",
    );
  }

  return createHandlers({
    origin: process.env.OAUTH_ORIGIN || siteUrl,
    completeUrl,
    oauthProvider: "github",
    oauthClientID: process.env.GITHUB_CLIENT_ID,
    oauthClientSecret: process.env.GITHUB_CLIENT_SECRET,
    adminPanelUrl: `${siteUrl}/admin/`,
  });
};

export const handler = async (event: {
  path?: string;
  rawUrl?: string;
  pathParameters?: { splat?: string };
  queryStringParameters?: Record<string, string | undefined>;
}) => {
  try {
    const handlers = getHandlers();
    const rawPath = event.rawUrl ? new URL(event.rawUrl).pathname : event.path || "";
    const isCallback =
      rawPath.endsWith("/callback") || event.pathParameters?.splat === "callback";

    if (isCallback) {
      const code = event.queryStringParameters?.code || "";
      const html = await handlers.complete(code, (event.queryStringParameters || {}) as Record<string, string>);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
        body: html,
      };
    }

    const state = event.queryStringParameters?.state || "";
    const authorizationUrl = await handlers.begin(state);

    return {
      statusCode: 302,
      headers: {
        Location: authorizationUrl,
        "Cache-Control": "no-store",
      },
      body: "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OAuth error";

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: `OAuth error: ${message}`,
    };
  }
};
