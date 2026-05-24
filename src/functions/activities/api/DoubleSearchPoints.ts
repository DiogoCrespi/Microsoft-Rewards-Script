import type { AxiosRequestConfig } from 'axios'
import type { Page } from 'patchright'
import { Workers } from '../../Workers'
import { PromotionalItem } from '../../../interface/DashboardData'

export class DoubleSearchPoints extends Workers {
    private cookieHeader: string = ''

    private fingerprintHeader: { [x: string]: string } = {}



    public async doDoubleSearchPoints(promotion: PromotionalItem, page?: Page) {
        const offerId = promotion.offerId
        const activityType = promotion.activityType

        if (this.bot.rewardsVersion === 'modern' && page) {
            this.bot.logger.info(
                this.bot.isMobile,
                'DOUBLE-SEARCH-POINTS',
                `Resolving DoubleSearchPoints via browser navigation | offerId=${offerId} | url=${promotion.destinationUrl}`
            )
            try {
                const browserContext = page.context()
                const newPage = await browserContext.newPage()
                await newPage.goto(promotion.destinationUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
                await this.bot.utils.wait(this.bot.utils.randomDelay(3000, 6000))
                await newPage.close()

                const data = await this.bot.browser.func.getDashboardData()
                const promotionalItem = data.promotionalItems.find(item =>
                    item.name.toLowerCase().includes('ww_banner_optin_2x')
                )

                if (promotionalItem) {
                    this.bot.logger.warn(
                        this.bot.isMobile,
                        'DOUBLE-SEARCH-POINTS',
                        `Unable to find or activate Double Search Points via browser | offerId=${offerId}`
                    )
                } else {
                    this.bot.logger.info(
                        this.bot.isMobile,
                        'DOUBLE-SEARCH-POINTS',
                        `Activated Double Search Points (Browser) | offerId=${offerId}`,
                        'green'
                    )
                }
                return
            } catch (browserError) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'DOUBLE-SEARCH-POINTS',
                    `Browser navigation failed: ${browserError instanceof Error ? browserError.message : String(browserError)}. Falling back to API...`
                )
            }
        }

        try {
            if (!this.bot.requestToken && this.bot.rewardsVersion === 'classic') {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'DOUBLE-SEARCH-POINTS',
                    'Skipping: Request token not available, this activity requires it!'
                )
                return
            }

            this.cookieHeader = this.bot.browser.func.buildCookieHeader(
                this.bot.isMobile ? this.bot.cookies.mobile : this.bot.cookies.desktop,
                ['bing.com', 'live.com', 'microsoftonline.com']
            )

            const fingerprintHeaders = { ...this.bot.fingerprint.headers }
            delete fingerprintHeaders['Cookie']
            delete fingerprintHeaders['cookie']
            this.fingerprintHeader = fingerprintHeaders

            this.bot.logger.info(
                this.bot.isMobile,
                'DOUBLE-SEARCH-POINTS',
                `Starting Double Search Points | offerId=${offerId}`
            )

            this.bot.logger.debug(
                this.bot.isMobile,
                'DOUBLE-SEARCH-POINTS',
                `Prepared headers | cookieLength=${this.cookieHeader.length} | fingerprintHeaderKeys=${Object.keys(this.fingerprintHeader).length}`
            )

            const formData = new URLSearchParams({
                id: offerId,
                hash: promotion.hash,
                timeZone: '60',
                activityAmount: '1',
                dbs: '0',
                form: '',
                type: activityType,
                __RequestVerificationToken: this.bot.requestToken
            })

            this.bot.logger.debug(
                this.bot.isMobile,
                'DOUBLE-SEARCH-POINTS',
                `Prepared Double Search Points form data | offerId=${offerId} | hash=${promotion.hash} | timeZone=60 | activityAmount=1 | type=${activityType}`
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
                'DOUBLE-SEARCH-POINTS',
                `Sending Double Search Points request | offerId=${offerId} | url=${request.url}`
            )

            const response = await this.bot.axios.request(request)

            this.bot.logger.debug(
                this.bot.isMobile,
                'DOUBLE-SEARCH-POINTS',
                `Received Double Search Points response | offerId=${offerId} | status=${response.status}`
            )

            const data = await this.bot.browser.func.getDashboardData()
            const promotionalItem = data.promotionalItems.find(item =>
                item.name.toLowerCase().includes('ww_banner_optin_2x')
            )

            // If OK, should no longer be presernt in promotionalItems
            if (promotionalItem) {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'DOUBLE-SEARCH-POINTS',
                    `Unable to find or activate Double Search Points | offerId=${offerId} | status=${response.status}`
                )
            } else {
                this.bot.logger.info(
                    this.bot.isMobile,
                    'DOUBLE-SEARCH-POINTS',
                    `Activated Double Search Points | offerId=${offerId} | status=${response.status}`,
                    'green'
                )
            }

            this.bot.logger.debug(
                this.bot.isMobile,
                'DOUBLE-SEARCH-POINTS',
                `Waiting after Double Search Points | offerId=${offerId}`
            )

            await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 10000))
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'DOUBLE-SEARCH-POINTS',
                `Error in doDoubleSearchPoints | offerId=${offerId} | message=${error instanceof Error ? error.message : String(error)}`
            )
        }
    }
}
