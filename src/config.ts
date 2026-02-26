import fs from 'fs'
import path from 'path'
import os from 'os'

type Config = {
  dbFile: string
  barTopMargin: number
  barRightMargin: number
  barPollInterval: number
}

let configSingleton: Config | null = null
export const getConfig = () => {
  if (!configSingleton) {
    const homeDir = os.homedir()
    const configFile = path.normalize(`${homeDir}/.config/movies-cwb-ags-bar/config.json`)
    if (!fs.existsSync(configFile)) {
      throw new Error(`Config file not found: ${configFile}`)
    }
    const raw = fs.readFileSync(configFile, 'utf8')
    configSingleton = JSON.parse(raw) as Config
  }
  return configSingleton
}