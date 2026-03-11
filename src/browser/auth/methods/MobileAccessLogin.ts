import type { Page } from 'patchright'
import { randomBytes } from 'crypto'
import { URLSearchParams } from 'url'

import type { MicrosoftRewardsBot } from '../../../index'
import { getCurrentContext } from '../../../index'
import { EmailLogin } from './EmailLogin'

export class MobileAccessLogin {
    private clientId = '0000000040170455'
    private authUrl = 'https://login.live.com/oauth20_authorize.srf'
    private redirectUrl = 'https://login.live.com/oauth20_desktop.srf'
    private tokenUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
    private scope = 'service::prod.rewardsplatform.microsoft.com::MBI_SSL'
    private maxTimeout = 180_000 // 3min

    // Selectors for handling Passkey prompt during OAuth
    private readonly selectors = {
        secondaryButton: 'button[data-testid="secondaryButton"]',
        passKeyError: '[data-testid="registrationImg"]',
        passKeyVideo: '[data-testid="biometricVideo"]',
        numberDisplay: 'div[data-testid="displaySign"]'
    } as const

    private numberDisplayed = false
    private clickedPasswordFallback = false
    private emailLogin: EmailLogin

    constructor(
        private bot: MicrosoftRewardsBot,
        private page: Page
    ) {
        this.emailLogin = new EmailLogin(this.bot)
    }

    private async checkSelector(selector: string): Promise<boolean> {
        return this.page
            .waitForSelector(selector, { state: 'visible', timeout: 200 })
            .then(() => true)
            .catch(() => false)
    }

    private async handlePasskeyPrompt(): Promise<void> {
        try {
            // Handle Passkey prompt - click secondary button to skip
            const hasPasskeyError = await this.checkSelector(this.selectors.passKeyError)
            const hasPasskeyVideo = await this.checkSelector(this.selectors.passKeyVideo)
            if (hasPasskeyError || hasPasskeyVideo) {
                this.bot.logger.info(this.bot.isMobile, 'LOGIN-APP', 'Found Passkey prompt on OAuth page, skipping')
                await this.bot.browser.utils.ghostClick(this.page, this.selectors.secondaryButton)
                await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { })
            }
        } catch {
            // Ignore errors in prompt handling
        }
    }

    async get(email: string): Promise<string> {
        try {
            const authorizeUrl = new URL(this.authUrl)
            authorizeUrl.searchParams.append('response_type', 'code')
            authorizeUrl.searchParams.append('client_id', this.clientId)
            authorizeUrl.searchParams.append('redirect_uri', this.redirectUrl)
            authorizeUrl.searchParams.append('scope', this.scope)
            authorizeUrl.searchParams.append('state', randomBytes(16).toString('hex'))
            authorizeUrl.searchParams.append('access_type', 'offline_access')
            authorizeUrl.searchParams.append('login_hint', email)

            this.bot.logger.debug(
                this.bot.isMobile,
                'LOGIN-APP',
                `Auth URL constructed: ${authorizeUrl.origin}${authorizeUrl.pathname}`
            )

            await this.bot.browser.utils.disableFido(this.page)

            this.bot.logger.debug(this.bot.isMobile, 'LOGIN-APP', 'Navigating to OAuth authorize URL')

            await this.page.goto(authorizeUrl.href).catch(err => {
                this.bot.logger.debug(
                    this.bot.isMobile,
                    'LOGIN-APP',
                    `page.goto() failed: ${err instanceof Error ? err.message : String(err)}`
                )
            })

            this.bot.logger.info(this.bot.isMobile, 'LOGIN-APP', 'Waiting for mobile OAuth code...')

            const start = Date.now()
            let code = ''
            let lastUrl = ''
            this.numberDisplayed = false
            this.clickedPasswordFallback = false

            while (Date.now() - start < this.maxTimeout) {
                const currentUrl = this.page.url()

                // Log only when URL changes (high signal, no spam)
                if (currentUrl !== lastUrl) {
                    this.bot.logger.debug(this.bot.isMobile, 'LOGIN-APP', `OAuth poll URL changed → ${currentUrl}`)
                    lastUrl = currentUrl
                }

                // Passkey interrupt handling
                if (currentUrl.includes('interrupt/passkey/enroll')) {
                    this.bot.logger.info(
                        this.bot.isMobile,
                        'LOGIN-APP',
                        'Passkey enrollment interrupt detected, cancelling...'
                    )
                    await this.bot.browser.utils.ghostClick(this.page, '[data-testid="secondaryButton"]')
                    await this.bot.utils.wait(2000)
                    continue
                }

                try {
                    const url = new URL(currentUrl)

                    if (url.hostname === 'login.live.com' && url.pathname === '/oauth20_desktop.srf') {
                        code = url.searchParams.get('code') || ''

                        if (code) {
                            this.bot.logger.debug(this.bot.isMobile, 'LOGIN-APP', 'OAuth code detected in redirect URL')
                            break
                        }
                    }

                    // Handle Passkey prompt if it appears
                    await this.handlePasskeyPrompt()

                    // Check for alternative sign-in options (Use your password)
                    if (!this.clickedPasswordFallback) {
                        const passwordOption = await this.page
                            .getByText(/Use my password/i)
                            .or(this.page.getByText(/Use your password/i))
                            .or(this.page.locator('[data-testid="tile"]:has(svg path[d*="M11.78 10.22a.75.75"])'))
                            .first()

                        if (await passwordOption.isVisible().catch(() => false)) {
                            this.bot.logger.info(
                                this.bot.isMobile,
                                'LOGIN-APP',
                                'Alternative password option detected, switching...'
                            )
                            await passwordOption.click({ force: true })
                            this.clickedPasswordFallback = true
                            await this.bot.utils.wait(2000)
                            continue // Skip number display logic on this loop after clicking
                        }
                    }

                    // Check if password entry is visible and enter password
                    if (this.clickedPasswordFallback) {
                        const passwordInput = await this.page.$('input[type="password"]').catch(() => null)
                        if (passwordInput && await passwordInput.isVisible()) {
                            this.bot.logger.info(
                                this.bot.isMobile,
                                'LOGIN-APP',
                                'Password input visible, authenticating...'
                            )

                            // Reuse EmailLogin for entering password since it handles typing and submitting
                            // We need to fetch the account password from the current context
                            const { account } = getCurrentContext()
                            if (account && account.password) {
                                await this.emailLogin.enterPassword(this.page, account.password)
                                await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { })
                                this.clickedPasswordFallback = false // Reset after typing
                                continue
                            } else {
                                this.bot.logger.warn(this.bot.isMobile, 'LOGIN-APP', 'Password for account not found')
                            }
                        }
                    }

                    if (!this.numberDisplayed && !this.clickedPasswordFallback) {
                        const numberElement = await this.page.$(this.selectors.numberDisplay).catch(() => null)
                        if (numberElement) {
                            const number = await numberElement.textContent().catch(() => null)
                            if (number && number.trim()) {
                                const cleanNumber = number.trim()
                                console.log('\n' + '='.repeat(60))
                                console.log('🔢 NÚMERO PARA SELECIONAR NO APP (Mobile Auth): ' + cleanNumber)
                                console.log('⏱️  Aguardando aprovação no celular...')
                                console.log('='.repeat(60) + '\n')

                                this.bot.logger.info(
                                    this.bot.isMobile,
                                    'LOGIN-APP',
                                    `Please approve login and select number: ${cleanNumber}`
                                )
                                this.numberDisplayed = true
                            }
                        }
                    }
                } catch (err) {
                    this.bot.logger.debug(
                        this.bot.isMobile,
                        'LOGIN-APP',
                        `Invalid URL while polling: ${String(currentUrl)}`
                    )
                }

                if (Date.now() - start > 30000 && (Date.now() - start) % 30000 < 1000) {
                    this.bot.logger.debug(
                        this.bot.isMobile,
                        'LOGIN-APP',
                        `Still waiting for OAuth code (elapsed: ${Math.round((Date.now() - start) / 1000)}s). URL: ${currentUrl}`
                    )
                }

                await this.bot.utils.wait(1000)
            }

            if (!code) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'LOGIN-APP',
                    `Timed out waiting for OAuth code after ${Math.round((Date.now() - start) / 1000)}s`
                )

                this.bot.logger.debug(this.bot.isMobile, 'LOGIN-APP', `Final page URL: ${this.page.url()}`)

                return ''
            }

            const data = new URLSearchParams()
            data.append('grant_type', 'authorization_code')
            data.append('client_id', this.clientId)
            data.append('code', code)
            data.append('redirect_uri', this.redirectUrl)

            this.bot.logger.debug(this.bot.isMobile, 'LOGIN-APP', 'Exchanging OAuth code for access token')

            const response = await this.bot.axios.request({
                url: this.tokenUrl,
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: data.toString()
            })

            const token = (response?.data?.access_token as string) ?? ''

            if (!token) {
                this.bot.logger.warn(this.bot.isMobile, 'LOGIN-APP', 'No access_token in token response')
                this.bot.logger.debug(
                    this.bot.isMobile,
                    'LOGIN-APP',
                    `Token response payload: ${JSON.stringify(response?.data)}`
                )
                return ''
            }

            this.bot.logger.info(this.bot.isMobile, 'LOGIN-APP', 'Mobile access token received')
            return token
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'LOGIN-APP',
                `MobileAccess error: ${error instanceof Error ? error.stack || error.message : String(error)}`
            )
            return ''
        } finally {
            this.bot.logger.debug(this.bot.isMobile, 'LOGIN-APP', 'Returning to base URL')
            await this.page.goto(this.bot.config.baseURL, { timeout: 10000 }).catch(() => { })
        }
    }
}
