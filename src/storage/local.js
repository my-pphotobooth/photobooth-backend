import fs from 'node:fs/promises'
import path from 'node:path'
import { nanoid } from 'nanoid'
import { config } from '../config.js'

const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
}

export const localStorage = {
  async put(buffer, { mimeType, prefix } = {}) {
    const ext = EXT_BY_MIME[mimeType]
    if (!ext) throw new Error(`unsupported mime type: ${mimeType}`)
    const baseName = `${nanoid()}.${ext}`
    const filename = prefix ? `${prefix}/${baseName}` : baseName

    const dir = prefix
      ? path.join(config.uploadDir, prefix)
      : config.uploadDir
    await fs.mkdir(dir, { recursive: true })

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
