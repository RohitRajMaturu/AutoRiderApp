import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";

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

    const body = await request.json().catch(() => ({}));
    const parsed = parseBase64Image(body.base64);
    if (!parsed || !MIME_EXTENSIONS[parsed.mimeType]) {
      return Response.json(
        { error: "Upload a JPEG, PNG, or WebP image" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(parsed.data, "base64");
    if (!buffer.length || buffer.length > MAX_BYTES) {
      return Response.json(
        { error: "Image must be under 5MB" },
        { status: 413 },
      );
    }

    const extension = MIME_EXTENSIONS[parsed.mimeType];
    const filename = `${randomUUID()}.${extension}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);

    const pathUrl = `/uploads/${filename}`;
    return Response.json({
      url: `${getOrigin(request)}${pathUrl}`,
      path: pathUrl,
      mimeType: parsed.mimeType,
    });
  } catch (err) {
    console.error("POST /api/upload error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
