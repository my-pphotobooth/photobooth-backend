import { Router } from 'express'
import { nanoid } from 'nanoid'
import { query } from '../db/pool.js'
import { storage } from '../storage/index.js'
import { upload } from '../middleware/upload.js'

export const photosRouter = Router()

function toDto(row) {
  return {
    id: row.id,
    url: storage.getUrl(row.filename),
    createdAt: row.created_at.toISOString(),
  }
}

photosRouter.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' })

    const { filename, sizeBytes } = await storage.put(req.file.buffer, {
      mimeType: req.file.mimetype,
    })
    const id = nanoid()

    const { rows } = await query(
      `INSERT INTO photos (id, filename, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, filename, created_at`,
      [id, filename, req.file.mimetype, sizeBytes],
    )

    res.status(201).json(toDto(rows[0]))
  } catch (err) {
    next(err)
  }
})

photosRouter.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 24, 100)
    const cursor = req.query.cursor

    const params = []
    let where = 'WHERE deleted_at IS NULL'
    if (cursor) {
      params.push(cursor)
      where += ` AND created_at < $${params.length}`
    }
    params.push(limit + 1)

    const { rows } = await query(
      `SELECT id, filename, created_at
       FROM photos
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    )

    const hasMore = rows.length > limit
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toDto)
    const nextCursor = hasMore ? rows[limit - 1].created_at.toISOString() : null

    res.json({ items, nextCursor })
  } catch (err) {
    next(err)
  }
})

photosRouter.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, filename, created_at
       FROM photos
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json(toDto(rows[0]))
  } catch (err) {
    next(err)
  }
})

photosRouter.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `UPDATE photos
       SET deleted_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id],
    )
    if (rowCount === 0) return res.status(404).json({ error: 'not found' })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
