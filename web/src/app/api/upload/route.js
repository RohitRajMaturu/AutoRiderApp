import { auth } from "@/auth";
import { buildObjectKey, saveUpload } from "@/app/api/utils/object-storage";

const MAX_BYTES = 5 * 1024 * 1024;
const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function parseBase64Image(value) {
  if (typeof value !== "string") return null;

  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }

  return { mimeType: "image/jpeg", data: value };
}

async function readUploadPayload(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const scope = String(form.get("scope") || "kyc");
    if (!(file instanceof File)) return null;
    return {
      scope,
      mimeType: file.type || "image/jpeg",
      buffer: Buffer.from(await file.arrayBuffer()),
    };
  }

  const body = await request.json().catch(() => ({}));
  const parsed = parseBase64Image(body.base64);
  if (!parsed) return null;
  return {
    scope: typeof body.scope === "string" ? body.scope : "general",
    mimeType: parsed.mimeType,
    buffer: Buffer.from(parsed.data, "base64"),
  };
}

function getOrigin(request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export async function POST(request) {
  try {
    const session = await auth(request);
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const upload = await readUploadPayload(request);
    if (!upload || !MIME_EXTENSIONS[upload.mimeType]) {
      return Response.json(
        { error: "Upload a JPEG, PNG, or WebP image" },
        { status: 400 },
      );
    }

    if (!upload.buffer.length || upload.buffer.length > MAX_BYTES) {
      return Response.json(
        { error: "Image must be under 5MB" },
        { status: 413 },
      );
    }

    const extension = MIME_EXTENSIONS[upload.mimeType];
    const key = buildObjectKey({
      userId: session.user.id,
      scope: upload.scope,
      extension,
    });
    const stored = await saveUpload({
      key,
      buffer: upload.buffer,
      contentType: upload.mimeType,
      origin: getOrigin(request),
    });

    return Response.json({
      url: stored.url,
      path: stored.path,
      storageKey: stored.key,
      mimeType: upload.mimeType,
    });
  } catch (err) {
    console.error("POST /api/upload error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
