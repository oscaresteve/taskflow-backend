import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "./s3-client.ts";
import { env } from "../../config/env.ts";

const DEFAULT_UPLOAD_URL_EXPIRES_IN_SECONDS = 300; // 5 minutos, tiempo de sobra para que el cliente haga el PUT

export async function getUploadUrl({
  key,
  contentType,
  expiresIn = DEFAULT_UPLOAD_URL_EXPIRES_IN_SECONDS,
}: {
  key: string;
  contentType: string;
  expiresIn?: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export function buildPublicUrl({ key }: { key: string }): string {
  return `${env.S3_PUBLIC_URL_BASE}/${key}`;
}

export async function deleteObject({ key }: { key: string }): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key }));
}

// Comprueba que el archivo se subió de verdad y devuelve sus metadatos reales (no los que declaró el cliente).
export async function headObject({
  key,
}: {
  key: string;
}): Promise<{ contentType: string | undefined; contentLength: number } | null> {
  try {
    const result = await s3Client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key }));
    return { contentType: result.ContentType, contentLength: result.ContentLength ?? 0 };
  } catch (error) {
    if (error instanceof Error && error.name === "NotFound") return null;
    throw error;
  }
}
