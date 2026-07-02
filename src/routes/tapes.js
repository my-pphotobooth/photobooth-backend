import { Router } from 'express'
import { query } from '../db/pool.js'
import { storage } from '../storage/index.js'

export const tapesRouter = Router()
export const tapeCategoriesRouter = Router()

function toTapeDto(row) {
  return {
    id: row.id,
    name: row.name,
    url: storage.getUrl(row.filename),
    categoryId: row.category_id,
    sortOrder: row.sort_order,
  }
}

tapesRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, filename, category_id, sort_order
       FROM tapes
       WHERE active = true
       ORDER BY sort_order ASC, name ASC`,
    )
    res.json({ items: rows.map(toTapeDto) })
  } catch (err) {
    next(err)
  }
})

tapeCategoriesRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, sort_order
       FROM tape_categories
       ORDER BY sort_order ASC, name ASC`,
    )
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        sortOrder: r.sort_order,
      })),
    })
  } catch (err) {
    next(err)
  }
})
