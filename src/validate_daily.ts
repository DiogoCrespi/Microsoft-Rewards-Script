import rebrowser from 'patchright'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

const email = 'YOUR_EMAIL@example.com'
const sessionPath = 'sessions'
const mobileUA = 'Mozilla/5.0 (Linux; Android 12; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36 EdgA/148.0.3967.70'

const projectRoot = path.join(__dirname, '../')
const sessionDir = path.join(projectRoot, sessionPath, email)
const cookieFile = path.join(sessionDir, 'session_mobile.json')

function askQuestion(query: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans) }))
}

async function main() {
    console.log('========================================================')
    console.log(`VALIDATING DAILY SET FOR: ${email}`)
    console.log('========================================================')

    if (!fs.existsSync(cookieFile)) {
        console.error(`[ERROR] Cookie file not found: ${cookieFile}`)
        process.exit(1)
    }

    const cookies = JSON.parse(fs.readFileSync(cookieFile, 'utf-8'))
    console.log(`[OK] Loaded ${cookies.length} cookies from session_mobile.json`)

    const browser = await rebrowser.chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check']
    })

    const context = await browser.newContext({
        userAgent: mobileUA,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
    })

    await context.addCookies(cookies)

    const page = await context.newPage()

    // Abre o flyout de extension activities (mesmo URL que o script usa)
    const flyoutUrl = 'https://www.bing.com/rewards/panelflyout?partnerId=BrowserExtensions'
    console.log(`\n[INFO] Opening flyout: ${flyoutUrl}`)
    await page.goto(flyoutUrl, { waitUntil: 'networkidle' })

    console.log('\n👁️  OBSERVE the browser:')
    console.log('   ✅ Cards CONCLUÍDOS = badge CINZA ou ícone de check (✓)')
    console.log('   ❌ Cards PENDENTES  = badge AZUL/VERDE com "+10"')
    console.log('\n[INFO] Opening rewards dashboard for comparison...')

    // Abre uma segunda aba com o dashboard completo
    const page2 = await context.newPage()
    await page2.goto('https://rewards.bing.com', { waitUntil: 'networkidle' })

    console.log('\n📋 Two tabs opened:')
    console.log('   Tab 1: Bing Extension Flyout (mostra os cards diários)')
    console.log('   Tab 2: Rewards Dashboard (mostra pontos totais)')

    await askQuestion('\nPress [ENTER] to close the browser when done...')
    await browser.close()
    console.log('\n[DONE] Browser closed.')
}

main().catch(console.error)
