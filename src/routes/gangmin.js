import fs from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { nanoid } from 'nanoid'
import { config } from '../config.js'
import { query } from '../db/pool.js'
import { storage } from '../storage/index.js'
import { upload } from '../middleware/upload.js'
import { requireAdmin } from '../middleware/requireAdmin.js'

export const gangminRouter = Router()

// layout을 명시하지 않고 만든 프레임의 기본 규격(600x1900, 4슬롯).
const DEFAULT_LAYOUT = {
  canvas: { width: 600, height: 1900 },
  shotCount: 8,
  slots: [
    { x: 40, y: 60, width: 520, height: 390, shape: 'rect', radius: 0 },
    { x: 40, y: 470, width: 520, height: 390, shape: 'rect', radius: 0 },
    { x: 40, y: 880, width: 520, height: 390, shape: 'rect', radius: 0 },
    { x: 40, y: 1290, width: 520, height: 390, shape: 'rect', radius: 0 },
  ],
}

const SLOT_SHAPES = new Set(['rect', 'ellipse'])

gangminRouter.post('/login', async (req, res) => {
  const { password } = req.body ?? {}
  if (!config.adminPassword || !config.jwtSecret) {
    return res.status(500).json({ error: 'admin auth not configured' })
  }
  if (typeof password !== 'string' || password !== config.adminPassword) {
    return res.status(401).json({ error: 'invalid password' })
  }
  const token = jwt.sign({ role: 'admin' }, config.jwtSecret, {
    expiresIn: '7d',
  })
  res.json({ token })
})

gangminRouter.use(requireAdmin)

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function badRequest(res, message) {
  return res.status(400).json({ error: message })
}

function notFound(res) {
  return res.status(404).json({ error: 'not found' })
}

function isString(v, { maxLength = 200, minLength = 1 } = {}) {
  return typeof v === 'string' && v.length >= minLength && v.length <= maxLength
}

function parseDateOrNull(v) {
  if (v === null || v === undefined || v === '') return null
  const t = Date.parse(v)
  if (Number.isNaN(t)) throw new Error('invalid date')
  return new Date(t).toISOString()
}

function toCategoryDto(row) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isBasic: row.is_basic,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
  }
}

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
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
  }
}

// ----- Categories -----

gangminRouter.get('/frame-categories', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, sort_order, is_basic, created_at, updated_at
       FROM frame_categories
       ORDER BY sort_order ASC, name ASC`,
    )
    res.json({ items: rows.map(toCategoryDto) })
  } catch (err) {
    next(err)
  }
})

gangminRouter.post('/frame-categories', async (req, res, next) => {
  try {
    const { name, sortOrder, isBasic } = req.body ?? {}
    if (!isString(name)) return badRequest(res, 'name is required')
    const id = nanoid()
    const sortOrderNum = Number.isFinite(sortOrder) ? sortOrder : 0

    const { rows } = await query(
      `INSERT INTO frame_categories (id, name, sort_order, is_basic)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, sort_order, is_basic, created_at, updated_at`,
      [id, name.trim(), sortOrderNum, isBasic === true],
    )
    res.status(201).json(toCategoryDto(rows[0]))
  } catch (err) {
    next(err)
  }
})

gangminRouter.patch('/frame-categories/:id', async (req, res, next) => {
  try {
    const { name, sortOrder, isBasic } = req.body ?? {}
    const sets = []
    const params = []
    if (name !== undefined) {
      if (!isString(name)) return badRequest(res, 'invalid name')
      params.push(name.trim())
      sets.push(`name = $${params.length}`)
    }
    if (sortOrder !== undefined) {
      if (!Number.isFinite(sortOrder)) return badRequest(res, 'invalid sortOrder')
      params.push(sortOrder)
      sets.push(`sort_order = $${params.length}`)
    }
    if (isBasic !== undefined) {
      if (typeof isBasic !== 'boolean') return badRequest(res, 'invalid isBasic')
      params.push(isBasic)
      sets.push(`is_basic = $${params.length}`)
    }
    if (sets.length === 0) return badRequest(res, 'no fields to update')
    sets.push('updated_at = now()')
    params.push(req.params.id)

    const { rows } = await query(
      `UPDATE frame_categories
       SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, name, sort_order, is_basic, created_at, updated_at`,
      params,
    )
    if (rows.length === 0) return notFound(res)
    res.json(toCategoryDto(rows[0]))
  } catch (err) {
    next(err)
  }
})

gangminRouter.delete('/frame-categories/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM frame_categories WHERE id = $1`,
      [req.params.id],
    )
    if (rowCount === 0) return notFound(res)
    res.status(204).end()
  } catch (err) {
    if (err.code === '23503') {
      return res
        .status(409)
        .json({ error: 'category has frames; remove or move them first' })
    }
    next(err)
  }
})

// ----- Basic layouts (색 없는 기본 규격) -----

function toBasicLayoutDto(row) {
  return {
    id: row.id,
    name: row.name,
    layout: row.layout,
    footerText: row.footer_text,
    sortOrder: row.sort_order,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
  }
}

const BASIC_LAYOUT_COLS = `id, name, layout, footer_text, sort_order, created_at, updated_at`

gangminRouter.get('/basic-layouts', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ${BASIC_LAYOUT_COLS} FROM basic_layouts
       ORDER BY sort_order ASC, name ASC`,
    )
    res.json({ items: rows.map(toBasicLayoutDto) })
  } catch (err) {
    next(err)
  }
})

gangminRouter.get('/basic-layouts/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ${BASIC_LAYOUT_COLS} FROM basic_layouts WHERE id = $1`,
      [req.params.id],
    )
    if (rows.length === 0) return notFound(res)
    res.json(toBasicLayoutDto(rows[0]))
  } catch (err) {
    next(err)
  }
})

gangminRouter.post('/basic-layouts', async (req, res, next) => {
  try {
    const data = req.body ?? {}
    if (!isString(data.name)) return badRequest(res, 'name is required')
    const layoutError = validateLayout(data.layout)
    if (layoutError) return badRequest(res, layoutError)
    if (
      data.footerText !== undefined &&
      (typeof data.footerText !== 'string' || data.footerText.length > 200)
    ) {
      return badRequest(res, 'invalid footerText')
    }
    const id = nanoid()
    const { rows } = await query(
      `INSERT INTO basic_layouts (id, name, layout, footer_text, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${BASIC_LAYOUT_COLS}`,
      [
        id,
        data.name.trim(),
        JSON.stringify(data.layout),
        data.footerText ?? 'my-photobooth',
        Number.isFinite(data.sortOrder) ? data.sortOrder : 0,
      ],
    )
    res.status(201).json(toBasicLayoutDto(rows[0]))
  } catch (err) {
    next(err)
  }
})

gangminRouter.patch('/basic-layouts/:id', async (req, res, next) => {
  try {
    const data = req.body ?? {}
    const sets = []
    const params = []
    const add = (col, val) => {
      params.push(val)
      sets.push(`${col} = $${params.length}`)
    }
    if (data.name !== undefined) {
      if (!isString(data.name)) return badRequest(res, 'invalid name')
      add('name', data.name.trim())
    }
    if (data.layout !== undefined) {
      const layoutError = validateLayout(data.layout)
      if (layoutError) return badRequest(res, layoutError)
      add('layout', JSON.stringify(data.layout))
    }
    if (data.footerText !== undefined) {
      if (typeof data.footerText !== 'string' || data.footerText.length > 200) {
        return badRequest(res, 'invalid footerText')
      }
      add('footer_text', data.footerText)
    }
    if (data.sortOrder !== undefined) {
      if (!Number.isFinite(data.sortOrder)) {
        return badRequest(res, 'invalid sortOrder')
      }
      add('sort_order', data.sortOrder)
    }
    if (sets.length === 0) return badRequest(res, 'no fields to update')
    sets.push('updated_at = now()')
    params.push(req.params.id)

    const { rows } = await query(
      `UPDATE basic_layouts SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING ${BASIC_LAYOUT_COLS}`,
      params,
    )
    if (rows.length === 0) return notFound(res)
    res.json(toBasicLayoutDto(rows[0]))
  } catch (err) {
    next(err)
  }
})

gangminRouter.delete('/basic-layouts/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM basic_layouts WHERE id = $1`,
      [req.params.id],
    )
    if (rowCount === 0) return notFound(res)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// ----- Color chips (편집 단계 색 세트) -----

function toColorChipDto(row) {
  return {
    id: row.id,
    name: row.name,
    backgroundColor: row.background_color,
    slotColor: row.slot_color,
    textColor: row.text_color,
    sortOrder: row.sort_order,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
  }
}

const CHIP_COLS = `id, name, background_color, slot_color, text_color, sort_order, created_at, updated_at`

function validateChip(data, { partial }) {
  if (!partial || data.name !== undefined) {
    if (!isString(data.name)) return 'invalid name'
  }
  for (const k of ['backgroundColor', 'slotColor', 'textColor']) {
    if (!partial && data[k] === undefined) return `${k} is required`
    if (data[k] !== undefined && !HEX_RE.test(data[k])) {
      return `${k} must be #RRGGBB`
    }
  }
  if (data.sortOrder !== undefined && !Number.isFinite(data.sortOrder)) {
    return 'invalid sortOrder'
  }
  return null
}

gangminRouter.get('/color-chips', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ${CHIP_COLS} FROM color_chips ORDER BY sort_order ASC, name ASC`,
    )
    res.json({ items: rows.map(toColorChipDto) })
  } catch (err) {
    next(err)
  }
})

gangminRouter.post('/color-chips', async (req, res, next) => {
  try {
    const data = req.body ?? {}
    const err = validateChip(data, { partial: false })
    if (err) return badRequest(res, err)
    const id = nanoid()
    const { rows } = await query(
      `INSERT INTO color_chips
         (id, name, background_color, slot_color, text_color, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${CHIP_COLS}`,
      [
        id,
        data.name.trim(),
        data.backgroundColor,
        data.slotColor,
        data.textColor,
        Number.isFinite(data.sortOrder) ? data.sortOrder : 0,
      ],
    )
    res.status(201).json(toColorChipDto(rows[0]))
  } catch (err) {
    next(err)
  }
})

gangminRouter.patch('/color-chips/:id', async (req, res, next) => {
  try {
    const data = req.body ?? {}
    const verr = validateChip(data, { partial: true })
    if (verr) return badRequest(res, verr)
    const map = {
      name: 'name',
      backgroundColor: 'background_color',
      slotColor: 'slot_color',
      textColor: 'text_color',
      sortOrder: 'sort_order',
    }
    const sets = []
    const params = []
    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) {
        params.push(key === 'name' ? data[key].trim() : data[key])
        sets.push(`${col} = $${params.length}`)
      }
    }
    if (sets.length === 0) return badRequest(res, 'no fields to update')
    sets.push('updated_at = now()')
    params.push(req.params.id)
    const { rows } = await query(
      `UPDATE color_chips SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING ${CHIP_COLS}`,
      params,
    )
    if (rows.length === 0) return notFound(res)
    res.json(toColorChipDto(rows[0]))
  } catch (err) {
    next(err)
  }
})

gangminRouter.delete('/color-chips/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM color_chips WHERE id = $1`,
      [req.params.id],
    )
    if (rowCount === 0) return notFound(res)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// ----- Frames -----

gangminRouter.get('/frames', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, category_id, background_color, text_color, slot_color,
              footer_text, layout, frame_image_url, overlays, available_from, available_until, sort_order, created_at, updated_at
       FROM frames
       ORDER BY sort_order ASC, name ASC`,
    )
    res.json({ items: rows.map(toFrameDto) })
  } catch (err) {
    next(err)
  }
})

gangminRouter.get('/frames/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, category_id, background_color, text_color, slot_color,
              footer_text, layout, frame_image_url, overlays, available_from, available_until, sort_order, created_at, updated_at
       FROM frames
       WHERE id = $1`,
      [req.params.id],
    )
    if (rows.length === 0) return notFound(res)
    res.json(toFrameDto(rows[0]))
  } catch (err) {
    next(err)
  }
})

gangminRouter.post('/frames', async (req, res, next) => {
  try {
    const data = req.body ?? {}
    const v = validateFrame(data, { partial: false })
    if (v.error) return badRequest(res, v.error)
    const id = nanoid()

    const { rows } = await query(
      `INSERT INTO frames (
         id, name, category_id, background_color, text_color, slot_color, footer_text,
         overlays, available_from, available_until, sort_order, layout, frame_image_url
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, name, category_id, background_color, text_color, slot_color,
                 footer_text, layout, frame_image_url, overlays, available_from, available_until, sort_order, created_at, updated_at`,
      [
        id,
        data.name.trim(),
        data.categoryId,
        data.backgroundColor,
        data.textColor,
        data.slotColor,
        data.footerText,
        data.overlays ? JSON.stringify(data.overlays) : null,
        v.availableFrom,
        v.availableUntil,
        Number.isFinite(data.sortOrder) ? data.sortOrder : 0,
        JSON.stringify(v.layout ?? DEFAULT_LAYOUT),
        data.frameImageUrl ?? null,
      ],
    )
    res.status(201).json(toFrameDto(rows[0]))
  } catch (err) {
    if (err.code === '23503') {
      return badRequest(res, 'invalid categoryId')
    }
    next(err)
  }
})

gangminRouter.patch('/frames/:id', async (req, res, next) => {
  try {
    const data = req.body ?? {}
    const v = validateFrame(data, { partial: true })
    if (v.error) return badRequest(res, v.error)

    const sets = []
    const params = []
    function add(col, val) {
      params.push(val)
      sets.push(`${col} = $${params.length}`)
    }
    if (data.name !== undefined) add('name', data.name.trim())
    if (data.categoryId !== undefined) add('category_id', data.categoryId)
    if (data.backgroundColor !== undefined) add('background_color', data.backgroundColor)
    if (data.textColor !== undefined) add('text_color', data.textColor)
    if (data.slotColor !== undefined) add('slot_color', data.slotColor)
    if (data.footerText !== undefined) add('footer_text', data.footerText)
    if (data.layout !== undefined) add('layout', JSON.stringify(v.layout))
    if (data.frameImageUrl !== undefined) {
      add('frame_image_url', data.frameImageUrl)
    }
    if (data.overlays !== undefined) {
      add('overlays', data.overlays === null ? null : JSON.stringify(data.overlays))
    }
    if (data.availableFrom !== undefined) add('available_from', v.availableFrom)
    if (data.availableUntil !== undefined) add('available_until', v.availableUntil)
    if (data.sortOrder !== undefined) add('sort_order', data.sortOrder)
    if (sets.length === 0) return badRequest(res, 'no fields to update')
    sets.push('updated_at = now()')
    params.push(req.params.id)

    const { rows } = await query(
      `UPDATE frames
       SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, name, category_id, background_color, text_color, slot_color,
                 footer_text, layout, frame_image_url, overlays, available_from, available_until, sort_order, created_at, updated_at`,
      params,
    )
    if (rows.length === 0) return notFound(res)
    res.json(toFrameDto(rows[0]))
  } catch (err) {
    if (err.code === '23503') {
      return badRequest(res, 'invalid categoryId')
    }
    next(err)
  }
})

gangminRouter.delete('/frames/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM frames WHERE id = $1`,
      [req.params.id],
    )
    if (rowCount === 0) return notFound(res)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// ----- Photos (어드민 조회·삭제) -----

function toPhotoDto(row) {
  return {
    id: row.id,
    url: storage.getUrl(row.filename),
    createdAt: row.created_at?.toISOString() ?? null,
    frameId: row.frame_id,
    frameName: row.frame_name,
    tape:
      row.tape_id && row.tape_filename
        ? {
            id: row.tape_id,
            name: row.tape_name,
            url: storage.getUrl(row.tape_filename),
          }
        : null,
  }
}

gangminRouter.get('/photos', async (req, res, next) => {
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
              p.frame_id, f.name AS frame_name,
              p.tape_id, t.name AS tape_name, t.filename AS tape_filename
       FROM photos p
       LEFT JOIN frames f ON f.id = p.frame_id
       LEFT JOIN tapes t ON t.id = p.tape_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length}`,
      params,
    )

    const hasMore = rows.length > limit
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toPhotoDto)
    const nextCursor = hasMore ? rows[limit - 1].created_at.toISOString() : null

    res.json({ items, nextCursor })
  } catch (err) {
    next(err)
  }
})

gangminRouter.patch('/photos/:id', async (req, res, next) => {
  try {
    const data = req.body ?? {}
    if (!('tapeId' in data)) return badRequest(res, 'no fields to update')
    const tapeId = data.tapeId
    if (tapeId !== null && !isString(tapeId)) {
      return badRequest(res, 'invalid tapeId')
    }

    const updated = await query(
      `UPDATE photos SET tape_id = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [tapeId, req.params.id],
    )
    if (updated.rows.length === 0) return notFound(res)

    const { rows } = await query(
      `SELECT p.id, p.filename, p.created_at,
              p.frame_id, f.name AS frame_name,
              p.tape_id, t.name AS tape_name, t.filename AS tape_filename
       FROM photos p
       LEFT JOIN frames f ON f.id = p.frame_id
       LEFT JOIN tapes t ON t.id = p.tape_id
       WHERE p.id = $1`,
      [req.params.id],
    )
    res.json(toPhotoDto(rows[0]))
  } catch (err) {
    if (err.code === '23503') return badRequest(res, 'invalid tapeId')
    next(err)
  }
})

gangminRouter.delete('/photos/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `UPDATE photos
       SET deleted_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id],
    )
    if (rowCount === 0) return notFound(res)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// ----- Tapes -----

function toTapeDto(row) {
  return {
    id: row.id,
    name: row.name,
    url: storage.getUrl(row.filename),
    filename: row.filename,
    categoryId: row.category_id,
    active: row.active,
    sortOrder: row.sort_order,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
  }
}

gangminRouter.get('/tapes', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, filename, category_id, active, sort_order, created_at, updated_at
       FROM tapes
       ORDER BY sort_order ASC, name ASC`,
    )
    res.json({ items: rows.map(toTapeDto) })
  } catch (err) {
    next(err)
  }
})

gangminRouter.post('/tapes', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return badRequest(res, 'file is required')
    const { name, sortOrder, active, categoryId } = req.body ?? {}
    if (!isString(name)) return badRequest(res, 'name is required')
    if (!isString(categoryId)) return badRequest(res, 'categoryId is required')

    const sortOrderNum = sortOrder !== undefined ? Number(sortOrder) : 0
    if (!Number.isFinite(sortOrderNum)) return badRequest(res, 'invalid sortOrder')
    const activeBool = active === undefined ? true : active === 'true' || active === true

    const { filename } = await storage.put(req.file.buffer, {
      mimeType: req.file.mimetype,
      prefix: 'tapes',
    })
    const id = nanoid()

    try {
      const { rows } = await query(
        `INSERT INTO tapes (id, name, filename, active, sort_order, category_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, filename, category_id, active, sort_order, created_at, updated_at`,
        [id, name.trim(), filename, activeBool, sortOrderNum, categoryId],
      )
      res.status(201).json(toTapeDto(rows[0]))
    } catch (err) {
      await storage.delete(filename)
      throw err
    }
  } catch (err) {
    if (err.code === '23503') return badRequest(res, 'invalid categoryId')
    next(err)
  }
})

gangminRouter.patch('/tapes/:id', upload.single('file'), async (req, res, next) => {
  let newFilename = null
  try {
    const { name, sortOrder, active, categoryId } = req.body ?? {}
    const sets = []
    const params = []

    if (name !== undefined) {
      if (!isString(name)) return badRequest(res, 'invalid name')
      params.push(name.trim())
      sets.push(`name = $${params.length}`)
    }
    if (categoryId !== undefined) {
      if (!isString(categoryId)) return badRequest(res, 'invalid categoryId')
      params.push(categoryId)
      sets.push(`category_id = $${params.length}`)
    }
    if (sortOrder !== undefined) {
      const n = Number(sortOrder)
      if (!Number.isFinite(n)) return badRequest(res, 'invalid sortOrder')
      params.push(n)
      sets.push(`sort_order = $${params.length}`)
    }
    if (active !== undefined) {
      const b = typeof active === 'boolean' ? active : active === 'true'
      params.push(b)
      sets.push(`active = $${params.length}`)
    }

    if (req.file) {
      const result = await storage.put(req.file.buffer, {
        mimeType: req.file.mimetype,
        prefix: 'tapes',
      })
      newFilename = result.filename
      params.push(newFilename)
      sets.push(`filename = $${params.length}`)
    }

    if (sets.length === 0) return badRequest(res, 'no fields to update')

    // 기존 파일명 미리 조회 (이미지 교체 시 삭제용)
    let oldFilename = null
    if (newFilename) {
      const old = await query('SELECT filename FROM tapes WHERE id = $1', [req.params.id])
      oldFilename = old.rows[0]?.filename ?? null
    }

    sets.push('updated_at = now()')
    params.push(req.params.id)

    const { rows } = await query(
      `UPDATE tapes
       SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, name, filename, category_id, active, sort_order, created_at, updated_at`,
      params,
    )
    if (rows.length === 0) {
      if (newFilename) await storage.delete(newFilename)
      return notFound(res)
    }

    if (oldFilename && oldFilename !== rows[0].filename) {
      try {
        await storage.delete(oldFilename)
      } catch (err) {
        console.warn('failed to delete old tape file:', err.message)
      }
    }

    res.json(toTapeDto(rows[0]))
  } catch (err) {
    if (newFilename) {
      try { await storage.delete(newFilename) } catch { /* ignore */ }
    }
    if (err.code === '23503') return badRequest(res, 'invalid categoryId')
    next(err)
  }
})

gangminRouter.delete('/tapes/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `DELETE FROM tapes WHERE id = $1 RETURNING filename`,
      [req.params.id],
    )
    if (rows.length === 0) return notFound(res)
    try {
      await storage.delete(rows[0].filename)
    } catch (err) {
      // S3 객체가 이미 없어도 DB row는 지워져야 하므로 에러 무시
      console.warn('failed to delete tape file:', err.message)
    }
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// ----- Tape categories -----

function toTapeCategoryDto(row) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
  }
}

const TAPE_CAT_COLS = `id, name, sort_order, created_at, updated_at`

gangminRouter.get('/tape-categories', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ${TAPE_CAT_COLS} FROM tape_categories
       ORDER BY sort_order ASC, name ASC`,
    )
    res.json({ items: rows.map(toTapeCategoryDto) })
  } catch (err) {
    next(err)
  }
})

gangminRouter.post('/tape-categories', async (req, res, next) => {
  try {
    const { name, sortOrder } = req.body ?? {}
    if (!isString(name)) return badRequest(res, 'name is required')
    const id = nanoid()
    const { rows } = await query(
      `INSERT INTO tape_categories (id, name, sort_order)
       VALUES ($1, $2, $3)
       RETURNING ${TAPE_CAT_COLS}`,
      [id, name.trim(), Number.isFinite(sortOrder) ? sortOrder : 0],
    )
    res.status(201).json(toTapeCategoryDto(rows[0]))
  } catch (err) {
    next(err)
  }
})

gangminRouter.patch('/tape-categories/:id', async (req, res, next) => {
  try {
    const { name, sortOrder } = req.body ?? {}
    const sets = []
    const params = []
    if (name !== undefined) {
      if (!isString(name)) return badRequest(res, 'invalid name')
      params.push(name.trim())
      sets.push(`name = $${params.length}`)
    }
    if (sortOrder !== undefined) {
      if (!Number.isFinite(sortOrder)) return badRequest(res, 'invalid sortOrder')
      params.push(sortOrder)
      sets.push(`sort_order = $${params.length}`)
    }
    if (sets.length === 0) return badRequest(res, 'no fields to update')
    sets.push('updated_at = now()')
    params.push(req.params.id)
    const { rows } = await query(
      `UPDATE tape_categories SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING ${TAPE_CAT_COLS}`,
      params,
    )
    if (rows.length === 0) return notFound(res)
    res.json(toTapeCategoryDto(rows[0]))
  } catch (err) {
    next(err)
  }
})

gangminRouter.delete('/tape-categories/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM tape_categories WHERE id = $1`,
      [req.params.id],
    )
    if (rowCount === 0) return notFound(res)
    res.status(204).end()
  } catch (err) {
    if (err.code === '23503') {
      return res
        .status(409)
        .json({ error: 'category has tapes; remove or move them first' })
    }
    next(err)
  }
})

// ----- Uploads -----

gangminRouter.post('/cleanup-uploads', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT overlays, frame_image_url FROM frames`,
    )

    const used = new Set()
    const markUsed = (src) => {
      if (typeof src !== 'string') return
      const m = src.match(/\/uploads\/(.+)$/)
      if (m) used.add(m[1])
    }
    for (const row of rows) {
      markUsed(row.frame_image_url)
      if (!Array.isArray(row.overlays)) continue
      for (const o of row.overlays) {
        markUsed(o?.src)
      }
    }

    const overlaysDir = path.join(config.uploadDir, 'overlays')
    let allFiles = []
    try {
      const entries = await fs.readdir(overlaysDir)
      allFiles = entries.map((f) => `overlays/${f}`)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }

    const orphans = allFiles.filter((f) => !used.has(f))
    for (const f of orphans) {
      await storage.delete(f)
    }

    res.json({ deleted: orphans.length, kept: used.size })
  } catch (err) {
    next(err)
  }
})

gangminRouter.post('/uploads', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return badRequest(res, 'file is required')
    const { filename } = await storage.put(req.file.buffer, {
      mimeType: req.file.mimetype,
      prefix: 'overlays',
    })
    res.status(201).json({ url: storage.getUrl(filename) })
  } catch (err) {
    next(err)
  }
})

function validateFrame(data, { partial }) {
  const required = [
    'name',
    'categoryId',
    'backgroundColor',
    'textColor',
    'slotColor',
    'footerText',
  ]
  if (!partial) {
    for (const k of required) {
      if (data[k] === undefined) return { error: `${k} is required` }
    }
  }
  if (data.name !== undefined && !isString(data.name)) {
    return { error: 'invalid name' }
  }
  if (data.categoryId !== undefined && !isString(data.categoryId)) {
    return { error: 'invalid categoryId' }
  }
  if (data.backgroundColor !== undefined && !HEX_RE.test(data.backgroundColor)) {
    return { error: 'backgroundColor must be #RRGGBB' }
  }
  if (data.textColor !== undefined && !HEX_RE.test(data.textColor)) {
    return { error: 'textColor must be #RRGGBB' }
  }
  if (data.slotColor !== undefined && !HEX_RE.test(data.slotColor)) {
    return { error: 'slotColor must be #RRGGBB' }
  }
  if (
    data.footerText !== undefined &&
    (typeof data.footerText !== 'string' || data.footerText.length > 200)
  ) {
    return { error: 'invalid footerText' }
  }
  if (data.sortOrder !== undefined && !Number.isFinite(data.sortOrder)) {
    return { error: 'invalid sortOrder' }
  }
  if (data.overlays !== undefined && data.overlays !== null) {
    if (!Array.isArray(data.overlays)) {
      return { error: 'overlays must be an array or null' }
    }
    for (let i = 0; i < data.overlays.length; i++) {
      const o = data.overlays[i]
      if (!o || typeof o !== 'object') {
        return { error: `overlay[${i}] must be an object` }
      }
      if (typeof o.src !== 'string' || o.src.length === 0) {
        return { error: `overlay[${i}].src must be a non-empty string` }
      }
      if (o.anchor !== undefined && o.anchor !== 'slot' && o.anchor !== 'canvas') {
        return { error: `overlay[${i}].anchor must be "slot" or "canvas"` }
      }
      if (o.clip !== undefined && typeof o.clip !== 'boolean') {
        return { error: `overlay[${i}].clip must be a boolean` }
      }
      // 구버전 오버레이는 shotIndex가 없고 배열 인덱스가 곧 샷 번호다.
      if (
        o.shotIndex !== undefined &&
        o.shotIndex !== null &&
        (!Number.isInteger(o.shotIndex) || o.shotIndex < 0)
      ) {
        return { error: `overlay[${i}].shotIndex must be a non-negative integer or null` }
      }
      for (const k of ['right', 'bottom', 'height']) {
        if (typeof o[k] !== 'number' || !Number.isFinite(o[k])) {
          return { error: `overlay[${i}].${k} must be a finite number` }
        }
      }
    }
  }

  if (
    data.frameImageUrl !== undefined &&
    data.frameImageUrl !== null &&
    !isString(data.frameImageUrl)
  ) {
    return { error: 'invalid frameImageUrl' }
  }

  let layout
  if (data.layout !== undefined) {
    const layoutError = validateLayout(data.layout)
    if (layoutError) return { error: layoutError }
    layout = data.layout
  }

  let availableFrom = null
  let availableUntil = null
  try {
    if (data.availableFrom !== undefined) {
      availableFrom = parseDateOrNull(data.availableFrom)
    }
    if (data.availableUntil !== undefined) {
      availableUntil = parseDateOrNull(data.availableUntil)
    }
  } catch {
    return { error: 'invalid date' }
  }
  return { availableFrom, availableUntil, layout }
}

function validateLayout(layout) {
  if (!layout || typeof layout !== 'object') {
    return 'layout must be an object'
  }
  const c = layout.canvas
  if (
    !c ||
    !Number.isFinite(c.width) ||
    !Number.isFinite(c.height) ||
    c.width <= 0 ||
    c.height <= 0
  ) {
    return 'layout.canvas must have positive width/height'
  }
  if (!Array.isArray(layout.slots) || layout.slots.length < 1) {
    return 'layout.slots must be a non-empty array'
  }
  for (let i = 0; i < layout.slots.length; i++) {
    const s = layout.slots[i]
    if (!s || typeof s !== 'object') return `slot[${i}] must be an object`
    for (const k of ['x', 'y', 'width', 'height']) {
      if (!Number.isFinite(s[k])) {
        return `slot[${i}].${k} must be a finite number`
      }
    }
    if (s.width <= 0 || s.height <= 0) {
      return `slot[${i}] width/height must be > 0`
    }
    if (
      s.x < 0 ||
      s.y < 0 ||
      s.x + s.width > c.width ||
      s.y + s.height > c.height
    ) {
      return `slot[${i}] must be within the canvas`
    }
    if (s.shape !== undefined && !SLOT_SHAPES.has(s.shape)) {
      return `slot[${i}].shape must be one of ${[...SLOT_SHAPES].join(', ')}`
    }
    if (s.radius !== undefined && (!Number.isFinite(s.radius) || s.radius < 0)) {
      return `slot[${i}].radius must be a non-negative number`
    }
  }
  if (layout.shotCount !== undefined) {
    if (
      !Number.isInteger(layout.shotCount) ||
      layout.shotCount < layout.slots.length ||
      layout.shotCount > 30
    ) {
      return `layout.shotCount must be an integer between slots length (${layout.slots.length}) and 30`
    }
  }
  return null
}
