import { Router } from 'express'
import { query } from '../db/pool.js'

export const basicLayoutsRouter = Router()
export const colorChipsRouter = Router()

function toLayoutDto(row) {
  return {
    id: row.id,
    name: row.name,
    layout: row.layout,
    footerText: row.footer_text,
    sortOrder: row.sort_order,
  }
}

function toChipDto(row) {
  return {
    id: row.id,
    name: row.name,
    backgroundColor: row.background_color,
    slotColor: row.slot_color,
    textColor: row.text_color,
    sortOrder: row.sort_order,
  }
}

basicLayoutsRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, layout, footer_text, sort_order
       FROM basic_layouts
       ORDER BY sort_order ASC, name ASC`,
    )
    res.json({ items: rows.map(toLayoutDto) })
  } catch (err) {
    next(err)
  }
})

colorChipsRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, background_color, slot_color, text_color, sort_order
       FROM color_chips
       ORDER BY sort_order ASC, name ASC`,
    )
    res.json({ items: rows.map(toChipDto) })
  } catch (err) {
    next(err)
  }
})
