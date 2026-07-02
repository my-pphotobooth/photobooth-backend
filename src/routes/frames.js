import { Router } from 'express'
import { query } from '../db/pool.js'

export const framesRouter = Router()
export const frameCategoriesRouter = Router()

function toFrameDto(row) {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    backgroundColor: row.background_color,
    textColor: row.text_color,
    slotColor: row.slot_color,
    footerText: row.footer_text,
    layout: row.layout,
    frameImageUrl: row.frame_image_url,
    overlays: row.overlays,
    availableFrom: row.available_from?.toISOString() ?? null,
    availableUntil: row.available_until?.toISOString() ?? null,
    sortOrder: row.sort_order,
  }
}

function toCategoryDto(row) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isBasic: row.is_basic,
  }
}

frameCategoriesRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, sort_order, is_basic
       FROM frame_categories
       ORDER BY sort_order ASC, name ASC`,
    )
    res.json({ items: rows.map(toCategoryDto) })
  } catch (err) {
    next(err)
  }
})

framesRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, category_id, background_color, text_color, slot_color,
              footer_text, layout, frame_image_url, overlays,
              available_from, available_until, sort_order
       FROM frames
       WHERE (available_from IS NULL OR available_from <= now())
         AND (available_until IS NULL OR available_until >= now())
       ORDER BY sort_order ASC, name ASC`,
    )
    res.json({ items: rows.map(toFrameDto) })
  } catch (err) {
    next(err)
  }
})
