import { config } from '../config.js'
import { localStorage } from './local.js'

let storage
if (config.storageDriver === 'local') {
  storage = localStorage
} else {
  throw new Error(`unsupported storage driver: ${config.storageDriver}`)
}

export { storage }
