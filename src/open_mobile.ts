import rebrowser from 'patchright'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

const email = 'YOUR_EMAIL@example.com'
const mobileUA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36 EdgA/122.0.0.0'
const projectRoot = path.join(__dirname, '../')
const sessionDir = path.join(projectRoot, 'sessions', email)
const sessionFile = path.join(sessionDir, 'session_mobile.json')

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

async function main() {
    console.log('========================================================')
    console.log(`OPENING MOBILE BROWSER FOR: ${email}`)
    console.log('========================================================')

    const browser = await rebrowser.chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check']
    })

    const context = await browser.newContext({
        userAgent: mobileUA,
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true
    })

    if (fs.existsSync(sessionFile)) {
        console.log(`[COOKIES] Loading cookies from ${sessionFile}`)
        const cookies = JSON.parse(fs.readFileSync(sessionFile, 'utf8'))
        await context.addCookies(cookies)
    } else {
        console.log('[WARNING] No mobile session cookies found. Starting fresh.')
    }

    const page = await context.newPage()
    await page.goto('https://rewards.bing.com')

    console.log('\n📱 Navegador móvel aberto no Microsoft Rewards com os cookies carregados!')
    console.log('👉 Deixarei esta janela aberta para você nos mostrar o que deseja.')
    console.log('👉 Pressione [ENTER] no console apenas quando quiser fechar o navegador.')
    
    await askQuestion('\nPressione [ENTER] para fechar o navegador e terminar...');
    
    // Save any updated cookies back just in case
    const updatedCookies = await context.cookies()
    fs.writeFileSync(sessionFile, JSON.stringify(updatedCookies, null, 2))
    console.log(`[COOKIES] Cookies updated and saved to ${sessionFile}`)

    await browser.close()
}

main().catch(console.error)
