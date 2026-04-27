import fs from 'node:fs/promises'
import path from 'node:path'
import { nanoid } from 'nanoid'
import { config } from '../config.js'

const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
}

async function ensureDir() {
  await fs.mkdir(config.uploadDir, { recursive: true })
}

export const localStorage = {
  async put(buffer, { mimeType }) {
    await ensureDir()
    const ext = EXT_BY_MIME[mimeType]
    if (!ext) throw new Error(`unsupported mime type: ${mimeType}`)
    const filename = `${nanoid()}.${ext}`
    const fullPath = path.join(config.uploadDir, filename)
    await fs.writeFile(fullPath, buffer)
    return { filename, sizeBytes: buffer.length }
  },

  getUrl(filename) {
    return `${config.publicBaseUrl}/uploads/${filename}`
  },

  async delete(filename) {
    const fullPath = path.join(config.uploadDir, filename)
    await fs.unlink(fullPath).catch((err) => {
      if (err.code !== 'ENOENT') throw err
    })
  },
}
