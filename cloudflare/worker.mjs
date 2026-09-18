const LEGACY_ORIGIN_DEFAULT = "https://stjohnspark.org";
const MANAGED_PREFIXES = ["/images/uploads/", "/images/profile-photos/"];

const legacyOrigin = (env) => (env.LEGACY_ORIGIN || LEGACY_ORIGIN_DEFAULT).replace(/\/+$/, "");

const isManagedAsset = (pathname) =>
  MANAGED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

const isReadMethod = (method) => method === "GET" || method === "HEAD";

const boundedInt = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const proxyToLegacy = async (request, env, pathname) => {
  const incoming = new URL(request.url);
  const target = new URL(pathname, `${legacyOrigin(env)}/`);
  target.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ipcountry");
  headers.delete("cf-ray");
  headers.delete("cf-visitor");

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (!isReadMethod(request.method)) init.body = request.body;
  return fetch(target, init);
};

const handleOptimizedImage = async (request, env) => {
  const url = new URL(request.url);
  const src = url.searchParams.get("src") || "";

  if (!src.startsWith("/") || src.startsWith("//")) {
    return new Response("Invalid image source.", { status: 400 });
  }

  const width = boundedInt(url.searchParams.get("w"), 1200, 16, 2400);
  const height = boundedInt(url.searchParams.get("h"), 1200, 16, 2400);
  const quality = boundedInt(url.searchParams.get("q"), 76, 40, 95);
  const source = new URL(src, `${legacyOrigin(env)}/`);

  const response = await fetch(source, {
    cf: {
      image: {
        width,
        height,
        fit: "cover",
        quality,
        format: "auto",
      },
    },
  });

  if (!response.ok) {
    return new Response(response.status === 404 ? "Image not found." : "Image transform failed.", {
      status: response.status,
    });
  }

  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=86400, stale-while-revalidate=604800");
  return new Response(response.body, { status: response.status, headers });
};

const handleMedia = async (request, env) => {
  if (request.method === "POST") {
    const accessUser = request.headers.get("cf-access-authenticated-user-email");
    if (env.STAGING_MEDIA_WRITES !== "enabled" || !accessUser) {
      return Response.json(
        {
          error:
            "Media uploads are disabled on staging until Cloudflare Access is protecting the admin and STAGING_MEDIA_WRITES=enabled.",
        },
        { status: 403 },
      );
    }
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  return proxyToLegacy(request, env, "/.netlify/functions/cdn-media");
};

const handleContact = async (request, env) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed.", { status: 405 });
  }

  const incoming = new URL(request.url);
  const target = new URL("/contact", `${legacyOrigin(env)}/`);
  const headers = new Headers(request.headers);
  headers.delete("host");

  const upstream = await fetch(target, {
    method: "POST",
    headers,
    body: request.body,
    redirect: "manual",
  });

  if (upstream.ok || (upstream.status >= 300 && upstream.status < 400)) {
    return Response.redirect(new URL("/contact-thank-you", incoming.origin), 303);
  }

  return new Response("Unable to submit the contact form.", { status: 502 });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/admin") {
      return Response.redirect(new URL("/admin/", url.origin), 301);
    }

    if (url.pathname === "/admin/") {
      return env.ASSETS.fetch(new Request(new URL("/admin/index.html", url), request));
    }

    if (url.pathname === "/__image") {
      return handleOptimizedImage(request, env);
    }

    if (url.pathname === "/api/media") {
      return handleMedia(request, env);
    }

    if (url.pathname === "/api/contact") {
      return handleContact(request, env);
    }

    if (isManagedAsset(url.pathname)) {
      return proxyToLegacy(request, env, url.pathname);
    }

    return env.ASSETS.fetch(request);
  },
};
