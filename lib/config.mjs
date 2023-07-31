import rc from 'rc'
import { homedir } from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'

const fullConfigPath = path.join(homedir(), '.config', 'kessler_assist')
const config = rc('kessler_assist', {
  openai: { key: undefined },
  actors: {}
})

export default config

export async function configFileExists() {
  try {
    await fs.access(fullConfigPath)
    return false
  } catch (e) {
    if (e.code === 'ENOENT') {
      return true
    } else {
      throw e
    }
  }
}

export async function saveConfig() {
  delete config._
  await fs.writeFile(fullConfigPath, JSON.stringify(config))
}