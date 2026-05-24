import * as fs from 'fs'
import * as path from 'path'
import axios from 'axios'
import { execSync } from 'child_process'

export async function downloadAndUnpackExtension(logger: any): Promise<string> {
    const extId = 'fbgcedjacmlbgleddnoacbnijgmiolem'
    const extensionDir = path.join(process.cwd(), 'extensions')
    const unpackedDir = path.join(extensionDir, extId)
    const zipPath = path.join(extensionDir, `${extId}.zip`)

    if (fs.existsSync(unpackedDir) && fs.existsSync(path.join(unpackedDir, 'manifest.json'))) {
        return unpackedDir
    }

    if (!fs.existsSync(extensionDir)) {
        fs.mkdirSync(extensionDir, { recursive: true })
    }

    logger.info('main', 'EXTENSION-MANAGER', `Downloading Microsoft Bing Search extension (${extId})...`)
    const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=114.0&acceptformat=crx2,crx3&x=id%3D${extId}%26uc`
    
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })

        const buffer = Buffer.from(response.data)
        
        // Validate CRX3 header
        const magic = buffer.toString('utf8', 0, 4)
        if (magic !== 'Cr24') {
            throw new Error(`Invalid CRX file magic header: ${magic}`)
        }

        const version = buffer.readUInt32LE(4)
        if (version !== 3) {
            throw new Error(`Unsupported CRX version: ${version}. Only CRX3 is supported.`)
        }

        const headerLength = buffer.readUInt32LE(8)
        const zipOffset = 12 + headerLength
        const zipBuffer = buffer.subarray(zipOffset)

        fs.writeFileSync(zipPath, zipBuffer)
        logger.info('main', 'EXTENSION-MANAGER', `Extension downloaded and saved to ${zipPath}`)

        logger.info('main', 'EXTENSION-MANAGER', `Extracting extension to ${unpackedDir}...`)
        if (fs.existsSync(unpackedDir)) {
            fs.rmSync(unpackedDir, { recursive: true, force: true })
        }
        fs.mkdirSync(unpackedDir, { recursive: true })

        const cmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${unpackedDir}' -Force"`
        execSync(cmd, { stdio: 'ignore' })
        logger.info('main', 'EXTENSION-MANAGER', `Extension extracted successfully to ${unpackedDir}`)
    } catch (err) {
        logger.error('main', 'EXTENSION-MANAGER', `Failed to download or unpack extension: ${err instanceof Error ? err.message : String(err)}`)
        throw err
    } finally {
        if (fs.existsSync(zipPath)) {
            try {
                fs.unlinkSync(zipPath)
            } catch {}
        }
    }

    return unpackedDir
}
