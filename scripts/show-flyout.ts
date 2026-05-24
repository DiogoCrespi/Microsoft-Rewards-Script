import patchright from 'patchright'
import * as path from 'path'
import { loadAccounts, loadConfig, loadSessionData } from '../src/util/Load'

async function main() {
    const config = loadConfig()
    const accounts = loadAccounts()
    const account = accounts.find(a => a.email === 'eufoda098765@hotmail.com') || accounts[0]
    
    if (!account) {
        console.error("No account found!");
        return;
    }
    
    console.log(`Using account: ${account.email}`)
    
    const unpackedPath = path.join(process.cwd(), 'extensions', 'fbgcedjacmlbgleddnoacbnijgmiolem')
    
    const browser = await patchright.chromium.launch({
        headless: false,
        args: [
            '--no-sandbox',
            `--disable-extensions-except=${unpackedPath}`,
            `--load-extension=${unpackedPath}`
        ]
    })
    
    try {
        const sessionData = await loadSessionData(config.sessionPath, account.email, account.saveFingerprint, true)
        const context = await browser.newContext()
        await context.addCookies(sessionData.cookies)
        
        const page = await context.newPage()
        const targetUrl = 'https://www.bing.com/rewards/panelflyout?partnerId=BrowserExtensions'
        
        console.log(`Navigating to ${targetUrl}...`)
        await page.goto(targetUrl)
        
        console.log("==================================================")
        console.log("Browser window is open. Feel free to inspect the page!")
        console.log("Close the browser window when you are done to finish the script.")
        console.log("==================================================")
        
        // Wait until the page or browser is closed
        await new Promise((resolve) => {
            page.on('close', resolve)
            browser.on('disconnected', resolve)
        })
        
    } catch (err) {
        console.error("Error:", err)
    } finally {
        await browser.close().catch(() => {})
    }
}

main().catch(console.error)
