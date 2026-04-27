import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export function requireAdmin(req, res, next) {
  if (!config.jwtSecret) {
    return res.status(500).json({ error: 'admin auth not configured' })
  }
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const token = header.slice('Bearer '.length).trim()
  try {
    jwt.verify(token, config.jwtSecret)
    next()
  } catch {
    res.status(401).json({ error: 'unauthorized' })
  }
}
