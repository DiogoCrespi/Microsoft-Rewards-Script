import type { Page } from 'patchright'
import type { MicrosoftRewardsBot } from '../index'
import type { Account } from '../interface/Account'

export class CodmGifts {
    private bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    async claimGifts(page: Page, account: Account): Promise<void> {
        if (!account.codmUserId) {
            this.bot.logger.info(this.bot.isMobile, 'CODM-GIFTS', 'No COD Mobile User ID configured for this account. Skipping.')
            return
        }

        const screenshotPath = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\c56d20f0-cda4-4270-bf79-725f56ca6f73\\screenshot.png'

        try {
            this.bot.logger.info(this.bot.isMobile, 'CODM-GIFTS', 'Starting COD Mobile Web Store gifts claimer...')
            
            // 1. Navigate to the store
            await page.goto('https://store.callofdutymobile.com/pt-br/codm', { waitUntil: 'networkidle', timeout: 45000 })
            await this.bot.utils.wait(3000)

            // 2. Click User ID Input and fill it if not already filled
            const userIdInput = '#userId'
            await page.waitForSelector(userIdInput, { timeout: 15000 })
            
            // Use ghost click to click the input field (fake mouse)
            await this.bot.browser.utils.ghostClick(page, userIdInput)
            
            const currentValue = await page.locator(userIdInput).inputValue().catch(() => '')
            const targetUserId = account.codmUserId
            
            if (currentValue !== targetUserId) {
                this.bot.logger.info(this.bot.isMobile, 'CODM-GIFTS', `Filling User ID: ${targetUserId}`)
                await page.locator(userIdInput).focus()
                await page.locator(userIdInput).fill(targetUserId)
                await this.bot.utils.wait(1000)
                // Press enter to trigger validation
                await page.locator(userIdInput).press('Enter')
                await this.bot.utils.wait(1000)
                // Also trigger change/blur events manually via page evaluate
                await page.evaluate((sel) => {
                    const input = document.querySelector(sel) as HTMLInputElement
                    if (input) {
                        input.dispatchEvent(new Event('change', { bubbles: true }))
                        input.dispatchEvent(new Event('input', { bubbles: true }))
                        input.dispatchEvent(new Event('blur', { bubbles: true }))
                    }
                }, userIdInput)
                await this.bot.utils.wait(3000)
            } else {
                this.bot.logger.info(this.bot.isMobile, 'CODM-GIFTS', 'User ID already pre-filled.')
            }

            // Take a screenshot to inspect current state
            await page.screenshot({ path: screenshotPath }).catch(() => {})

            // 3. Verify nickname card
            const nicknameSelector = '.player-info__card-nickname'
            await page.waitForSelector(nicknameSelector, { timeout: 15000 })
            const nicknameText = await page.locator(nicknameSelector).innerText().catch(() => '')
        
        this.bot.logger.info(this.bot.isMobile, 'CODM-GIFTS', `Player nickname detected: ${nicknameText}`)
        if (!nicknameText.toLowerCase().includes('doid17')) {
            throw new Error(`Nickname mismatch! Expected to contain 'doid17' but got: '${nicknameText}'`)
        }

        // 4. Navigate to the "PRESENTES" section/tab
        // Try clicking the tab named "PRESENTES" if it exists, or scroll to the h2 category section
        const tabLocator = page.locator('text="PRESENTES"').first()
        if (await tabLocator.count() > 0 && await tabLocator.isVisible()) {
            await this.bot.browser.utils.ghostClick(page, 'text="PRESENTES"')
            await this.bot.utils.wait(2000)
        } else {
            const sectionHeader = page.locator('h2:has-text("PRESENTES")').first()
            if (await sectionHeader.count() > 0) {
                await sectionHeader.scrollIntoViewIfNeeded().catch(() => {})
                await this.bot.utils.wait(1000)
            }
        }

        // 5. Look for freebie gift cards
        const freebieCardSelector = '.sku-card--freebie'
        await page.waitForSelector(freebieCardSelector, { timeout: 10000 }).catch(() => {})
        
        const cards = page.locator(freebieCardSelector)
        const totalCards = await cards.count()
        this.bot.logger.info(this.bot.isMobile, 'CODM-GIFTS', `Found ${totalCards} freebie cards. Checking availability...`)

        for (let i = 0; i < totalCards; i++) {
            const card = cards.nth(i)
            const textContent = await card.innerText().catch(() => '')
            const sanitizedText = textContent.replace(/\s+/g, ' ').trim()
            this.bot.logger.info(this.bot.isMobile, 'CODM-GIFTS', `Card #${i + 1} text content: "${sanitizedText}"`)

            const textLower = textContent.toLowerCase()
            const hasResgatar = textLower.includes('resgatar') || textLower.includes('claim') || textLower.includes('grátis') || textLower.includes('free')
            const isAlreadyClaimed = textLower.includes('adquirido') || textLower.includes('reivindicado') || textLower.includes('claimed') || textLower.includes('limite atingido')
            
            const isAvailable = hasResgatar && !isAlreadyClaimed

            if (isAvailable) {
                const title = textContent.split('\n')[0] || `Card #${i + 1}`
                this.bot.logger.info(this.bot.isMobile, 'CODM-GIFTS', `Claiming: ${title}`)

                let claimButton = card.locator('.price-section__price__price-container__amount').first()
                if (await claimButton.count() === 0 || !(await claimButton.isVisible())) {
                    claimButton = card.locator('span, div, button').filter({ hasText: /resgatar|claim/i }).first()
                }
                const testId = await card.getAttribute('data-testid').catch(() => '')

                if (await claimButton.count() > 0 && await claimButton.isVisible()) {
                    await claimButton.click().catch(() => card.click())
                } else if (testId) {
                    await this.bot.browser.utils.ghostClick(page, `[data-testid="${testId}"]`)
                } else {
                    await card.click().catch(() => {})
                }
                
                await this.bot.utils.wait(2500) // Wait for modal/drawer to load

                // Detect and click confirmation button
                const buttonLocators = [
                    page.locator('button:has-text("Confirmar")'),
                    page.locator('button:has-text("Resgatar")'),
                    page.locator('button:has-text("Pagar")'),
                    page.locator('button:has-text("Comprar")'),
                    page.locator('button:has-text("Finalizar")'),
                    page.locator('button:has-text("Claim")'),
                    page.locator('button:has-text("Buy")'),
                    page.locator('button:has-text("Pay")'),
                    page.locator('button:has-text("Submit")'),
                    page.locator('button:has-text("Ok")'),
                    page.locator('.drawer button'),
                    page.locator('.modal button'),
                    page.locator('div[role="dialog"] button')
                ]

                let confirmed = false
                for (const loc of buttonLocators) {
                    const count = await loc.count()
                    for (let j = 0; j < count; j++) {
                        const btn = loc.nth(j)
                        if (await btn.isVisible()) {
                            const btnText = await btn.innerText().catch(() => '')
                            this.bot.logger.info(this.bot.isMobile, 'CODM-GIFTS', `Clicking confirmation button: "${btnText}"`)
                            await btn.click()
                            confirmed = true
                            await this.bot.utils.wait(3000)
                            break
                        }
                    }
                    if (confirmed) break
                }

                // Try to close modal/dialog if it remains open
                const closeSelectors = [
                    'button.freebie-redeem-modal__go-back-button',
                    '[data-testid="go-back-button"]',
                    'text="Continue Browsing"',
                    'button[aria-label*="Close" i]',
                    'button[aria-label*="Fechar" i]',
                    '.modal-close',
                    '.drawer-close',
                    'text="Fechar"',
                    'text="Close"',
                    'text="Ok"'
                ]
                for (const closeSel of closeSelectors) {
                    const closeBtn = page.locator(closeSel).first()
                    if (await closeBtn.count() > 0 && await closeBtn.isVisible()) {
                        await closeBtn.click().catch(() => {})
                        await this.bot.utils.wait(1000)
                    }
                }
            } else {
                const title = textContent.split('\n')[0] || `Card #${i + 1}`
                const reason = isAlreadyClaimed ? 'already claimed' : 'no claim button/unavailable'
                this.bot.logger.info(this.bot.isMobile, 'CODM-GIFTS', `Skipping: ${title} (${reason})`)
            }
        }
        
        this.bot.logger.info(this.bot.isMobile, 'CODM-GIFTS', 'Finished COD Mobile gifts claim process successfully.')
        } catch (error) {
            await page.screenshot({ path: screenshotPath }).catch(() => {})
            throw error
        }
    }
}
