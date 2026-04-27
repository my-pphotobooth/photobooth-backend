import pg from 'pg'
import { config } from '../config.js'

const usesRds = /\.rds\.amazonaws\.com/.test(config.databaseUrl)

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: usesRds ? { rejectUnauthorized: false } : false,
})

export function query(text, params) {
  return pool.query(text, params)
}
