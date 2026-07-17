import 'dotenv/config'

function required(name) {
  const v = process.env[name]
  if (!v) throw new Error(`missing env: ${name}`)
  return v
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000',
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_BYTES ?? 5 * 1024 * 1024),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  storageDriver: process.env.STORAGE_DRIVER ?? 'local',
  adminPassword: process.env.ADMIN_PASSWORD ?? null,
  jwtSecret: process.env.JWT_SECRET ?? null,
  aws: {
    region: process.env.AWS_REGION ?? 'ap-northeast-2',
    s3Bucket: process.env.S3_BUCKET ?? null,
    s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? null,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? null,
    chatId: process.env.TELEGRAM_CHAT_ID ?? null,
  },
}
