import { getBrowserClient } from "@/lib/supabase-client";

/**
 * Upload a transfer receipt to the private payment-proofs bucket.
 *
 * The storage policy requires the first path segment to equal auth.uid():
 *
 *   <uid>/<transactionId>/<stage>-<timestamp>.<ext>
 *
 * If this convention drifts, uploads fail with 400 — which is the intended
 * guard, not a bug: it stops one customer writing into another's folder.
 *
 * The bucket is private. Reading the file back needs a short-lived signed URL
 * (see getProofSignedUrl), and only the owner or an admin may obtain one.
 */

const BUCKET = "payment-proofs";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export class ProofUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProofUploadError";
  }
}

function extensionFor(file: File): string {
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function validateProofFile(file: File): void {
  if (!ALLOWED.includes(file.type)) {
    throw new ProofUploadError("Format harus JPG, PNG, WEBP, atau PDF");
  }
  if (file.size > MAX_BYTES) {
    throw new ProofUploadError("Ukuran file maksimal 5 MB");
  }
  if (file.size === 0) {
    throw new ProofUploadError("File kosong");
  }
}

export async function uploadTransferProof(args: {
  file: File;
  transactionId: string;
  stage: "DP" | "Pelunasan";
}): Promise<string> {
  const client = getBrowserClient();
  if (!client) throw new ProofUploadError("Backend belum dikonfigurasi");

  validateProofFile(args.file);

  const { data: sessionData } = await client.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) throw new ProofUploadError("Harus login terlebih dahulu");

  const path = `${uid}/${args.transactionId}/${args.stage.toLowerCase()}-${Date.now()}.${extensionFor(
    args.file,
  )}`;

  const { error } = await client.storage.from(BUCKET).upload(path, args.file, {
    cacheControl: "3600",
    upsert: true,
    contentType: args.file.type,
  });

  if (error) {
    throw new ProofUploadError(`Gagal mengunggah bukti: ${error.message}`);
  }
  return path;
}

/**
 * Create a short-lived signed URL for an uploaded proof.
 *
 * Default 10 minutes: long enough for a customer to look at their own receipt
 * or an admin to verify it during review, short enough that a leaked URL is
 * worthless soon after.
 */
export async function getProofSignedUrl(
  path: string,
  expiresInSeconds = 600,
): Promise<string | null> {
  const client = getBrowserClient();
  if (!client) return null;

  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);

  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function deleteProof(path: string): Promise<void> {
  const client = getBrowserClient();
  if (!client) return;
  // RLS allows this for admins only; a customer call will fail silently here.
  await client.storage.from(BUCKET).remove([path]);
}
