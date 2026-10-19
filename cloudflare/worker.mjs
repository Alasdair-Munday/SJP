const LEGACY_ORIGIN_DEFAULT = "https://main--stjohnspark.netlify.app";
const ASSET_CDN_BASE_URL_DEFAULT = "https://assets.saintjohnspark.org";
const MANAGED_PREFIXES = ["/images/uploads/", "/images/profile-photos/"];
const ALLOWED_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"]);

const legacyOrigin = (env) => (env.LEGACY_ORIGIN || LEGACY_ORIGIN_DEFAULT).replace(/\/+$/, "");
const assetCdnBase = (env) =>
  (env.ASSET_CDN_BASE_URL || ASSET_CDN_BASE_URL_DEFAULT).replace(/\/+$/, "");

const trimSlashes = (value) => value.replace(/^\/+|\/+$/g, "");
const sanitizeFilename = (filename) =>
  filename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const encodeKey = (key) =>
  key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const isManagedAsset = (pathname) =>
  MANAGED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

const isManagedKey = (key) =>
  MANAGED_PREFIXES.some((prefix) => {
    const cleanPrefix = trimSlashes(prefix);
    return key === cleanPrefix || key.startsWith(`${cleanPrefix}/`);
  });

const toManagedKey = (path) => {
  const key = trimSlashes(path);
  if (!isManagedKey(key)) {
    throw new Error("Asset path must live under /images/uploads or /images/profile-photos.");
  }
  return key;
};

const boundedInt = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const withAssetHeaders = (object) => {
  const headers = new Headers();
  object.writeHttpMetadata?.(headers);
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  else if (object.etag) headers.set("etag", object.etag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return headers;
};

const handleManagedAsset = async (request, env) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed.", { status: 405 });
  }

  const key = toManagedKey(new URL(request.url).pathname);
  const object =
    request.method === "HEAD"
      ? await env.MEDIA_BUCKET.head(key)
      : await env.MEDIA_BUCKET.get(key);

  if (!object) return new Response("Not found.", { status: 404 });

  return new Response(request.method === "HEAD" ? null : object.body, {
    status: 200,
    headers: withAssetHeaders(object),
  });
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

  // Editor-managed images already live in Cloudflare R2. Fetch them from the
  // public R2-backed asset domain so Netlify is not in the image path.
  if (isManagedAsset(src)) {
    const source = new URL(encodeKey(trimSlashes(src)), `${assetCdnBase(env)}/`);
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
  }

  // Repository-bundled images are already part of the Worker asset bundle.
  // Serve the original rather than depending on Netlify solely for resizing.
  const original = await env.ASSETS.fetch(new Request(new URL(src, url.origin), request));
  if (!original.ok) {
    return new Response(original.status === 404 ? "Image not found." : "Image fetch failed.", {
      status: original.status,
    });
  }

  const headers = new Headers(original.headers);
  headers.set("cache-control", "public, max-age=86400, stale-while-revalidate=604800");
  return new Response(original.body, { status: original.status, headers });
};

const listAssets = async (env, folder) => {
  const prefix = `${toManagedKey(folder)}/`;
  const objects = [];
  let cursor;

  do {
    const page = await env.MEDIA_BUCKET.list({
      prefix,
      cursor,
      limit: 1000,
    });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return objects
    .filter((object) =>
      ALLOWED_EXTENSIONS.has(object.key.split(".").pop()?.toLowerCase() || ""),
    )
    .map((object) => ({
      name: object.key.split("/").pop(),
      path: `/${object.key}`,
      cdnUrl: `${assetCdnBase(env)}/${encodeKey(object.key)}`,
      size: object.size,
    }));
};

const uploadAsset = async (request, env) => {
  const form = await request.formData();
  const file = form.get("file");
  const folder = trimSlashes(String(form.get("folder") || "/images/uploads"));

  if (!file || typeof file === "string") {
    throw new Error("Upload requires a file field.");
  }

  const filename = sanitizeFilename(file.name || "upload");
  const extension = filename.split(".").pop()?.toLowerCase() || "";

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Only image uploads are supported.");
  }

  const key = toManagedKey(`${folder}/${filename}`);
  await env.MEDIA_BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

  return {
    name: filename,
    path: `/${key}`,
    cdnUrl: `${assetCdnBase(env)}/${encodeKey(key)}`,
    size: file.size,
  };
};

const handleMedia = async (request, env) => {
  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const folder = url.searchParams.get("folder") || "/images/uploads";
      return Response.json({ items: await listAssets(env, folder) });
    }

    if (request.method === "POST") {
      const accessUser = request.headers.get("cf-access-authenticated-user-email");
      if (env.STAGING_MEDIA_WRITES !== "enabled" || !accessUser) {
        return Response.json(
          {
            error:
              "Media uploads are disabled on staging until Cloudflare Access protects the admin and STAGING_MEDIA_WRITES=enabled.",
          },
          { status: 403 },
        );
      }

      return Response.json({ item: await uploadAsset(request, env) }, { status: 201 });
    }

    return Response.json({ error: "Method not allowed." }, { status: 405 });
  } catch (error) {
    return Response.json({ error: error.message || "Asset media request failed." }, { status: 400 });
  }
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
      return handleManagedAsset(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
