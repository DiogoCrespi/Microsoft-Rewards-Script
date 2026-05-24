import rebrowser from 'patchright'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

const email = 'YOUR_EMAIL@example.com'
const sessionPath = 'sessions'

const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0'
const mobileUA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36 EdgA/122.0.0.0'

const projectRoot = path.join(__dirname, '../')
const sessionDir = path.join(projectRoot, sessionPath, email)

function askQuestion(query: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })
    return new Promise(resolve => rl.question(query, ans => {
        rl.close()
        resolve(ans)
    }))
}

async function saveCookies(cookies: any[], isMobile: boolean) {
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true })
    }
    const fileName = isMobile ? 'session_mobile.json' : 'session_desktop.json'
    fs.writeFileSync(path.join(sessionDir, fileName), JSON.stringify(cookies, null, 2))
    console.log(`[SAVED] Cookies saved to ${path.join(sessionDir, fileName)}`)
}

async function main() {
    console.log('========================================================')
    console.log(`MANUAL LOGIN FOR: ${email}`)
    console.log('========================================================')

    // ---- DESKTOP STEP ----
    console.log('\n[1/2] Opening DESKTOP Browser...')
    const desktopBrowser = await rebrowser.chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check']
    })
    const desktopContext = await desktopBrowser.newContext({
        userAgent: desktopUA,
        viewport: { width: 1280, height: 800 }
    })
    const desktopPage = await desktopContext.newPage()
    await desktopPage.goto('https://rewards.bing.com')

    console.log('\n👉 ACTION REQUIRED: Log in to your account in the browser window.')
    console.log('👉 Press Enter here in the console ONLY after you have successfully logged in and can see your rewards points.')
    await askQuestion('Press [ENTER] to save Desktop cookies and continue to Mobile login...');

    const desktopCookies = await desktopContext.cookies()
    await saveCookies(desktopCookies, false)
    await desktopBrowser.close()

    // ---- MOBILE STEP ----
    console.log('\n[2/2] Opening MOBILE Browser...')
    const mobileBrowser = await rebrowser.chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check']
    })
    const mobileContext = await mobileBrowser.newContext({
        userAgent: mobileUA,
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true
    })
    
    // Pre-load cookies from desktop login to see if they help sign in
    await mobileContext.addCookies(desktopCookies)
    
    const mobilePage = await mobileContext.newPage()
    await mobilePage.goto('https://rewards.bing.com')

    console.log('\n👉 ACTION REQUIRED: Check if you are signed in on mobile. If not, log in to your account in the browser window.')
    console.log('👉 Press Enter here in the console ONLY after you are logged in on the mobile site.')
    await askQuestion('Press [ENTER] to save Mobile cookies and finish...');

    const mobileCookies = await mobileContext.cookies()
    await saveCookies(mobileCookies, true)
    await mobileBrowser.close()

    console.log('\n🎉 SUCCESS: All cookies captured and saved! You can now run the automated script.')
}

main().catch(console.error)
