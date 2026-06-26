import { randomUUID } from "node:crypto";
import type { ThreadAttachment } from "@/lib/bank/loan-application-thread-types";
import { put } from "@vercel/blob";
import { assertThreadAccessForUpload } from "@/server/loan-application-thread.service";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function attachmentType(mime: string): ThreadAttachment["type"] {
  if (mime.startsWith("image/")) return "IMAGE";
  return "FILE";
}

export async function uploadThreadAttachment(
  userId: string,
  applicationId: string,
  file: File,
): Promise<ThreadAttachment> {
  await assertThreadAccessForUpload(userId, applicationId);

  if (file.size > MAX_BYTES) {
    throw new Error("BAD_REQUEST:File exceeds 15 MB limit.");
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("BAD_REQUEST:File type not supported.");
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error("BAD_REQUEST:File upload is not configured yet. Paste links in your message instead.");
  }

  const id = randomUUID();
  const pathname = `loan-threads/${applicationId}/${id}/${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let blob;
  try {
    blob = await put(pathname, buffer, {
      access: "public",
      contentType: file.type,
      token,
      addRandomSuffix: false,
    });
  } catch {
    throw new Error("BAD_REQUEST:Upload failed. Please try again.");
  }

  return {
    type: attachmentType(file.type),
    fileName: file.name,
    url: blob.url,
    mimeType: file.type,
    fileSizeBytes: file.size,
  };
}
