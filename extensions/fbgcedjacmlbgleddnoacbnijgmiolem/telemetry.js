import { CHANNEL, DPC, LP_MARKET, MACHINE_ID, MARKET, PARTNER_CODE, BCEX, DEFAULT_PARTNER_CODE, DEFAULT_CHANNEL } from './global.js';

const INSTRUMENTATION_KEY = 'instrumentationKey';
const INSTRUMENTATION_FRESH_TIME = 'instrumentationFreshTime';
const INSTRUMENTATION_EXPIRE_DAY = 7;
const REWARD_GIFT_CARD_FREE_MINUTES = 'rewardGiftCardFreeMinutes';
const REWARD_GIFT_CARD_FREE_MINUTES_FRESH_TIME = 'rewardGiftCardFreeMinutesFreshTime';
const REWARD_GIFT_CARD_FREE_MINUTES_EXPIRE_DAY = 1;
const EXTENSION_ID = chrome.runtime.id;
const EXTENSION_NAME = chrome.runtime.getManifest().name.replace(/ /g, "").replace(/&/g, 'and');
const EXTENSION_VERSION = chrome.runtime.getManifest().version;

function getInstrumentationKey() {
    var falconURL = "https://services.bingapis.com/ge-apps/api/Extension/getConfig?extensionId=" + EXTENSION_ID;
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([INSTRUMENTATION_KEY, INSTRUMENTATION_FRESH_TIME], (items) => {
        if(!items[INSTRUMENTATION_KEY] || !items[INSTRUMENTATION_FRESH_TIME] || (items[INSTRUMENTATION_KEY] && items[INSTRUMENTATION_FRESH_TIME] && ((new Date() - new Date(items[INSTRUMENTATION_FRESH_TIME])) / (1000 * 60 * 60 * 24)) > INSTRUMENTATION_EXPIRE_DAY)) {
            fetch(falconURL)
            .then(response => response.ok ? response.json() : reject()) 
            .then(data => {
                chrome.storage.local.set({ 
                    [INSTRUMENTATION_KEY] : data.instrumentationKey,
                    [INSTRUMENTATION_FRESH_TIME] : new Date().toDateString()
                });
                resolve(data.instrumentationKey);
            })
            .catch(error => {
                reject(error);
            });
        }
        else {
            return resolve(items[INSTRUMENTATION_KEY])
        }   
        });
    });
}

function getConfig() {
    var falconURL = "https://services.bingapis.com/ge-apps/api/Extension/getConfig?extensionId=" + EXTENSION_ID;
    return new Promise((resolve, reject) => {
        fetch(falconURL)
        .then(response => response.ok ? response.json() : reject()) 
        .then(data => {
            let extensionConfigJson;
            try {
                extensionConfigJson = JSON.parse(data.extensionConfigJson);
                if (extensionConfigJson) {
                    resolve(extensionConfigJson);
                } else {
                    reject('No extensionConfigJson found in config');
                }
            } catch (error) {
                reject('Failed to parse extensionConfigJson');
            }
        })
        .catch(error => {
            reject(error);
        });
    });
}

export function getRewardGiftCardFreeMinutes() {
    
    return new Promise((resolve, reject) => {
        chrome.storage.local.get([REWARD_GIFT_CARD_FREE_MINUTES, REWARD_GIFT_CARD_FREE_MINUTES_FRESH_TIME], (items) => {
        if(!items[REWARD_GIFT_CARD_FREE_MINUTES] || !items[REWARD_GIFT_CARD_FREE_MINUTES_FRESH_TIME] || (items[REWARD_GIFT_CARD_FREE_MINUTES] && items[REWARD_GIFT_CARD_FREE_MINUTES_FRESH_TIME] && ((new Date() - new Date(items[REWARD_GIFT_CARD_FREE_MINUTES_FRESH_TIME])) / (1000 * 60 * 60 * 24)) > REWARD_GIFT_CARD_FREE_MINUTES_EXPIRE_DAY)) {
            getConfig()
            .then(config => {
                let rewardGiftCardFreeMinutes = config.rewardGiftCardFreeMinutes;
                if (rewardGiftCardFreeMinutes) {
                    chrome.storage.local.set({ 
                        [REWARD_GIFT_CARD_FREE_MINUTES] : rewardGiftCardFreeMinutes,
                        [REWARD_GIFT_CARD_FREE_MINUTES_FRESH_TIME] : new Date().toUTCString()
                    });
                    resolve(rewardGiftCardFreeMinutes);
                } else {
                    reject('No rewardGiftCardFreeMinutes found in config');
                }
            })
            .catch(error => {
                reject(error);
            });
        }
        else {
            return resolve(items[REWARD_GIFT_CARD_FREE_MINUTES])
        } 
        });  
    });
}

export function sendTelemetryData(type, data) {
    getInstrumentationKey()
    .then(instrumentationKey =>
    {
        var telemetryURL = "https://dc.services.visualstudio.com/v2/track";
        var browser = getBrowser();
        var browserVersion = navigator.userAgent.substr(navigator.userAgent.indexOf("Chrome")).split(" ")[0].replace("/", "");
        var OS = operatingSystemVersion();
        
        chrome.storage.local.get([PARTNER_CODE, CHANNEL, MACHINE_ID, DPC, LP_MARKET, MARKET, BCEX], (items) => {

            var mkt = (items[LP_MARKET]) ? items[LP_MARKET] : items[MARKET];
            if (!mkt) {
                mkt = navigator.language;
            }
            var result = JSON.stringify(
            {
                iKey : instrumentationKey,
                name : "Microsoft.ApplicationInsights.Event",
                time : new Date().toISOString(),
                data :
                {
                    baseData :
                    {
                        name : "BrowserExtension",
                        properties : {
                            type : type,
                            machineId : items[MACHINE_ID],
                            extensionId : EXTENSION_ID,
                            extensionName : EXTENSION_NAME,
                            extensionVersion : EXTENSION_VERSION,
                            os : OS,
                            browser : browser,
                            browserVersion : browserVersion,
                            partnerCode : !items[PARTNER_CODE] ? DEFAULT_PARTNER_CODE : items[PARTNER_CODE],
                            channel : items[CHANNEL] ? items[CHANNEL] : DEFAULT_CHANNEL,
                            dpc: items[DPC] ? items[DPC] : "",
                            market : items[MARKET] ? items[MARKET] : "",
                            mkt: mkt,
                            language : items[MARKET] ? items[MARKET] : navigator.language,
                            lpMarket : items[LP_MARKET] ? items[LP_MARKET] : "",
                            bcex : items[BCEX] ? items[BCEX] : "",
                            ...(data || {})
                        },
                    },
                    baseType : "EventData"
                }
            });

            fetch(telemetryURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'X-Api-Key': instrumentationKey
                },
                body: result
            })
            .then(response => {
                if (response.ok) {
                    
                } else {
                    console.log(response);
                }
            })
            .catch(error => {
                console.log(error);
            });
        });
    })
    .catch(reason => {
        console.log(reason);
    });
}


function operatingSystemVersion() {
    var userAgent = navigator.userAgent;
    var OSVersion = "Other";
    if (userAgent.indexOf("Windows NT 10.0") != -1) {
        OSVersion = "10";
    }
    else if (userAgent.indexOf("Windows NT 6.3") != -1) {
        OSVersion = "8.1";
    }
    else if (userAgent.indexOf("Windows NT 6.2") != -1) {
        OSVersion = "8";
    }
    else if (userAgent.indexOf("Windows NT 6.1") != -1) {
        OSVersion = "7";
    }
    else if (userAgent.indexOf("MAC") != -1) {
        if (userAgent.indexOf("LIKE MAC") != -1) {
            OSVersion = "iOS";
        }
        else {
            OSVersion = "Mac";
        }
    }

    return OSVersion;
}

function getBrowser() {
    var bn;
    var userAgent = navigator.userAgent;
    if (userAgent.indexOf("Edg") != -1) {
        bn = "Edge";
    }
    //IE10
    else if (userAgent.indexOf("MSIE") != -1) {
        bn = "IE";
    }
    else if (userAgent.indexOf("Trident") != -1) {
        bn = "IE";
    }
    else if (userAgent.indexOf("Chrome") != -1) {
        bn = "Chrome";
    }
    else if (userAgent.indexOf("Firefox") != -1) {
        bn = "Firefox";
    }
    else {
        bn = "Others";
    }
    return bn;
}

