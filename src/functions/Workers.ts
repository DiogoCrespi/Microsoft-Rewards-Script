import type { Page } from 'patchright'
import * as fs from 'fs'
import * as path from 'path'
import type { MicrosoftRewardsBot } from '../index'
import type {
    DashboardData,
    PunchCard,
    BasePromotion,
    FindClippyPromotion,
    PurplePromotionalItem
} from '../interface/DashboardData'
import type { AppDashboardData } from '../interface/AppDashBoardData'

export class Workers {
    public bot: MicrosoftRewardsBot

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    public async doDailySet(data: DashboardData, page: Page) {
        const todayKey = this.bot.utils.getFormattedDate()
        let todayData = data.dailySetPromotions[todayKey]

        if (!todayData) {
            const keys = Object.keys(data.dailySetPromotions || {})
            this.bot.logger.warn(
                this.bot.isMobile,
                'DAILY-SET',
                `Today's key "${todayKey}" not found in dailySetPromotions. Available keys: ${keys.join(', ')}`
            )
            for (const key of keys) {
                if (data.dailySetPromotions[key] && data.dailySetPromotions[key]!.length > 0) {
                    const hasUncompleted = data.dailySetPromotions[key]!.some(x => !x.complete && x.pointProgressMax > 0)
                    if (hasUncompleted) {
                        todayData = data.dailySetPromotions[key]
                        this.bot.logger.info(
                            this.bot.isMobile,
                            'DAILY-SET',
                            `Using daily set key "${key}" as fallback because it has uncompleted activities`
                        )
                        break
                    }
                }
            }

            if (!todayData && keys.length > 0) {
                const firstKey = keys[0]!
                todayData = data.dailySetPromotions[firstKey]
                this.bot.logger.info(
                    this.bot.isMobile,
                    'DAILY-SET',
                    `Using daily set key "${firstKey}" as ultimate fallback`
                )
            }
        }

        const activitiesUncompleted = todayData?.filter(x => !x.complete && x.pointProgressMax > 0) ?? []

        if (!activitiesUncompleted.length) {
            this.bot.logger.info(this.bot.isMobile, 'DAILY-SET', 'All "Daily Set" items have already been completed')
            return
        }

        this.bot.logger.info(this.bot.isMobile, 'DAILY-SET', 'Started solving "Daily Set" items')

        await this.solveActivities(activitiesUncompleted, page)

        this.bot.logger.info(this.bot.isMobile, 'DAILY-SET', 'All "Daily Set" items have been completed')
    }

    public async doMorePromotions(data: DashboardData, page: Page) {
        const morePromotions: BasePromotion[] = [
            ...new Map(
                [...(data.morePromotions ?? []), ...(data.morePromotionsWithoutPromotionalItems ?? [])]
                    .filter(Boolean)
                    .map(p => [p.offerId, p as BasePromotion] as const)
            ).values()
        ]

        const activitiesUncompleted: BasePromotion[] =
            morePromotions?.filter(x => {
                if (x.complete) return false
                if (x.pointProgressMax <= 0) return false
                if (x.exclusiveLockedFeatureStatus === 'locked') return false
                if (!x.promotionType) return false

                return true
            }) ?? []

        if (!activitiesUncompleted.length) {
            this.bot.logger.info(
                this.bot.isMobile,
                'MORE-PROMOTIONS',
                'All "More Promotion" items have already been completed'
            )
            return
        }

        this.bot.logger.info(
            this.bot.isMobile,
            'MORE-PROMOTIONS',
            `Started solving ${activitiesUncompleted.length} "More Promotions" items`
        )

        await this.solveActivities(activitiesUncompleted, page)

        this.bot.logger.info(this.bot.isMobile, 'MORE-PROMOTIONS', 'All "More Promotion" items have been completed')
    }

    public async doAppPromotions(data: AppDashboardData) {
        const appRewards = data.response.promotions.filter(x => {
            if (x.attributes['complete']?.toLowerCase() !== 'false') return false
            if (!x.attributes['offerid']) return false
            if (!x.attributes['type']) return false
            if (x.attributes['type'] !== 'sapphire') return false

            return true
        })

        if (!appRewards.length) {
            this.bot.logger.info(
                this.bot.isMobile,
                'APP-PROMOTIONS',
                'All "App Promotions" items have already been completed'
            )
            return
        }

        for (const reward of appRewards) {
            await this.bot.activities.doAppReward(reward)
            // A delay between completing each activity
            await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 15000))
        }

        this.bot.logger.info(this.bot.isMobile, 'APP-PROMOTIONS', 'All "App Promotions" items have been completed')
    }

    public async doSpecialPromotions(data: DashboardData) {
        const specialPromotions: PurplePromotionalItem[] = [
            ...new Map(
                [...(data.promotionalItems ?? [])]
                    .filter(Boolean)
                    .map(p => [p.offerId, p as PurplePromotionalItem] as const)
            ).values()
        ]

        const supportedPromotions = ['ww_banner_optin_2x']

        const specialPromotionsUncompleted: PurplePromotionalItem[] =
            specialPromotions?.filter(x => {
                if (x.complete) return false
                if (x.exclusiveLockedFeatureStatus === 'locked') return false
                if (!x.promotionType) return false

                const offerId = (x.offerId ?? '').toLowerCase()
                return supportedPromotions.some(s => offerId.includes(s))
            }) ?? []

        for (const activity of specialPromotionsUncompleted) {
            try {
                const type = activity.promotionType?.toLowerCase() ?? ''
                const name = activity.name?.toLowerCase() ?? ''
                const offerId = (activity as PurplePromotionalItem).offerId

                this.bot.logger.debug(
                    this.bot.isMobile,
                    'SPECIAL-ACTIVITY',
                    `Processing activity | title="${activity.title}" | offerId=${offerId} | type=${type}"`
                )

                switch (type) {
                    // UrlReward
                    case 'urlreward': {
                        // Special "Double Search Points" activation
                        if (name.includes('ww_banner_optin_2x')) {
                            this.bot.logger.info(
                                this.bot.isMobile,
                                'ACTIVITY',
                                `Found activity type "Double Search Points" | title="${activity.title}" | offerId=${offerId}`
                            )

                            await this.bot.activities.doDoubleSearchPoints(activity)
                        }
                        break
                    }

                    // Unsupported types
                    default: {
                        this.bot.logger.warn(
                            this.bot.isMobile,
                            'SPECIAL-ACTIVITY',
                            `Skipped activity "${activity.title}" | offerId=${offerId} | Reason: Unsupported type "${activity.promotionType}"`
                        )
                        break
                    }
                }
            } catch (error) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'SPECIAL-ACTIVITY',
                    `Error while solving activity "${activity.title}" | message=${error instanceof Error ? error.message : String(error)}`
                )
            }
        }

        this.bot.logger.info(this.bot.isMobile, 'SPECIAL-ACTIVITY', 'All "Special Activites" items have been completed')
    }

    public async doPunchCards(data: DashboardData, page: Page) {
        const punchCards =
            data.punchCards?.filter(
                x => !x.parentPromotion?.complete && (x.parentPromotion?.pointProgressMax ?? 0) > 0
            ) ?? []

        const punchCardActivities = punchCards.flatMap(x => x.childPromotions)

        const activitiesUncompleted: BasePromotion[] =
            punchCardActivities?.filter(x => {
                if (x.complete) return false
                if (x.exclusiveLockedFeatureStatus === 'locked') return false
                if (!x.promotionType) return false

                return true
            }) ?? []

        if (!activitiesUncompleted.length) {
            this.bot.logger.info(this.bot.isMobile, 'PUNCHCARD', 'All "Punch Card" items have already been completed')
            return
        }

        this.bot.logger.info(
            this.bot.isMobile,
            'PUNCHCARD',
            `Started solving ${activitiesUncompleted.length} "Punch Card" items`
        )

        await this.solveActivities(activitiesUncompleted, page)

        this.bot.logger.info(this.bot.isMobile, 'PUNCHCARD', 'All "Punch Card" items have been completed')
    }

    private async solveActivities(activities: BasePromotion[], page: Page, punchCard?: PunchCard) {
        for (const activity of activities) {
            try {
                const type = activity.promotionType?.toLowerCase() ?? ''
                const name = activity.name?.toLowerCase() ?? ''
                const offerId = (activity as BasePromotion).offerId
                const destinationUrl = activity.destinationUrl?.toLowerCase() ?? ''

                this.bot.logger.debug(
                    this.bot.isMobile,
                    'ACTIVITY',
                    `Processing activity | title="${activity.title}" | offerId=${offerId} | type=${type} | punchCard="${punchCard?.parentPromotion?.title ?? 'none'}"`
                )

                switch (type) {
                    // Quiz-like activities (Poll / regular quiz variants)
                    case 'quiz': {
                        const basePromotion = activity as BasePromotion

                        // Poll (usually 10 points, pollscenarioid in URL)
                        if (activity.pointProgressMax === 10 && destinationUrl.includes('pollscenarioid')) {
                            this.bot.logger.info(
                                this.bot.isMobile,
                                'ACTIVITY',
                                `Found activity type "Poll" | title="${activity.title}" | offerId=${offerId}`
                            )

                            //await this.bot.activities.doPoll(basePromotion)
                            break
                        }

                        // All other quizzes handled via Quiz API
                        this.bot.logger.info(
                            this.bot.isMobile,
                            'ACTIVITY',
                            `Found activity type "Quiz" | title="${activity.title}" | offerId=${offerId}`
                        )

                        await this.bot.activities.doQuiz(basePromotion)
                        break
                    }

                    // UrlReward
                    case 'urlreward': {
                        const basePromotion = activity as BasePromotion

                        // Search on Bing are subtypes of "urlreward"
                        if (name.includes('exploreonbing')) {
                            this.bot.logger.info(
                                this.bot.isMobile,
                                'ACTIVITY',
                                `Found activity type "SearchOnBing" | title="${activity.title}" | offerId=${offerId}`
                            )

                            await this.bot.activities.doSearchOnBing(basePromotion, page)
                        } else if (destinationUrl.includes('wqoskey') || destinationUrl.includes('isconversation') || (destinationUrl.includes('quiz') && !destinationUrl.includes('urloffer'))) {
                            this.bot.logger.info(
                                this.bot.isMobile,
                                'ACTIVITY',
                                `Redirecting "UrlReward" which appears to be a Quiz to doQuiz | title="${activity.title}" | offerId=${offerId}`
                            )

                            await this.bot.activities.doQuiz(basePromotion)
                        } else {
                            this.bot.logger.info(
                                this.bot.isMobile,
                                'ACTIVITY',
                                `Found activity type "UrlReward" | title="${activity.title}" | offerId=${offerId}`
                            )

                            await this.bot.activities.doUrlReward(basePromotion, page)
                        }
                        break
                    }

                    // Find Clippy specific promotion type
                    case 'findclippy': {
                        const clippyPromotion = activity as unknown as FindClippyPromotion

                        this.bot.logger.info(
                            this.bot.isMobile,
                            'ACTIVITY',
                            `Found activity type "FindClippy" | title="${activity.title}" | offerId=${offerId}`
                        )

                        await this.bot.activities.doFindClippy(clippyPromotion)
                        break
                    }

                    // Unsupported types
                    default: {
                        this.bot.logger.warn(
                            this.bot.isMobile,
                            'ACTIVITY',
                            `Skipped activity "${activity.title}" | offerId=${offerId} | Reason: Unsupported type "${activity.promotionType}". Trying browser fallback...`
                        )
                        if (page && activity.destinationUrl) {
                            try {
                                const browserContext = page.context()
                                const newPage = await browserContext.newPage()
                                await newPage.goto(activity.destinationUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
                                await this.bot.utils.wait(this.bot.utils.randomDelay(4000, 8000))
                                await newPage.close()
                                this.bot.logger.info(
                                    this.bot.isMobile,
                                    'ACTIVITY',
                                    `Completed unsupported activity "${activity.title}" via browser fallback`,
                                    'green'
                                )
                            } catch (fallbackError) {
                                this.bot.logger.error(
                                    this.bot.isMobile,
                                    'ACTIVITY',
                                    `Browser fallback failed for "${activity.title}": ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
                                )
                            }
                        }
                        break
                    }
                }

                // Cooldown
                await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 15000))
            } catch (error) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'ACTIVITY',
                    `Error while solving activity "${activity.title}" | message=${error instanceof Error ? error.message : String(error)}`
                )
            }
        }
    }

    public async claimPendingPoints(page: Page) {
        this.bot.logger.info(this.bot.isMobile, 'CLAIM-POINTS', 'Checking for pending points to claim...')
        
        try {
            if (page.isClosed()) return
            const currentUrl = page.url()
            if (!currentUrl.includes('rewards.bing.com')) {
                await page.goto('https://rewards.bing.com', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {})
            }

            await this.dismissGetRewardsWelcome(page)

            const claimTriggers = [
                'text=/pronto para reivindicar/i',
                'text=/reivindicar\\s*\\d*/i',
                'text=/ready to claim/i',
                'text=/claim\\s*\\d*/i'
            ]

            let triggerFound = false
            for (const selector of claimTriggers) {
                if (page.isClosed()) return
                const locator = page.locator(selector).first()
                if (await locator.isVisible()) {
                    const textContent = await locator.innerText().catch(() => '')
                    this.bot.logger.info(this.bot.isMobile, 'CLAIM-POINTS', `Found claim trigger "${textContent.trim().replace(/\n/g, ' ')}" using selector: "${selector}". Clicking it...`)
                    await locator.click({ timeout: 5000 }).catch(async () => {
                        if (page.isClosed()) return
                        await this.bot.browser.utils.ghostClick(page, selector).catch(() => {})
                    })
                    triggerFound = true
                    await this.bot.utils.wait(3000)
                    break
                }
            }

            if (triggerFound) {
                const claimButtons = [
                    'button:has-text("Reivindicar pontos")',
                    'button:has-text("Claim points")',
                    'button:has-text("Reivindicar")',
                    'button:has-text("Claim")',
                    'span:has-text("Reivindicar pontos")',
                    'span:has-text("Claim points")',
                    'span:has-text("Reivindicar")',
                    'span:has-text("Claim")',
                    'a:has-text("Reivindicar")',
                    'a:has-text("Claim")',
                    'text=/reivindicar pontos/i',
                    'text=/claim points/i',
                    'text=/reivindicar/i',
                    'text=/claim/i'
                ]

                let buttonClicked = false
                for (const selector of claimButtons) {
                    if (page.isClosed()) return
                    const button = page.locator(selector).first()
                    if (await button.isVisible()) {
                        const btnText = await button.innerText().catch(() => '')
                        this.bot.logger.info(this.bot.isMobile, 'CLAIM-POINTS', `Found claim confirmation button "${btnText.trim()}" using selector: "${selector}". Clicking...`)
                        await button.click({ timeout: 5000 }).catch(async () => {
                                if (page.isClosed()) return
                                await this.bot.browser.utils.ghostClick(page, selector).catch(() => {})
                            })
                        buttonClicked = true
                        this.bot.logger.info(this.bot.isMobile, 'CLAIM-POINTS', 'Successfully claimed points!', 'green')
                        await this.bot.utils.wait(3000)
                        break
                    }
                }

                if (!buttonClicked) {
                    this.bot.logger.warn(this.bot.isMobile, 'CLAIM-POINTS', 'Claim panel was opened, but the final claim button could not be found.')
                }
            } else {
                this.bot.logger.info(this.bot.isMobile, 'CLAIM-POINTS', 'No pending points to claim today.')
            }
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'CLAIM-POINTS',
                `Error while claiming pending points: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    public async doUiEarnActivities(page: Page) {
        this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', 'Checking for UI-based Earn activities (e.g. Spotify, special tasks)...')

        try {
            if (page.isClosed()) return
            const currentUrl = page.url()
            if (!currentUrl.includes('rewards.bing.com/earn')) {
                await page.goto('https://rewards.bing.com/earn', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {})
            }

            await this.dismissGetRewardsWelcome(page)

            const earnTabs = [
                'text=/Ganhar/i',
                'text=/Earn/i',
                'text=/Buscas/i',
                'text=/Search/i',
                'text=/Pesquisas/i',
                'text=/Searches/i',
                'span:has-text("Ganhar")',
                'span:has-text("Earn")',
                'span:has-text("Buscas")',
                'span:has-text("Search")',
                'div:has-text("Ganhar")',
                'div:has-text("Earn")',
                'div:has-text("Buscas")',
                'div:has-text("Search")'
            ]
            for (const selector of earnTabs) {
                if (page.isClosed()) return
                const tab = page.locator(selector).first()
                if (await tab.isVisible()) {
                    this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Clicking Earn tab using: "${selector}"`)
                    await tab.click().catch(() => {})
                    await this.bot.utils.wait(3000)
                    break
                }
            }

            // Coleta de cards pendentes na página principal (para evitar re-processamentos ou loops de locators filhos)
            const pendingCardTexts: string[] = await page.evaluate(() => {
                const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], [data-rac], [data-react-aria-pressable="true"], .cursor-pointer, [onclick], div[class*="card" i], div[class*="tile" i], div[class*="item" i], div[class*="promo" i], div[class*="activity" i], section[class*="card" i], section[class*="tile" i], section[class*="item" i], section[class*="promo" i], section[class*="activity" i], li[class*="card" i], li[class*="tile" i], li[class*="item" i], li[class*="promo" i], li[class*="activity" i]'))
                
                const texts: string[] = []
                
                const progressRegex = /\d+\s*\/\s*\d+\s*(tarefas|tasks|stages|etapas|steps|atividades|activities|items|itens|dias|days|pesquisas|searches|rodadas|rounds)/i
                const bingStarRegex = /(bônus bing star|bing star bonus)/i
                const dailySetRegex = /(série de conjunto diário|daily set)/i

                // Pre-scan: collect all elements that are inside a "Quests" section.
                // These cause infinite loops and should be completely ignored.
                const questsContainerElements = new Set<Element>()
                const sectionHeaders = Array.from(document.querySelectorAll('h1, h2, h3, h4, [class*="sectionHeader" i], [class*="section-header" i], [class*="section_header" i]'))
                for (const header of sectionHeaders) {
                    const headerText = (header.textContent || '').trim().toLowerCase()
                    if (headerText === 'quests' || headerText === 'missões' || headerText === 'quest') {
                        // Walk up to find the section container, then collect all its descendants
                        let container: Element | null = header.parentElement
                        for (let i = 0; i < 5 && container; i++) {
                            const siblings = Array.from(container.parentElement?.children ?? [])
                            if (siblings.length > 1) {
                                // Found a meaningful container level — collect everything inside the parent section
                                const parent = container.parentElement!
                                Array.from(parent.querySelectorAll('*')).forEach(el => questsContainerElements.add(el))
                                break
                            }
                            container = container.parentElement
                        }
                        // Also always collect descendants of the header's own parent
                        if (header.parentElement) {
                            Array.from(header.parentElement.querySelectorAll('*')).forEach(el => questsContainerElements.add(el))
                        }
                    }
                }

                for (const el of candidates) {
                    // Skip any element that lives inside a Quests section
                    if (questsContainerElements.has(el)) continue

                    const rect = el.getBoundingClientRect()
                    if (rect.width === 0 || rect.height === 0) continue
                    
                    const fullText = ((el as any).innerText || el.textContent || '').trim()
                    if (fullText.length < 3) continue
                    
                    const lowerText = fullText.toLowerCase()
                    
                    // Skip Spotify cards (check text, href, and aria-label)
                    const spotifyCheck = (s: string) => s.toLowerCase().includes('spotify')
                    if (spotifyCheck(lowerText)) continue
                    if (spotifyCheck(el.getAttribute('href') || '')) continue
                    if (spotifyCheck(el.getAttribute('aria-label') || '')) continue
                    
                    const completionWords = ['concluído', 'concluido', 'completed', 'resgatado', 'claimed', 'ganhou', 'won']
                    if (completionWords.some(word => lowerText.includes(word))) continue
                    
                    // Hard unconditional blacklist - ALWAYS skip these regardless of points numbers in the text
                    const hardBlacklist = [
                        'streak', 'streaks', 'série de dias', 'serie de dias',
                        'como funciona', 'how it works',
                        'dashboard', 'painel',
                        'redeem', 'resgatar',
                        'about', 'sobre',
                        'sequência', 'sequencia', 'sequências', 'sequencias',
                        'racha', 'rachas', 'sequenza', 'sequenze',
                        'saiba mais', 'learn more', 'see more', 'find out more',
                        'saber más', 'saber mas',
                        // Multi-day / informational cards that cannot be completed in a single session
                        'in a row', 'em seguida', 'seguidos', 'days in a row',
                        'expires in', 'expira em', 'expira daqui',
                        'days to go', 'dias restantes', 'days left',
                        'complete the daily set for', 'complete o conjunto diário por'
                    ]
                    if (hardBlacklist.some(word => lowerText.includes(word))) continue
                    
                    // isDailySetStreak = legitimate Daily Set multi-day progress cards (NOT streak boards)
                    const isDailySetStreak = ['conjunto diário', 'conjunto diario', 'daily set', 'série de conjunto', 'serie de conjunto', 'sequência diária', 'sequencia diaria'].some(kw => lowerText.includes(kw))
                    
                    const hasAllowedKeyword = ['set', 'conjunto', 'check-in', 'check in', 'diário', 'diario'].some(kw => lowerText.includes(kw))
                    
                    if (!isDailySetStreak && !hasAllowedKeyword && ['refer and earn', 'indique e ganhe', 'indicações', 'referrals'].some(word => lowerText.includes(word))) continue
 
                    if (!isDailySetStreak && (lowerText.includes('série') || lowerText.includes('séries') || lowerText.includes('serie') || lowerText.includes('series'))) {
                        const allowedSeries = ['check-in', 'check in', 'diário', 'diario', 'set', 'conjunto', 'daily', 'diária', 'diaria']
                        if (!allowedSeries.some(allowed => lowerText.includes(allowed))) {
                            continue
                        }
                    }
 
                    // Se o texto tiver uma fração do tipo X/Y onde X >= Y, consideramos concluído
                    const fractionMatch = fullText.match(/(\d+)\s*\/\s*(\d+)/)
                    if (fractionMatch && fractionMatch[1] !== undefined && fractionMatch[2] !== undefined) {
                        const num = parseInt(fractionMatch[1])
                        const den = parseInt(fractionMatch[2])
                        if (num >= den) continue // already complete
                        // Incomplete multi-day progress (e.g. "6/7 tasks") — can't advance a day-streak in one session
                        const progressRegexLocal = /\d+\s*\/\s*\d+\s*(tarefas|tasks|stages|etapas|steps|atividades|activities|items|itens|dias|days|pesquisas|searches|rodadas|rounds)/i
                        if (progressRegexLocal.test(fullText)) continue
                    }
                    
                    const isProgress = progressRegex.test(fullText)
                    const pointsRegex = /(?:\+)\s*\d+/
                    const hasPoints = pointsRegex.test(fullText) || /\b(5|10|15|20|30|40|50|100)\b/.test(fullText) || /\b\d+\s*(pontos|points|pts)\b/i.test(fullText)
                    const matchesTarget = isProgress || bingStarRegex.test(fullText) || dailySetRegex.test(fullText) || hasPoints
                    if (matchesTarget) {
                        let text = fullText
                        if (text.includes('\n')) {
                            text = text.split('\n')[0].trim()
                        }
                        if (text.length >= 3 && text.length <= 80 && !texts.includes(text)) {
                            texts.push(text)
                        }
                    }
                }
                return texts
            })

            this.bot.logger.debug(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Dynamic card scan found ${pendingCardTexts.length} pending cards: ${JSON.stringify(pendingCardTexts)}`)

            // Session-level set: prevents the same sub-task (e.g. "Bing", "Xbox") from being
            // attempted more than once across DIFFERENT parent cards in the same run.
            const sessionAttemptedSubtasks = new Set<string>()

            let cardsFound = 0
            for (const cardText of pendingCardTexts) {
                if (page.isClosed()) return
                
                const currentUrl = page.url()
                if (!currentUrl.includes('rewards.bing.com/earn')) {
                    this.bot.logger.warn(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Page navigated away before opening card to "${currentUrl}". Navigating back to earn page...`)
                    await page.goto('https://rewards.bing.com/earn', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
                    await this.bot.utils.wait(3000)
                }

                const cardLocator = page.locator(`text="${cardText}"`).first()
                if (await cardLocator.isVisible()) {
                    this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Found activity card: "${cardText}". Opening...`)
                    
                    // Usar um timeout curto de 5s para evitar travamento padrão de 30s do Playwright
                    await cardLocator.click({ timeout: 5000 }).catch(async () => {
                        if (page.isClosed()) return
                        await cardLocator.locator('xpath=..').click({ timeout: 5000 }).catch(() => {})
                    })
                    
                    await this.bot.utils.wait(4000)
                    cardsFound++

                    if (page.isClosed()) return
                    const afterClickUrl = page.url()
                    if (afterClickUrl.includes('bingapp.microsoft.com') || !afterClickUrl.includes('rewards.bing.com/earn')) {
                        this.bot.logger.warn(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Page navigated away to "${afterClickUrl}". Navigating back to earn page...`)
                        await page.goto('https://rewards.bing.com/earn', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
                        await this.bot.utils.wait(3000)
                        continue
                    }

                    await this.solveUiPromotionPanel(page, sessionAttemptedSubtasks)

                    if (page.isClosed()) return
                    let closed = false
                    const closeButtons = [
                        'button[aria-label*="Close" i]',
                        'button[aria-label*="Fechar" i]',
                        'button:has-text("Close")',
                        'button:has-text("Fechar")',
                        '.close-button',
                        '#close-button',
                        'svg[class*="close" i]'
                    ]
                    for (const closeSel of closeButtons) {
                        if (page.isClosed()) break
                        const closeBtn = page.locator(closeSel).first()
                        if (await closeBtn.isVisible()) {
                            this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Closing details panel with: "${closeSel}"`)
                            await closeBtn.click().catch(() => {})
                            await this.bot.utils.wait(2000)
                            closed = true
                            break
                        }
                    }
                    if (!closed && !page.isClosed()) {
                        this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', 'No close button found, pressing Escape to close panel...')
                        await page.keyboard.press('Escape').catch(() => {})
                        await this.bot.utils.wait(2000)
                    }
                }
            }

            if (cardsFound === 0) {
                this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', 'No UI-based incomplete activities found.')
            }

        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'UI-EARN-ACTIVITIES',
                `Error in doUiEarnActivities: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    private async solveUiPromotionPanel(page: Page, sessionAttemptedSubtasks?: Set<string>) {
        this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', 'Processing details panel dynamically...')

        try {
            if (page.isClosed()) return

            // 1. Tentar primeiro clicar no botão de ativação da oferta se existir (detecção dinâmica via DOM)
            const activationTextFound: string | null = await page.evaluate(() => {
                const panel = document.querySelector('[role="dialog"], [aria-modal="true"], .drawer, .modal, [class*="drawer" i], [class*="modal" i]') || document.body
                const candidates = Array.from(panel.querySelectorAll('button, a, [role="button"], [data-rac], [data-react-aria-pressable="true"], .cursor-pointer, span, p'))
                
                const keywords = [
                    'ativar oferta', 'activate offer', 'ativar agora', 'activate now', 
                    'ativar', 'activate', 'participar', 'join', 'inscrever', 'register',
                    'iniciar', 'start', 'fazer check-in', 'fazer check in', 'check-in', 'check in'
                ]
                
                for (const el of candidates) {
                    const rect = el.getBoundingClientRect()
                    if (rect.width === 0 || rect.height === 0) continue
                    
                    const text = ((el as any).innerText || el.textContent || '').trim()
                    if (text.length < 3 || text.length > 80) continue
                    
                    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled')) continue
                    
                    const lowerText = text.toLowerCase()
                    
                    // Se o texto contém alguma das palavras-chave de ativação
                    if (keywords.some(kw => lowerText.includes(kw))) {
                        // Evitar botões de fechar ou termos comuns que possam conter "ativar"
                        const blacklist = ['fechar', 'close', 'termos', 'privacy', 'privacidade', 'voltar', 'back']
                        if (blacklist.some(word => lowerText.includes(word))) continue
                        
                        return text
                    }
                }
                return null
            })

            if (activationTextFound) {
                this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Found activation trigger "${activationTextFound}". Clicking...`)
                
                const selector = `text="${activationTextFound}"`
                const actButton = page.locator(selector).first()
                if (await actButton.isVisible()) {
                    const [newPage] = await Promise.all([
                        page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null),
                        actButton.click().catch(() => {})
                    ])

                    if (newPage) {
                        this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', 'Activation opened a new tab. Waiting...')
                        await this.bot.utils.wait(this.bot.utils.randomDelay(4000, 7000))
                        await newPage.close().catch(() => {})
                    } else {
                        await this.bot.utils.wait(3000)
                    }
                }
            }

            // 2. Loop de cliques iterativo e dinâmico para resolver tarefas pendentes
            let tasksSolved = 0
            const maxAttempts = 10
            // Use the session-wide set (shared across all parent cards) if provided,
            // otherwise fall back to a local set (avoids infinite loops within this panel).
            const attemptedTasks = sessionAttemptedSubtasks ?? new Set<string>() // evita re-clicar a mesma subtarefa em loop
            
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                if (page.isClosed()) return

                const currentUrl = page.url()
                if (!currentUrl.includes('rewards.bing.com/earn')) {
                    this.bot.logger.warn(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Page navigated away during subtask solving to "${currentUrl}". Navigating back to earn page...`)
                    await page.goto('https://rewards.bing.com/earn', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
                    await this.bot.utils.wait(3000)
                    break
                }

                // Varre o DOM para encontrar todos os textos de tarefas pendentes no painel lateral
                const pendingTaskTexts: string[] = await page.evaluate(() => {
                    const panel = document.querySelector('[role="dialog"], [aria-modal="true"], .drawer, .modal, [class*="drawer" i], [class*="modal" i]') || document.body
                    const candidates = Array.from(panel.querySelectorAll('button, a, [role="button"], [data-rac], [data-react-aria-pressable="true"], .cursor-pointer, [onclick], [class*="button" i]'))
                    
                    const texts: string[] = []
                    
                    for (const el of candidates) {
                        const rect = el.getBoundingClientRect()
                        if (rect.width === 0 || rect.height === 0) continue
                        
                        const fullText = ((el as any).innerText || el.textContent || '').trim()
                        if (fullText.length < 3) continue
                        
                        if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled')) continue
                        
                        const lowerFullText = fullText.toLowerCase()
                        
                        const blacklist = [
                            'fechar', 'close', 'cancelar', 'cancel', 'voltar', 'back',
                            'termos', 'terms', 'privacidade', 'privacy', 'suporte', 'support',
                            'ajuda', 'help', 'contrato', 'agreement', 'cookies', 'entendi', 'ok',
                            'ativar oferta', 'activate offer', 'ativar agora', 'activate now',
                            'dashboard', 'painel', 'painel de controle', 'home', 'início', 'inicio',
                            'earn', 'ganhar', 'buscas', 'search', 'pesquisas', 'searches',
                            'redeem', 'resgatar', 'about', 'sobre', 'refer and earn', 'indique e ganhe',
                            'indicações', 'referrals', 'faq', 'boas práticas', 'best practices',
                            'sitemap', 'mapa do site', 'order history', 'histórico de pedidos', 'historico de pedidos',
                            'feedback', 'microsoft rewards', 'pontos', 'points', 'como funciona', 'how it works',
                            'streak', 'streaks', 'série', 'séries', 'serie', 'series', 'sequência', 'sequencia', 'sequências', 'sequencias', 'racha', 'rachas', 'sequenza', 'sequenze',
                            'saiba mais', 'learn more', 'see more', 'find out more', 'saber más', 'saber mas',
                            'activity', 'activities', 'atividade', 'atividades', 'check-in', 'check in',
                            'accept', 'reject', 'aceitar', 'recusar', 'rejeitar', 'permitir', 'deny', 'allow',
                            'spotify'
                        ]
                        if (blacklist.some(word => lowerFullText.includes(word))) continue
                        
                        const completionWords = ['concluído', 'concluido', 'completed', 'resgatado', 'claimed', 'ganhou', 'won', 'parabéns', 'congratulations']
                        if (completionWords.some(word => lowerFullText.includes(word))) continue

                        // Se o texto tiver uma fração do tipo X/Y onde X >= Y, consideramos concluído
                        const fractionMatch = fullText.match(/(\d+)\s*\/\s*(\d+)/)
                        if (fractionMatch && fractionMatch[1] !== undefined && fractionMatch[2] !== undefined) {
                            if (parseInt(fractionMatch[1]) >= parseInt(fractionMatch[2])) {
                                continue
                            }
                        }

                        // Checar se há indicativos visuais de check no pai ou vizinhos
                        const parent = el.parentElement
                        if (parent) {
                            const parentHtml = parent.innerHTML.toLowerCase()
                            if (parentHtml.includes('check') || parentHtml.includes('completed') || parentHtml.includes('concluido')) {
                                continue
                            }
                        }

                        // Ignorar tarefas sob cooldown (ex: "wait 24 hours", "aguarde 24 horas")
                        let isCooldown = false
                        let checkParent = el.parentElement
                        let depth = 0
                        while (checkParent && depth < 4 && checkParent !== panel && checkParent.tagName !== 'BODY') {
                            const parentText = (checkParent.innerText || checkParent.textContent || '')
                            const parentTextLower = parentText.toLowerCase()
                            
                            const cooldownPatterns = [
                                'wait 24 hours',
                                'wait 24h',
                                'come back',
                                'aguarde 24 horas',
                                'aguarde 24h',
                                'volte amanhã',
                                'volte amanha',
                                'volte em 24',
                                'volte em 24h',
                                'volte em 24 horas',
                                'come back in'
                            ]
                            
                            if (cooldownPatterns.some(pat => parentTextLower.includes(pat))) {
                                isCooldown = true
                                break
                            }
                            checkParent = checkParent.parentElement
                            depth++
                        }
                        if (isCooldown) continue
                        
                        let text = fullText
                        if (text.includes('\n')) {
                            text = text.split('\n')[0].trim()
                        }

                        // Ignorar se o texto for puramente numérico (como pontuações "14,960", "+10", etc.)
                        if (/^[+\-]?[\d,.\s\/]+$/.test(text)) continue

                        if (text.length < 3 || text.length > 80) continue
                        
                        if (!texts.includes(text)) {
                            texts.push(text)
                        }
                    }
                    
                    return texts
                })

                this.bot.logger.debug(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Dynamic scan found ${pendingTaskTexts.length} pending task candidates: ${JSON.stringify(pendingTaskTexts)}`)

                if (pendingTaskTexts.length === 0) {
                    this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', 'No more pending tasks found in the details panel.')
                    break
                }

                // Filtra tarefas já tentadas nesta sessão para evitar loops infinitos
                const nextTask = pendingTaskTexts.find(t => !attemptedTasks.has(t))
                if (!nextTask) {
                    this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', 'All detected pending tasks have already been attempted this session. Stopping.')
                    break
                }

                const targetText = nextTask
                attemptedTasks.add(targetText)
                this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Solving subtask: "${targetText}"`)

                const taskLocator = page.locator(`text="${targetText}"`).first()
                if (await taskLocator.isVisible()) {
                    const [newPage] = await Promise.all([
                        page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null),
                        taskLocator.click({ timeout: 5000 }).catch(() => {})
                    ])

                    if (newPage) {
                        try {
                            // Aguarda a URL da nova aba carregar
                            await newPage.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {})
                            const newUrl = newPage.url()

                            // Se abriu uma página do Bing, faz uma busca real para registrar a atividade
                            if (newUrl.includes('bing.com') || newUrl.includes('msn.com')) {
                                this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Subtask "${targetText}" opened Bing tab. Performing real search to complete task...`)

                                // Carrega queries aleatórias do arquivo JSON
                                let searchQueries: string[] = ['how does the internet work', 'best productivity tips', 'weather forecast today']
                                try {
                                    const queriesPath = path.join(__dirname, 'search-queries.json')
                                    if (fs.existsSync(queriesPath)) {
                                        searchQueries = JSON.parse(fs.readFileSync(queriesPath, 'utf-8'))
                                    }
                                } catch { /* usa fallback */ }

                                const randomQuery = searchQueries[Math.floor(Math.random() * searchQueries.length)] ?? 'weather forecast today'
                                const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(randomQuery)}&FORM=ANNTA1`

                                await newPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {})
                                await this.bot.utils.wait(this.bot.utils.randomDelay(4000, 8000))

                                // Tenta interagir com a caixa de busca para simular busca manual
                                try {
                                    const searchBox = newPage.locator('#sb_form_q')
                                    if (await searchBox.isVisible()) {
                                        await searchBox.click()
                                        await searchBox.fill(randomQuery)
                                        await newPage.keyboard.press('Enter')
                                        await this.bot.utils.wait(this.bot.utils.randomDelay(3000, 6000))
                                    }
                                } catch { /* continua mesmo sem interação */ }

                                this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Bing search completed for subtask "${targetText}" | query="${randomQuery}"`)
                            } else {
                                this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Subtask "${targetText}" opened a new tab (${newUrl}). Waiting for activity to register...`)
                                await this.bot.utils.wait(this.bot.utils.randomDelay(6000, 12000))
                            }
                        } finally {
                            await newPage.close().catch(() => {})
                        }
                    } else {
                        this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Subtask "${targetText}" clicked. Waiting for transition...`)
                        await this.bot.utils.wait(this.bot.utils.randomDelay(4000, 8000))
                    }

                    tasksSolved++
                } else {
                    this.bot.logger.warn(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Task element with text "${targetText}" was no longer visible.`)
                    attemptedTasks.add(targetText) // marca como tentada mesmo assim
                }

                await this.bot.utils.wait(this.bot.utils.randomDelay(3000, 6000))
            }

            this.bot.logger.info(this.bot.isMobile, 'UI-EARN-ACTIVITIES', `Finished processing details panel. Solved ${tasksSolved} subtasks in this session.`)

        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'UI-EARN-ACTIVITIES',
                `Error inside solveUiPromotionPanel: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    public async dismissGetRewardsWelcome(page: Page) {
        if (page.isClosed()) return
        try {
            const welcomeTexts = [
                'get rewards now',
                'comece a ganhar agora',
                'obter rewards agora',
                'obter o rewards agora',
                'comenzar a ganar ahora',
                'obtener rewards ahora',
                'consigue rewards ahora',
                'obtén rewards ahora'
            ]

            let clicked = false
            for (let attempt = 0; attempt < 4; attempt++) {
                if (page.isClosed()) return

                clicked = await page.evaluate((texts) => {
                    const candidates = Array.from(document.querySelectorAll('button, a, span, div, p, [role="button"]'))
                    
                    // Phase 1: Exact match
                    for (const el of candidates) {
                        const rect = el.getBoundingClientRect()
                        if (rect.width === 0 || rect.height === 0) continue
                        
                        const text = (el.textContent || '').trim().toLowerCase()
                        if (texts.some(wt => text === wt)) {
                            let clickable: HTMLElement | null = el as HTMLElement
                            while (clickable && clickable.tagName !== 'BODY') {
                                const tag = clickable.tagName.toLowerCase()
                                if (tag === 'button' || tag === 'a' || clickable.getAttribute('role') === 'button' || clickable.classList.contains('cursor-pointer')) {
                                    break
                                }
                                clickable = clickable.parentElement
                            }
                            const target = clickable || el
                            ;(target as HTMLElement).click()
                            target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
                            return true
                        }
                    }

                    // Phase 2: Clickable elements with partial match (includes)
                    for (const el of candidates) {
                        const rect = el.getBoundingClientRect()
                        if (rect.width === 0 || rect.height === 0) continue
                        
                        const tag = el.tagName.toLowerCase()
                        const isClickable = tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button' || el.classList.contains('cursor-pointer')
                        if (!isClickable) continue

                        const text = (el.textContent || '').trim().toLowerCase()
                        if (texts.some(wt => text.includes(wt))) {
                            ;(el as HTMLElement).click()
                            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
                            return true
                        }
                    }
                    
                    return false
                }, welcomeTexts)

                if (clicked) {
                    this.bot.logger.info(this.bot.isMobile, 'WELCOME-SCREEN', 'Dismissed welcome/promo makeover screen successfully!')
                    await this.bot.utils.wait(3000)
                    break
                }

                await this.bot.utils.wait(500)
            }
        } catch (error) {
            this.bot.logger.debug(
                this.bot.isMobile,
                'WELCOME-SCREEN',
                `Error inside dismissGetRewardsWelcome: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    public async doExtensionActivities(page: Page) {
        this.bot.logger.info(this.bot.isMobile, 'EXTENSION-ACTIVITIES', 'Starting Microsoft Bing Extension activities...')

        try {
            if (page.isClosed()) return
            const context = page.context()
            const extPage = await context.newPage()

            const targetUrl = 'https://www.bing.com/rewards/panelflyout?partnerId=BrowserExtensions'
            this.bot.logger.info(this.bot.isMobile, 'EXTENSION-ACTIVITIES', `Navigating to extension flyout: ${targetUrl}`)
            
            await extPage.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(async (err) => {
                this.bot.logger.warn(this.bot.isMobile, 'EXTENSION-ACTIVITIES', `Initial load did not reach networkidle: ${err.message}. Retrying with load state...`)
                await extPage.goto(targetUrl, { waitUntil: 'load', timeout: 15000 }).catch(() => {})
            })

            await this.bot.utils.wait(5000)
            await this.dismissGetRewardsWelcome(extPage)

            // Scroll to bottom and top to ensure all lazy loaded cards are rendered
            await extPage.evaluate(async () => {
                window.scrollTo(0, document.body.scrollHeight)
                await new Promise(resolve => setTimeout(resolve, 1000))
                window.scrollTo(0, 0)
            })
            await this.bot.utils.wait(2000)

            // Only tracks hrefs that were confirmed completed (aria-label no longer contains "not completed")
            // This allows scan 2 to retry cards that were opened but points were not registered yet
            const completedHrefs = new Set<string>()

            for (let scan = 1; scan <= 2; scan++) {
                if (extPage.isClosed()) break

                // PRIMARY STRATEGY: use aria-label="... - Offer not Completed" on .promo_cont elements
                // This is the actual pattern the panelflyout page uses to mark pending tasks
                const cardsToClick = await extPage.evaluate(() => {
                    const targetLinks: { text: string, href: string }[] = []

                    // Find .promo_cont elements whose aria-label contains "Offer not Completed" (pending tasks)
                    const promoCont = Array.from(document.querySelectorAll('.promo_cont[aria-label]'))
                    for (const cont of promoCont) {
                        const ariaLabel = (cont.getAttribute('aria-label') || '').toLowerCase()
                        if (ariaLabel.includes('spotify')) continue
                        // Only pending items have "not completed" in aria-label
                        if (!ariaLabel.includes('offer not completed') && !ariaLabel.includes('oferta não concluída') && !ariaLabel.includes('not completed')) continue

                        const link = cont.querySelector('a[href]') as HTMLAnchorElement | null
                        if (!link) continue
                        const href = link.getAttribute('href') || ''
                        if (!href || href.startsWith('javascript') || href.startsWith('#')) continue

                        const hrefLower = href.toLowerCase()
                        // Skip non-task pages: mobile apps, referrals, redemptions, wallpapers, informational
                        if (
                            hrefLower.includes('spotify') ||
                            hrefLower.includes('bingapp.microsoft.com') ||
                            hrefLower.includes('adjust=') ||
                            hrefLower.includes('referandearn') ||
                            hrefLower.includes('refer-and-earn') ||
                            hrefLower.includes('/redeem/') ||
                            hrefLower.includes('wallpaper/themes') ||
                            hrefLower.includes('form=rwse') ||
                            hrefLower.includes('bing.com/?form=') ||
                            hrefLower.includes('microsoft.com/store')
                        ) continue

                        const displayText = (cont.getAttribute('aria-label') || link.textContent || 'Flyout Task')
                            .replace(/\s*-\s*(offer not completed|oferta não concluída|not completed)/i, '').trim()
                            .replace(/\n/g, ' ').substring(0, 100)

                        if (!targetLinks.some(t => t.href === href)) {
                            targetLinks.push({ text: displayText, href })
                        }
                    }

                    return targetLinks
                })

                // Filter out cards confirmed completed in a previous scan.
                // Cards that were opened but still pending (points not registered) will be retried.
                const newCards = cardsToClick.filter(c => !completedHrefs.has(c.href))

                this.bot.logger.info(this.bot.isMobile, 'EXTENSION-ACTIVITIES', `Scan ${scan}: Found ${cardsToClick.length} pending extension cards (${newCards.length} not yet confirmed complete).`)
                if (newCards.length === 0) {
                    this.bot.logger.info(this.bot.isMobile, 'EXTENSION-ACTIVITIES', 'All cards confirmed complete. Stopping scan.')
                    break
                }

                for (const card of newCards) {
                    if (extPage.isClosed()) break

                    this.bot.logger.info(this.bot.isMobile, 'EXTENSION-ACTIVITIES', `Clicking card directly in flyout: "${card.text}"`)

                    try {
                        // Strategy: click the <a> link inside the .promo_cont directly within the flyout page.
                        // The flyout has JS event handlers on these links that register the reward with Bing's servers.
                        // Opening the URL in a new tab bypasses these handlers — clicking in-page does not.
                        // The link has target="_top", so it navigates extPage itself to the task URL.
                        const clicked = await extPage.evaluate((href: string) => {
                            const conts = Array.from(document.querySelectorAll('.promo_cont[aria-label]'))
                            for (const cont of conts) {
                                const link = cont.querySelector('a[href]') as HTMLAnchorElement | null
                                if (!link) continue
                                const linkHref = link.getAttribute('href') || ''
                                // Match by href (partial, ignoring rnoreward param differences)
                                const normalize = (u: string) => u.replace(/[?&]rnoreward=1/g, '').replace(/&&/g, '&')
                                if (normalize(linkHref).includes(normalize(href).substring(0, 60))) {
                                    link.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
                                    link.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
                                    link.click()
                                    return true
                                }
                            }
                            return false
                        }, card.href)

                        if (!clicked) {
                            this.bot.logger.warn(this.bot.isMobile, 'EXTENSION-ACTIVITIES', `Could not find link in flyout for "${card.text}", falling back to direct navigation...`)
                            // Fallback: navigate directly but with rnoreward removed
                            let fullUrl = card.href.startsWith('/') ? 'https://www.bing.com' + card.href : card.href
                            try {
                                const urlObj = new URL(fullUrl)
                                urlObj.searchParams.delete('rnoreward')
                                fullUrl = urlObj.toString()
                            } catch { /* keep original */ }
                            await extPage.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
                        } else {
                            // Wait for the click to trigger navigation
                            await extPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
                        }

                        await this.bot.utils.wait(3000)

                        const currentUrl = extPage.url()
                        if (currentUrl.includes('imagepuzzle')) {
                            this.bot.logger.info(this.bot.isMobile, 'EXTENSION-ACTIVITIES', 'Image puzzle page detected. Attempting to skip/ignore...')
                            await extPage.waitForTimeout(2000)
                            const clickedSkip = await extPage.evaluate(() => {
                                const elList = Array.from(document.querySelectorAll('button, a, div, span'))
                                for (const el of elList) {
                                    const text = (el.textContent || '').trim().toLowerCase()
                                    if (text.includes('ignorar quebra-cabeça') || text.includes('ignore puzzle') || text.includes('skip puzzle') || text.includes('ignorar quebra cabeça') || text.includes('ignorar') || text.includes('skip')) {
                                        (el as HTMLElement).click()
                                        return text
                                    }
                                }
                                return null
                            })
                            if (clickedSkip) {
                                this.bot.logger.info(this.bot.isMobile, 'EXTENSION-ACTIVITIES', `Skipped puzzle: "${clickedSkip}"`)
                            }
                            await extPage.waitForTimeout(5000)
                        } else {
                            this.bot.logger.info(this.bot.isMobile, 'EXTENSION-ACTIVITIES', `Task page loaded. Waiting to register points...`)
                            await this.bot.utils.wait(this.bot.utils.randomDelay(8000, 12000))
                        }

                    } catch (err) {
                        this.bot.logger.error(
                            this.bot.isMobile,
                            'EXTENSION-ACTIVITIES',
                            `Error clicking card "${card.text}": ${err instanceof Error ? err.message : String(err)}`
                        )
                    }

                    // Navigate back to flyout for the next card
                    if (!extPage.isClosed()) {
                        const flyoutUrl = 'https://www.bing.com/rewards/panelflyout?partnerId=BrowserExtensions'
                        this.bot.logger.info(this.bot.isMobile, 'EXTENSION-ACTIVITIES', 'Returning to flyout for next card...')
                        await extPage.goto(flyoutUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
                        await this.bot.utils.wait(this.bot.utils.randomDelay(3000, 5000))
                    }
                }

                // After processing all cards in this scan, reload the flyout and check which hrefs
                // are now confirmed completed — those will be excluded from subsequent scans.
                if (!extPage.isClosed()) {
                    this.bot.logger.info(this.bot.isMobile, 'EXTENSION-ACTIVITIES', `Scan ${scan} done. Reloading flyout to confirm completion status...`)
                    await extPage.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
                    await this.bot.utils.wait(4000)

                    // Collect hrefs that are now marked as completed (aria-label no longer says "not completed")
                    const nowCompletedHrefs = await extPage.evaluate(() => {
                        const allLinks: string[] = []
                        const completedConts = Array.from(document.querySelectorAll('.promo_cont[aria-label]'))
                        for (const cont of completedConts) {
                            const ariaLabel = (cont.getAttribute('aria-label') || '').toLowerCase()
                            // A completed card does NOT have "not completed" in its aria-label
                            if (
                                ariaLabel.includes('offer not completed') ||
                                ariaLabel.includes('oferta não concluída') ||
                                ariaLabel.includes('not completed')
                            ) continue
                            const link = cont.querySelector('a[href]') as HTMLAnchorElement | null
                            if (link) allLinks.push(link.getAttribute('href') || '')
                        }
                        return allLinks
                    })

                    for (const href of nowCompletedHrefs) {
                        if (href) completedHrefs.add(href)
                    }
                    this.bot.logger.info(this.bot.isMobile, 'EXTENSION-ACTIVITIES', `Confirmed ${nowCompletedHrefs.length} completed hrefs after scan ${scan}.`)
                }

                // Announce start of next scan if applicable
                if (scan < 2 && !extPage.isClosed()) {
                    this.bot.logger.info(this.bot.isMobile, 'EXTENSION-ACTIVITIES', 'Starting second scan to verify remaining pending cards...')
                }
            }

            await extPage.close().catch(() => {})
            this.bot.logger.info(this.bot.isMobile, 'EXTENSION-ACTIVITIES', 'Finished Microsoft Bing Extension activities successfully!')

        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'EXTENSION-ACTIVITIES',
                `Error in doExtensionActivities: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }
}
