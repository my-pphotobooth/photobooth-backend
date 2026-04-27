import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { nanoid } from 'nanoid'
import { config } from '../config.js'

const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
}

let client = null
function getClient() {
  if (!client) {
    if (!config.aws.s3Bucket) {
      throw new Error('S3_BUCKET env var is required when STORAGE_DRIVER=s3')
    }
    client = new S3Client({ region: config.aws.region })
  }
  return client
}

function buildPublicUrl(key) {
  if (config.aws.s3PublicBaseUrl) {
    return `${config.aws.s3PublicBaseUrl.replace(/\/$/, '')}/${key}`
  }
  return `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${key}`
}

export const s3Storage = {
  async put(buffer, { mimeType, prefix } = {}) {
    const ext = EXT_BY_MIME[mimeType]
    if (!ext) throw new Error(`unsupported mime type: ${mimeType}`)
    const baseName = `${nanoid()}.${ext}`
    const key = prefix ? `${prefix}/${baseName}` : baseName

    await getClient().send(
      new PutObjectCommand({
        Bucket: config.aws.s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    )

    return { filename: key, sizeBytes: buffer.length }
  },

  getUrl(filename) {
    return buildPublicUrl(filename)
  },

  async delete(filename) {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: config.aws.s3Bucket,
        Key: filename,
      }),
    )
  },
}
