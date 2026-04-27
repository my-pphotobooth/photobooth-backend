import multer from 'multer'

export function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code })
  }
  if (err?.message === 'unsupported file type') {
    return res.status(415).json({ error: 'unsupported file type' })
  }
  console.error(err)
  res.status(500).json({ error: 'internal error' })
}
