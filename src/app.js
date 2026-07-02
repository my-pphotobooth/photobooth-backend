import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import { config } from './config.js'
import { photosRouter } from './routes/photos.js'
import { framesRouter, frameCategoriesRouter } from './routes/frames.js'
import {
  basicLayoutsRouter,
  colorChipsRouter,
} from './routes/basicFrames.js'
import { tapesRouter, tapeCategoriesRouter } from './routes/tapes.js'
import { gangminRouter } from './routes/gangmin.js'
import { errorHandler } from './middleware/errorHandler.js'
import { query } from './db/pool.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)

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

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
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
  app.use('/api/basic-layouts', basicLayoutsRouter)
  app.use('/api/color-chips', colorChipsRouter)
  app.use('/api/tapes', tapesRouter)
  app.use('/api/tape-categories', tapeCategoriesRouter)
  app.use('/api/gangmin/login', loginLimiter)
  app.use('/api/gangmin', gangminRouter)

  app.use(errorHandler)

  return app
}
