import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const STORAGE_PROVIDER = process.env.UPLOAD_STORAGE_PROVIDER || "local";
const SIGNED_URL_TTL_SECONDS = Number(
  process.env.UPLOAD_SIGNED_URL_TTL_SECONDS || 3600,
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value).digest(encoding);
}

function amzDate(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function dateStamp(value) {
  return value.slice(0, 8);
}

function encodePath(value) {
  return String(value)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function normalizeEndpoint(value) {
  return String(value || "").replace(/\/+$/, "");
}

function readS3Config() {
  const endpoint = normalizeEndpoint(process.env.UPLOAD_S3_ENDPOINT);
  const bucket = process.env.UPLOAD_S3_BUCKET;
  const accessKeyId = process.env.UPLOAD_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.UPLOAD_S3_SECRET_ACCESS_KEY;
  const region = process.env.UPLOAD_S3_REGION || "auto";

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3-compatible upload storage is not fully configured");
  }

  return { endpoint, bucket, accessKeyId, secretAccessKey, region };
}

function s3ObjectUrl(config, key) {
  return new URL(`/${config.bucket}/${encodePath(key)}`, config.endpoint);
}

function signingKey(secretAccessKey, stamp, region) {
  const kDate = hmac(`AWS4${secretAccessKey}`, stamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function authorizationHeader({
  config,
  method,
  objectUrl,
  payloadHash,
  contentType,
  now,
}) {
  const stamp = dateStamp(now);
  const credentialScope = `${stamp}/${config.region}/s3/aws4_request`;
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${objectUrl.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${now}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    objectUrl.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    now,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const signature = hmac(
    signingKey(config.secretAccessKey, stamp, config.region),
    stringToSign,
    "hex",
  );
  return `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function putS3Object({ key, buffer, contentType }) {
  const config = readS3Config();
  const objectUrl = s3ObjectUrl(config, key);
  const now = amzDate();
  const payloadHash = sha256(buffer);
  const res = await fetch(objectUrl, {
    method: "PUT",
    headers: {
      authorization: authorizationHeader({
        config,
        method: "PUT",
        objectUrl,
        payloadHash,
        contentType,
        now,
      }),
      "content-type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": now,
    },
    body: buffer,
  });

  if (!res.ok) {
    throw new Error(`Object storage upload failed: ${res.status}`);
  }

  return {
    key,
    path: `s3://${config.bucket}/${key}`,
    url: process.env.UPLOAD_PUBLIC_BASE_URL
      ? `${normalizeEndpoint(process.env.UPLOAD_PUBLIC_BASE_URL)}/${encodePath(key)}`
      : presignS3GetUrl({ key, config }),
  };
}

function presignS3GetUrl({ key, config = readS3Config() }) {
  const objectUrl = s3ObjectUrl(config, key);
  const now = amzDate();
  const stamp = dateStamp(now);
  const credentialScope = `${stamp}/${config.region}/s3/aws4_request`;
  const expires = Math.min(Math.max(SIGNED_URL_TTL_SECONDS, 60), 604800);
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": now,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  });
  const canonicalQuery = params.toString();
  const canonicalRequest = [
    "GET",
    objectUrl.pathname,
    canonicalQuery,
    `host:${objectUrl.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    now,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  params.set(
    "X-Amz-Signature",
    hmac(
      signingKey(config.secretAccessKey, stamp, config.region),
      stringToSign,
      "hex",
    ),
  );
  objectUrl.search = params.toString();
  return objectUrl.toString();
}

export function buildObjectKey({ userId, scope = "general", extension }) {
  const safeScope = String(scope || "general").replace(/[^a-z0-9_-]/gi, "-");
  const safeUserId = String(userId || "anonymous").replace(/[^a-z0-9_-]/gi, "-");
  return `${safeScope}/${safeUserId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
}

export async function saveUpload({ key, buffer, contentType, origin }) {
  if (STORAGE_PROVIDER === "s3" || STORAGE_PROVIDER === "r2") {
    return putS3Object({ key, buffer, contentType });
  }

  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  const filename = path.basename(key);
  await writeFile(path.join(LOCAL_UPLOAD_DIR, filename), buffer);
  const pathUrl = `/uploads/${filename}`;
  return {
    key: filename,
    path: pathUrl,
    url: `${origin}${pathUrl}`,
  };
}

export function resolveUploadUrl(value, origin) {
  if (!value) return value;
  const text = String(value);
  if (text.startsWith("s3://")) {
    const config = readS3Config();
    const prefix = `s3://${config.bucket}/`;
    if (!text.startsWith(prefix)) return text;
    return process.env.UPLOAD_PUBLIC_BASE_URL
      ? `${normalizeEndpoint(process.env.UPLOAD_PUBLIC_BASE_URL)}/${encodePath(
          text.slice(prefix.length),
        )}`
      : presignS3GetUrl({ key: text.slice(prefix.length), config });
  }
  if (text.startsWith("/")) return `${origin}${text}`;
  return text;
}

export function resolveDriverUploadUrls(driver, origin) {
  if (!driver) return driver;
  return {
    ...driver,
    auto_photo_storage_path: driver.auto_photo_url || null,
    license_storage_path: driver.license_url || null,
    rc_photo_storage_path: driver.rc_photo_url || null,
    selfie_storage_path: driver.selfie_url || null,
    auto_photo_url: resolveUploadUrl(driver.auto_photo_url, origin),
    license_url: resolveUploadUrl(driver.license_url, origin),
    rc_photo_url: resolveUploadUrl(driver.rc_photo_url, origin),
    selfie_url: resolveUploadUrl(driver.selfie_url, origin),
  };
}
