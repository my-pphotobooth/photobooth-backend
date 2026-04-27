import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import { config } from './config.js'
import { photosRouter } from './routes/photos.js'
import { framesRouter, frameCategoriesRouter } from './routes/frames.js'
import { errorHandler } from './middleware/errorHandler.js'
import { query } from './db/pool.js'

export function createApp() {
  const app = express()

  app.use(cors({ origin: config.corsOrigin }))
  app.use(express.json())

  app.use(
    '/uploads',
    express.static(path.resolve(config.uploadDir), {
      index: false,
      fallthrough: false,
    }),
  )

  app.get('/api/health', async (_req, res) => {
    try {
      await query('SELECT 1')
      res.json({ ok: true })
    } catch {
      res.status(503).json({ ok: false })
    }
  })

  const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })

  app.use('/api/photos', (req, res, next) => {
    if (req.method === 'POST') return uploadLimiter(req, res, next)
    next()
  })
  app.use('/api/photos', photosRouter)
  app.use('/api/frames', framesRouter)
  app.use('/api/frame-categories', frameCategoriesRouter)

  app.use(errorHandler)

  return app
}
