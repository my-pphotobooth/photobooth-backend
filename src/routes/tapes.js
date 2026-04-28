import { Router } from 'express'
import { query } from '../db/pool.js'
import { storage } from '../storage/index.js'

export const tapesRouter = Router()

function toTapeDto(row) {
  return {
    id: row.id,
    name: row.name,
    url: storage.getUrl(row.filename),
    sortOrder: row.sort_order,
  }
}

tapesRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, filename, sort_order
       FROM tapes
       WHERE active = true
       ORDER BY sort_order ASC, name ASC`,
    )
    res.json({ items: rows.map(toTapeDto) })
  } catch (err) {
    next(err)
  }
})
