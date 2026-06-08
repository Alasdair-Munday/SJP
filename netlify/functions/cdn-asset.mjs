const managedPrefixes = ["images/uploads", "images/profile-photos"];

const trimSlashes = (value) => value.replace(/^\/+|\/+$/g, "");

const getAssetPath = (event) => {
  const url = new URL(event.rawUrl);
  const explicitPath = url.searchParams.get("path");

  if (explicitPath) {
    return trimSlashes(decodeURIComponent(explicitPath));
  }

  return trimSlashes(decodeURIComponent(url.pathname));
};

const isManagedAssetPath = (path) =>
  managedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const getContentType = (path, upstreamType) => {
  if (upstreamType) return upstreamType;

  const extension = path.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "avif":
      return "image/avif";
    case "gif":
      return "image/gif";
    case "jpeg":
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "svg":
      return "image/svg+xml";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
};

export default async (request, context) => {
  const assetPath = getAssetPath(context);
  const baseUrl = process.env.ASSET_CDN_BASE_URL;

  if (!baseUrl) {
    return new Response("ASSET_CDN_BASE_URL is not configured.", { status: 500 });
  }

  if (!isManagedAssetPath(assetPath)) {
    return new Response("Not found.", { status: 404 });
  }

  const originUrl = new URL(`${trimSlashes(assetPath)}`, `${baseUrl.replace(/\/+$/, "")}/`);
  const upstream = await fetch(originUrl, {
    headers: {
      accept: request.headers.get("accept") ?? "*/*",
      "user-agent": request.headers.get("user-agent") ?? "Netlify asset proxy",
    },
  });

  if (!upstream.ok) {
    return new Response(upstream.status === 404 ? "Not found." : "Asset origin error.", {
      status: upstream.status,
    });
  }

  const headers = new Headers();
  headers.set("content-type", getContentType(assetPath, upstream.headers.get("content-type")));
  headers.set("cache-control", "public, max-age=31536000, immutable");

  const etag = upstream.headers.get("etag");
  if (etag) headers.set("etag", etag);

  const lastModified = upstream.headers.get("last-modified");
  if (lastModified) headers.set("last-modified", lastModified);

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
};
