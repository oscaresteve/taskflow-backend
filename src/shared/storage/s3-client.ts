import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../../config/env.ts";

// Cliente único compatible con la API de S3: en dev apunta a MinIO, en prod a Cloudflare R2.
// El código que lo usa no sabe (ni le importa) contra cuál de los dos está hablando.
export const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
});
