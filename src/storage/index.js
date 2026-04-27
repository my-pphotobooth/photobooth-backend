import { config } from '../config.js'
import { localStorage } from './local.js'
import { s3Storage } from './s3.js'

let storage
if (config.storageDriver === 'local') {
  storage = localStorage
} else if (config.storageDriver === 's3') {
  storage = s3Storage
} else {
  throw new Error(`unsupported storage driver: ${config.storageDriver}`)
}

export { storage }
