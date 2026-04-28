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
      `SELECT id, name, sort_order, created_at, updated_at
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
    const { name, sortOrder } = req.body ?? {}
    if (!isString(name)) return badRequest(res, 'name is required')
    const id = nanoid()
    const sortOrderNum = Number.isFinite(sortOrder) ? sortOrder : 0

    const { rows } = await query(
      `INSERT INTO frame_categories (id, name, sort_order)
       VALUES ($1, $2, $3)
       RETURNING id, name, sort_order, created_at, updated_at`,
      [id, name.trim(), sortOrderNum],
    )
    res.status(201).json(toCategoryDto(rows[0]))
  } catch (err) {
    next(err)
  }
})

gangminRouter.patch('/frame-categories/:id', async (req, res, next) => {
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
      `UPDATE frame_categories
       SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, name, sort_order, created_at, updated_at`,
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

// ----- Frames -----

gangminRouter.get('/frames', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, category_id, background_color, text_color, slot_color,
              footer_text, overlays, available_from, available_until, sort_order, created_at, updated_at
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
              footer_text, overlays, available_from, available_until, sort_order, created_at, updated_at
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
         overlays, available_from, available_until, sort_order
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, name, category_id, background_color, text_color, slot_color,
                 footer_text, overlays, available_from, available_until, sort_order, created_at, updated_at`,
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
                 footer_text, overlays, available_from, available_until, sort_order, created_at, updated_at`,
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

// ----- Tapes -----

function toTapeDto(row) {
  return {
    id: row.id,
    name: row.name,
    url: storage.getUrl(row.filename),
    filename: row.filename,
    active: row.active,
    sortOrder: row.sort_order,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
  }
}

gangminRouter.get('/tapes', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, filename, active, sort_order, created_at, updated_at
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
    const { name, sortOrder, active } = req.body ?? {}
    if (!isString(name)) return badRequest(res, 'name is required')

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
        `INSERT INTO tapes (id, name, filename, active, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, filename, active, sort_order, created_at, updated_at`,
        [id, name.trim(), filename, activeBool, sortOrderNum],
      )
      res.status(201).json(toTapeDto(rows[0]))
    } catch (err) {
      await storage.delete(filename)
      throw err
    }
  } catch (err) {
    next(err)
  }
})

gangminRouter.patch('/tapes/:id', async (req, res, next) => {
  try {
    const { name, sortOrder, active } = req.body ?? {}
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
    if (active !== undefined) {
      if (typeof active !== 'boolean') return badRequest(res, 'invalid active')
      params.push(active)
      sets.push(`active = $${params.length}`)
    }
    if (sets.length === 0) return badRequest(res, 'no fields to update')
    sets.push('updated_at = now()')
    params.push(req.params.id)

    const { rows } = await query(
      `UPDATE tapes
       SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, name, filename, active, sort_order, created_at, updated_at`,
      params,
    )
    if (rows.length === 0) return notFound(res)
    res.json(toTapeDto(rows[0]))
  } catch (err) {
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

// ----- Uploads -----

gangminRouter.post('/cleanup-uploads', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT overlays FROM frames WHERE overlays IS NOT NULL`,
    )

    const used = new Set()
    for (const row of rows) {
      if (!Array.isArray(row.overlays)) continue
      for (const o of row.overlays) {
        if (typeof o?.src !== 'string') continue
        const m = o.src.match(/\/uploads\/(.+)$/)
        if (m) used.add(m[1])
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
      for (const k of ['right', 'bottom', 'height']) {
        if (typeof o[k] !== 'number' || o[k] < 0 || o[k] > 1) {
          return { error: `overlay[${i}].${k} must be a number 0..1` }
        }
      }
    }
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
  return { availableFrom, availableUntil }
}
