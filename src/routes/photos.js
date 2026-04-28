import { Router } from 'express'
import { nanoid } from 'nanoid'
import { query } from '../db/pool.js'
import { storage } from '../storage/index.js'
import { upload } from '../middleware/upload.js'

export const photosRouter = Router()

function toDto(row) {
  const tape =
    row.tape_id && row.tape_filename
      ? {
          id: row.tape_id,
          name: row.tape_name,
          url: storage.getUrl(row.tape_filename),
        }
      : null
  return {
    id: row.id,
    url: storage.getUrl(row.filename),
    createdAt: row.created_at.toISOString(),
    tape,
  }
}

photosRouter.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' })
    const frameId = req.body?.frameId || null
    const tapeId = req.body?.tapeId || null

    const { filename, sizeBytes } = await storage.put(req.file.buffer, {
      mimeType: req.file.mimetype,
    })
    const id = nanoid()

    try {
      const { rows } = await query(
        `INSERT INTO photos (id, filename, mime_type, size_bytes, frame_id, tape_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, filename, created_at, tape_id,
                   NULL::text AS tape_name, NULL::text AS tape_filename`,
        [id, filename, req.file.mimetype, sizeBytes, frameId, tapeId],
      )
      res.status(201).json(toDto(rows[0]))
    } catch (err) {
      if (err.code === '23503') {
        await storage.delete(filename)
        return res.status(400).json({ error: 'invalid frameId or tapeId' })
      }
      throw err
    }
  } catch (err) {
    next(err)
  }
})

photosRouter.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 24, 100)
    const cursor = req.query.cursor

    const params = []
    let where = 'WHERE p.deleted_at IS NULL'
    if (cursor) {
      params.push(cursor)
      where += ` AND p.created_at < $${params.length}`
    }
    params.push(limit + 1)

    const { rows } = await query(
      `SELECT p.id, p.filename, p.created_at,
              p.tape_id, t.name AS tape_name, t.filename AS tape_filename
       FROM photos p
       LEFT JOIN tapes t ON t.id = p.tape_id
       ${where}
       ORDER BY p.created_at DESC
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
      `SELECT p.id, p.filename, p.created_at,
              p.tape_id, t.name AS tape_name, t.filename AS tape_filename
       FROM photos p
       LEFT JOIN tapes t ON t.id = p.tape_id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
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
