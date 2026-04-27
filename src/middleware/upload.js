import multer from 'multer'
import { config } from '../config.js'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg'])

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error('unsupported file type'))
      return
    }
    cb(null, true)
  },
})
