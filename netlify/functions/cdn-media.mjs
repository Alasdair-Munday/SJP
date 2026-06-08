import { createHash, createHmac } from "node:crypto";

const managedPrefixes = ["images/uploads", "images/profile-photos"];
const allowedExtensions = new Set(["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"]);

const env = (name) => process.env[name] || "";
const trimSlashes = (value) => value.replace(/^\/+|\/+$/g, "");
const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const hmac = (key, value, encoding) => createHmac("sha256", key).update(value).digest(encoding);
const encodePathSegment = (segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
const encodeKey = (key) => key.split("/").map(encodePathSegment).join("/");
const sanitizeFilename = (filename) => filename.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

const r2Host = () => `${env("CLOUDFLARE_R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`;
const bucket = () => env("CLOUDFLARE_R2_BUCKET");
const baseUrl = () => env("ASSET_CDN_BASE_URL").replace(/\/+$/, "");

const getSigningKey = (dateStamp) => {
  const dateKey = hmac(`AWS4${env("CLOUDFLARE_R2_SECRET_ACCESS_KEY")}`, dateStamp);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
};

const assertConfigured = () => {
  const missing = [
    "ASSET_CDN_BASE_URL",
    "CLOUDFLARE_R2_ACCOUNT_ID",
    "CLOUDFLARE_R2_BUCKET",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  ].filter((name) => !env(name));

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};

const isManagedKey = (key) =>
  managedPrefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}/`));

const toKeyFromPath = (path) => {
  const cleanPath = trimSlashes(path);
  if (!isManagedKey(cleanPath)) {
    throw new Error("Asset path must live under /images/uploads or /images/profile-photos.");
  }
  return cleanPath;
};

const signR2Request = async ({ method, key = "", query = "", body = new Uint8Array(), contentType = "" }) => {
  assertConfigured();

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const host = r2Host();
  const canonicalUri = `/${bucket()}${key ? `/${encodeKey(key)}` : ""}`;
  const payloadHash = sha256Hex(body);
  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  if (contentType) headers["content-type"] = contentType;

  const sortedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join("");
  const signedHeaders = sortedHeaderNames.join(";");
  const canonicalRequest = [method, canonicalUri, query, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signature = hmac(getSigningKey(dateStamp), stringToSign, "hex");

  headers.authorization = `AWS4-HMAC-SHA256 Credential=${env("CLOUDFLARE_R2_ACCESS_KEY_ID")}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(`https://${host}${canonicalUri}${query ? `?${query}` : ""}`, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
};

const listAssets = async (folder) => {
  const prefix = `${trimSlashes(folder)}/`;
  const keyPrefix = toKeyFromPath(prefix);
  const query = new URLSearchParams({ "list-type": "2", prefix: keyPrefix }).toString();
  const response = await signR2Request({ method: "GET", query });
  const xml = await response.text();

  if (!response.ok) {
    throw new Error(`Unable to list assets from Cloudflare R2 (${response.status}).`);
  }

  return Array.from(xml.matchAll(/<Contents>[\s\S]*?<Key>([\s\S]*?)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g))
    .map((match) => {
      const key = match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      return {
        name: key.split("/").pop(),
        path: `/${key}`,
        cdnUrl: `${baseUrl()}/${encodeKey(key)}`,
        size: Number(match[2]),
      };
    })
    .filter((item) => allowedExtensions.has(item.name.split(".").pop()?.toLowerCase() || ""));
};

const uploadAsset = async (request) => {
  const form = await request.formData();
  const file = form.get("file");
  const folder = trimSlashes(String(form.get("folder") || "/images/uploads"));

  if (!file || typeof file === "string") {
    throw new Error("Upload requires a file field.");
  }

  const filename = sanitizeFilename(file.name || "upload");
  const extension = filename.split(".").pop()?.toLowerCase() || "";

  if (!allowedExtensions.has(extension)) {
    throw new Error("Only image uploads are supported.");
  }

  const key = toKeyFromPath(`${folder}/${filename}`);
  const body = new Uint8Array(await file.arrayBuffer());
  const response = await signR2Request({
    method: "PUT",
    key,
    body,
    contentType: file.type || "application/octet-stream",
  });

  if (!response.ok) {
    throw new Error(`Unable to upload asset to Cloudflare R2 (${response.status}).`);
  }

  return {
    name: filename,
    path: `/${key}`,
    cdnUrl: `${baseUrl()}/${encodeKey(key)}`,
    size: body.byteLength,
  };
};

export default async (request) => {
  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const folder = url.searchParams.get("folder") || "/images/uploads";
      return Response.json({ items: await listAssets(folder) });
    }

    if (request.method === "POST") {
      return Response.json({ item: await uploadAsset(request) }, { status: 201 });
    }

    return Response.json({ error: "Method not allowed." }, { status: 405 });
  } catch (error) {
    return Response.json({ error: error.message || "Asset media request failed." }, { status: 400 });
  }
};
