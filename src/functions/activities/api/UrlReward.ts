import type { AxiosRequestConfig } from 'axios'
import type { Page } from 'patchright'
import type { BasePromotion } from '../../../interface/DashboardData'
import { Workers } from '../../Workers'

export class UrlReward extends Workers {
    private cookieHeader: string = ''

    private fingerprintHeader: { [x: string]: string } = {}

    private gainedPoints: number = 0

    private oldBalance: number = this.bot.userData.currentPoints

    public async doUrlReward(promotion: BasePromotion, page?: Page) {
        const offerId = promotion.offerId

        if (this.bot.rewardsVersion === 'modern' && page) {
            this.bot.logger.info(
                this.bot.isMobile,
                'URL-REWARD',
                `Resolving UrlReward via browser navigation | offerId=${offerId} | url=${promotion.destinationUrl}`
            )
            try {
                const browserContext = page.context()
                const newPage = await browserContext.newPage()
                // Wait for full load and scroll/stay longer to ensure tracking registers
                await newPage.goto(promotion.destinationUrl, { waitUntil: 'load', timeout: 20000 }).catch(() => {})
                await this.bot.utils.wait(3000)
                await newPage.evaluate(() => window.scrollBy(0, window.innerHeight / 2)).catch(() => {})
                await this.bot.utils.wait(this.bot.utils.randomDelay(3000, 5000))
                await newPage.evaluate(() => window.scrollTo(0, 0)).catch(() => {})
                await this.bot.utils.wait(this.bot.utils.randomDelay(2000, 4000))
                await newPage.close()

                const newBalance = await this.bot.browser.func.getCurrentPoints()
                this.gainedPoints = newBalance - this.oldBalance

                if (this.gainedPoints > 0) {
                    this.bot.userData.currentPoints = newBalance
                    this.bot.userData.gainedPoints = (this.bot.userData.gainedPoints ?? 0) + this.gainedPoints

                    this.bot.logger.info(
                        this.bot.isMobile,
                        'URL-REWARD',
                        `Completed UrlReward (Browser) | offerId=${offerId} | gainedPoints=${this.gainedPoints} | newBalance=${newBalance}`,
                        'green'
                    )
                } else {
                    this.bot.logger.warn(
                        this.bot.isMobile,
                        'URL-REWARD',
                        `UrlReward (Browser) completed but no points gained yet | offerId=${offerId} | balance=${newBalance}`
                    )
                }
                return
            } catch (browserError) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'URL-REWARD',
                    `Browser navigation failed: ${browserError instanceof Error ? browserError.message : String(browserError)}. Falling back to API...`
                )
            }
        }

        if (!this.bot.requestToken && this.bot.rewardsVersion === 'classic') {
            this.bot.logger.warn(
                this.bot.isMobile,
                'URL-REWARD',
                'Skipping: Request token not available, this activity requires it!'
            )
            return
        }

        this.bot.logger.info(
            this.bot.isMobile,
            'URL-REWARD',
            `Starting UrlReward | offerId=${offerId} | geo=${this.bot.userData.geoLocale} | oldBalance=${this.oldBalance}`
        )

        try {
            this.cookieHeader = this.bot.browser.func.buildCookieHeader(
                this.bot.isMobile ? this.bot.cookies.mobile : this.bot.cookies.desktop,
                ['bing.com', 'live.com', 'microsoftonline.com']
            )

            const fingerprintHeaders = { ...this.bot.fingerprint.headers }
            delete fingerprintHeaders['Cookie']
            delete fingerprintHeaders['cookie']
            this.fingerprintHeader = fingerprintHeaders

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Prepared UrlReward headers | offerId=${offerId} | cookieLength=${this.cookieHeader.length} | fingerprintHeaderKeys=${Object.keys(this.fingerprintHeader).length}`
            )

            const formData = new URLSearchParams({
                id: offerId,
                hash: promotion.hash,
                timeZone: '60',
                activityAmount: '1',
                dbs: '0',
                form: '',
                type: '',
                __RequestVerificationToken: this.bot.requestToken
            })

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Prepared UrlReward form data | offerId=${offerId} | hash=${promotion.hash} | timeZone=60 | activityAmount=1`
            )

            const request: AxiosRequestConfig = {
                url: 'https://rewards.bing.com/api/reportactivity?X-Requested-With=XMLHttpRequest',
                method: 'POST',
                headers: {
                    ...(this.bot.fingerprint?.headers ?? {}),
                    Cookie: this.cookieHeader,
                    Referer: 'https://rewards.bing.com/',
                    Origin: 'https://rewards.bing.com'
                },
                data: formData
            }

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Sending UrlReward request | offerId=${offerId} | url=${request.url}`
            )

            const response = await this.bot.axios.request(request)

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Received UrlReward response | offerId=${offerId} | status=${response.status}`
            )

            const newBalance = await this.bot.browser.func.getCurrentPoints()
            this.gainedPoints = newBalance - this.oldBalance

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Balance delta after UrlReward | offerId=${offerId} | oldBalance=${this.oldBalance} | newBalance=${newBalance} | gainedPoints=${this.gainedPoints}`
            )

            if (this.gainedPoints > 0) {
                this.bot.userData.currentPoints = newBalance
                this.bot.userData.gainedPoints = (this.bot.userData.gainedPoints ?? 0) + this.gainedPoints

                this.bot.logger.info(
                    this.bot.isMobile,
                    'URL-REWARD',
                    `Completed UrlReward | offerId=${offerId} | status=${response.status} | gainedPoints=${this.gainedPoints} | newBalance=${newBalance}`,
                    'green'
                )
            } else {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'URL-REWARD',
                    `Failed UrlReward with no points | offerId=${offerId} | status=${response.status} | oldBalance=${this.oldBalance} | newBalance=${newBalance}`
                )
                if (page && promotion.destinationUrl) {
                    this.bot.logger.info(
                        this.bot.isMobile,
                        'URL-REWARD',
                        `Attempting browser navigation fallback for UrlReward | offerId=${offerId} | url=${promotion.destinationUrl}`
                    )
                    try {
                        const browserContext = page.context()
                        const newPage = await browserContext.newPage()
                        // Wait for full load and scroll/stay longer to ensure tracking registers
                        await newPage.goto(promotion.destinationUrl, { waitUntil: 'load', timeout: 20000 }).catch(() => {})
                        await this.bot.utils.wait(3000)
                        await newPage.evaluate(() => window.scrollBy(0, window.innerHeight / 2)).catch(() => {})
                        await this.bot.utils.wait(this.bot.utils.randomDelay(3000, 5000))
                        await newPage.evaluate(() => window.scrollTo(0, 0)).catch(() => {})
                        await this.bot.utils.wait(this.bot.utils.randomDelay(2000, 4000))
                        await newPage.close()

                        const postBalance = await this.bot.browser.func.getCurrentPoints()
                        const postGained = postBalance - this.oldBalance
                        if (postGained > 0) {
                            this.bot.userData.currentPoints = postBalance
                            this.bot.userData.gainedPoints = (this.bot.userData.gainedPoints ?? 0) + postGained
                            this.bot.logger.info(
                                this.bot.isMobile,
                                'URL-REWARD',
                                `Completed UrlReward via browser fallback | offerId=${offerId} | gainedPoints=${postGained} | newBalance=${postBalance}`,
                                'green'
                            )
                        } else {
                            this.bot.logger.warn(
                                this.bot.isMobile,
                                'URL-REWARD',
                                `Browser fallback completed but still no points gained | offerId=${offerId}`
                            )
                        }
                    } catch (fallbackError) {
                        this.bot.logger.error(
                            this.bot.isMobile,
                            'URL-REWARD',
                            `Browser fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
                        )
                    }
                }
            }

            this.bot.logger.debug(this.bot.isMobile, 'URL-REWARD', `Waiting after UrlReward | offerId=${offerId}`)

            await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 10000))
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'URL-REWARD',
                `Error in doUrlReward | offerId=${promotion.offerId} | message=${error instanceof Error ? error.message : String(error)}`
            )
        }
    }
}
