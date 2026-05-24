import { CHANNEL, DPC, LP_MARKET, MACHINE_ID, MARKET, PARTNER_CODE, BCEX, TELEMETRY_TYPE, DEFAULT_PARTNER_CODE, GET_USERINFO_URL, GIFT_CARD_POPUP_TIME, ANID } from './global.js';
import { getRewardGiftCardFreeMinutes, sendTelemetryData } from './telemetry.js';

const BLOCKING_URL_FBG = "*://*.bing.com/search?FORM=U523MF&PC=U523*";
const RWBFCOOKIE_ALARM = 'RwbfCookieAlarm';
var rwbfCookieAlarmPeriodInMins = 1440; // 24 hours
var DAILY_PING_ALARM = "FBG_DAILYPINGALARM";
var dailyPingAlarmPeriodInMins = 1440; // 24 hours

var manifestData = chrome.runtime.getManifest();
var ExtensionVersion = manifestData.version;
var bingUrl = "https://www.bing.com/";
var defaultPC = DEFAULT_PARTNER_CODE;
var chromeWS = "https://chrome.google.com/";
var browserDefaultsUrl = "https://browserdefaults.microsoft.com/";
var browserDefaultsUrl_china = "https://browserdefaults.chinacloudsites.cn/";

var FeedbackFwlink = "https://go.microsoft.com/fwlink/?linkid=2138838";
var ExtensionId = chrome.runtime.id;
var extensionUrl = "chrome-extension://" + ExtensionId;

var market = "";
try {
    market = chrome.i18n.getMessage("ExtnLanguage");
}
catch (exception) {
    market = navigator.language.toLocaleLowerCase();
}

var PING_ALARM = "FBG_PINGALARM";
let getPingAlarm = chrome.alarms.get(PING_ALARM);
getPingAlarm.then(fbgPingAlarm);

function fbgPingAlarm(alarm) {
    if (!alarm) {
        chrome.alarms.create(PING_ALARM, {
            delayInMinutes: 1
        });
    }
}

//Sets '_DPC' & '_NTPC' session cookie in bing.com domain whenever background.js gets executed
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === PING_ALARM) {
        chrome.storage.local.get([MACHINE_ID, "ExtensionUpdated", "updatePingSent", DPC, PARTNER_CODE], (items) => {
            var _dpc = items[DPC];
            if (_dpc != undefined && _dpc != "" && _dpc != null) {
                chrome.cookies.set({ url: bingUrl, domain: '.bing.com', name: '_DPC', value: _dpc }, function (cookie) {
                });
            }
            chrome.cookies.set({ url: bingUrl, domain: '.bing.com', name: '_NTPC', value: !items[PARTNER_CODE] ? defaultPC : items[PARTNER_CODE] }, function (cookie) {
            });

            if (items.ExtensionUpdated == "true" && items.updatePingSent == "false") {
                chrome.storage.local.set({
                    "updatePingSent": "true",
                    "ExtensionUpdated": "false"
                });
                //Call for Update Ping
                sendTelemetryData(TELEMETRY_TYPE.PING, { status:"3" });
            }

            //To redirect feedback page while uninstalling the extension
            var uninstallUrl = FeedbackFwlink + "&extnID=" + ExtensionId + "&mkt=" + market + "&mid=" + items[MACHINE_ID] + "&br=gc";
            chrome.runtime.setUninstallURL(uninstallUrl);
            //set BCEX Cookie
            setBCEXCookie();

            //Redirect Searches with dynamic PC
            addSearchRedirectRule(1, items[PARTNER_CODE], defaultPC, BLOCKING_URL_FBG);
        });
    }
});


chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason == 'install') {
        //Sets the default pc of the extension in chrome storage
        var promise = new Promise((resolve, reject) => {
            chrome.storage.local.set({
                ["MigratedLocalStorage"]: true,
                ["ExtnVersion"]: ExtensionVersion
            });
            resolve("organic");
        });
        promise
            .then(() => {
                var machineId = guid();
                getBrowserDefaultCookieAndUpdateLocalStorageValues("installEvent", machineId, "");
            });

        chrome.alarms.clear(RWBFCOOKIE_ALARM);
        chrome.alarms.create(RWBFCOOKIE_ALARM, {
            delayInMinutes: 1,
            periodInMinutes: rwbfCookieAlarmPeriodInMins
        });
        chrome.alarms.clear(DAILY_PING_ALARM);
        chrome.alarms.create(DAILY_PING_ALARM, {
            delayInMinutes: 1,
            periodInMinutes: dailyPingAlarmPeriodInMins
        });
    }
    else if (details.reason == 'update') {
        chrome.storage.local.set({
            "updatePingSent": "false",
            "ExtensionUpdated": "true",
            showFirstSearchNotification: false
        });

        chrome.storage.local.get(["ExtnVersion", "MigratedLocalStorage", "isNotifEnabled", "ExtensionUpdatepageshown", CHANNEL, DPC, PARTNER_CODE], function (items) {

            if (!items.ExtnVersion || items.ExtnVersion != chrome.runtime.getManifest().version) {

                chrome.storage.local.set({ "ExtnVersion": ExtensionVersion });
                if (!items.MigratedLocalStorage && !items.ExtensionUpdatepageshown) {
                    var lastNotifDisplayedDate_Inactiveuser = new Date().toUTCString();
                    chrome.storage.local.set({ "lastNotifDispDate": lastNotifDisplayedDate_Inactiveuser });
                    showhtmlpage();
                }
                else {
                    // Update the Channel details in DPC Values
                    if (!items[CHANNEL]) {
                        chrome.storage.local.set({ CHANNEL: "organic" });
                    }

                    if (!items[DPC]) {
                        chrome.storage.local.set({ DPC: items[CHANNEL] });
                    }
                    else {
                        if (items[DPC].indexOf('_') === -1 && items[DPC] !== items[CHANNEL]) {
                            items[DPC] = items[DPC] + "_" + items[CHANNEL];
                        }
                        else {
                            // Nothing to udpate 
                        }
                    }
                }
                if (items.MigratedLocalStorage && !items.isNotifEnabled) {
                    chrome.storage.local.set({ "isNotifEnabled": true });
                }
                addSearchRedirectRule(1, items[PARTNER_CODE], defaultPC, BLOCKING_URL_FBG);
            }
        });

        chrome.alarms.clear(RWBFCOOKIE_ALARM);
        chrome.alarms.create(RWBFCOOKIE_ALARM, {
            delayInMinutes: 1,
            periodInMinutes: rwbfCookieAlarmPeriodInMins
        });
        chrome.alarms.clear(DAILY_PING_ALARM);
        chrome.alarms.create(DAILY_PING_ALARM, {
            delayInMinutes: 1,
            periodInMinutes: dailyPingAlarmPeriodInMins
        });
    }

});

function setBCEXCookie() {
    var promise = new Promise((resolve) => {
        if (market == "zh-cn") {
            chrome.storage.local.set(
                {
                    [BCEX]: "0",
                },
                () => {
                    resolve([BCEX]);
                },
            );
        }
        else {
            resolve([BCEX]);
        }
    });
    promise.then(() => {
        chrome.storage.local.get(([BCEX]), (items) => {
            var bcex = items[BCEX] ? items[BCEX] : "1";
            if (bcex != undefined && bcex != "" && bcex != null) {
                var SSValue = "";
                chrome.cookies.get({ url: bingUrl, name: '_SS' }, function (cookie) {
                    if (cookie) {
                        SSValue = removeBCEXParameterFromCookie(cookie.value) + "&BCEX=" + bcex;
                        chrome.cookies.set({ url: bingUrl, domain: '.bing.com', name: '_SS', value: SSValue, sameSite: 'no_restriction', secure: true }, function (cookie) {
                        });
                    }
                });
            }
        });
    });
}

function removeBCEXParameterFromCookie(cookieValue) {
    let result = cookieValue.split("&").filter((x)=> !x.startsWith("BCEX=")).join("&");
    return result;
}

export function getBrowserDefaultCookieAndUpdateLocalStorageValues(eventID, machineId, fsnURL) {
    // Fetching Machine Id, Partner Code, DPC and Channel details from browserdefaults.microsoft.com
    chrome.cookies.get({ url: browserDefaultsUrl, name: chrome.runtime.id }, function (cookie) {
        if (cookie) {
            setExtensionStorageValues(cookie, eventID, machineId, fsnURL);
        }
        else {
            chrome.cookies.get({ url: browserDefaultsUrl_china, name: chrome.runtime.id }, function (cookie) {
                setExtensionStorageValues(cookie, eventID, machineId, fsnURL);
            });
        }
    });
}

function setExtensionStorageValues(cookie, eventID, machineId, fsnURL) {
    readingCookiesAndUpdateChromeStorageValues(cookie, machineId)
        .then((detailsObj) => {
            if (eventID === "installEvent") {
                afterCookieLogicExecution(detailsObj);
                chrome.storage.local.get([PARTNER_CODE], (items) => {
                    addSearchRedirectRule(1, items[PARTNER_CODE], defaultPC, BLOCKING_URL_FBG);
                });
            }
            else if (eventID == "fsnEvent") {

                //check registry scenario
                if (fsnURL.indexOf("DPC=U523") != -1) {
                    let params = new URLSearchParams(fsnURL);
                    chrome.storage.local.set({ PartnerCode: params.get("PC") });
                }
                sendTelemetryData(TELEMETRY_TYPE.FSN, { currenturl : fsnURL});
                chrome.cookies.remove({ url: chromeWS, name: '__utmz' });
                chrome.cookies.remove({ url: browserDefaultsUrl, name: chrome.runtime.id });
                chrome.cookies.remove({ url: browserDefaultsUrl_china, name: chrome.runtime.id });
            }
        });
}
function readingCookiesAndUpdateChromeStorageValues(cookie, machineId) {
    return new Promise((resolve) => {
        var details = {
            machineId: machineId,
            pc: '',
            channel: 'organic',
            dpc: ''
        };

        if (cookie) {
            var cookieValue = String(cookie.value).split('&');
            for (var i = 0; i < cookieValue.length; i++) {

                var cookieData = cookieValue[i].split('=');

                if (cookieData[0].toLocaleUpperCase() == "MI") {
                    details.machineId = cookieData[1];
                }
                else if (cookieData[0].toLocaleUpperCase() == "CH") {
                    details.channel = cookieData[1];
                }
                else if (cookieData[0].toLocaleUpperCase() == "PC") {
                    details.pc = cookieData[1];
                }
                else if (cookieData[0].toLocaleUpperCase() == "BM") {
                    details.bmkt = cookieData[1];
                }
                else if (cookieData[0].toLocaleUpperCase() == "LPMKT") {
                    details.iLPMarket = cookieData[1];
                }
                else if (cookieData[0].toLocaleUpperCase() == "BCEX") {
                    details.iBCEX = cookieData[1];
                }
            }
        }

        if (details.channel == "organic") {
            // Fetching  __utmz cookie value from https://chrome.google.com/
            chrome.cookies.get({ url: chromeWS, name: '__utmz' }, function (cookie) {

                if (cookie) {
                    var chromeWSChannel = getChromeWSChannel(cookie.value);
                    if (chromeWSChannel != "") {
                        details.channel = chromeWSChannel;
                    }
                }
            });
        }

        getValuesinChromeStorage(details)
            .then((details) => {
                chrome.storage.local.set(
                    {
                        [MACHINE_ID]: details.machineId,
                        [PARTNER_CODE]: details.pc,
                        [CHANNEL]: details.channel,
                        [MARKET]: details.bmkt,
                        [DPC]: details.dpc,
                        [LP_MARKET]: details.iLPMarket,
                        [BCEX]: details.iBCEX
                    },
                    () => {
                        setBCEXCookie();
                        resolve(details);
                    },
                );
            });
    });
}

function getValuesinChromeStorage(details) {
    return new Promise((resolve) => {
        chrome.storage.local.get([PARTNER_CODE, DPC], (items) => {
            if (details.pc) {
                details.pc = details.pc;
                details.dpc = details.pc + '_' + details.channel;
                resolve(details);
            }
            else {
                if (!items[PARTNER_CODE]) {
                    details.pc = defaultPC;
                }
                else {
                    details.pc = items[PARTNER_CODE];
                }

                if (!items[DPC]) {
                    details.dpc = details.channel;
                }
                else {
                    details.dpc = items[DPC];
                }
                resolve(details);
            }
        });
    });
}

function afterCookieLogicExecution(detailsObj) {
    sendTelemetryData(TELEMETRY_TYPE.PING, { status:"1" });
    chrome.cookies.set({ url: bingUrl, domain: '.bing.com', name: '_DPC', value: detailsObj.dpc }, function (cookie) {
    });

    if (detailsObj.channel.includes("bgads_fb_")) {
        var welcomePageFwdlink = "https://go.microsoft.com/fwlink/?linkid=2241056&xid=106&trackingid=" + chrome.runtime.id + "&partnercode=" + detailsObj.pc + "&browser=gc&bmkt=" + market;
        if (detailsObj.channel) {
            welcomePageFwdlink += "&channel=" + detailsObj.channel;
        }
        chrome.tabs.create({ url: welcomePageFwdlink });
    }
    var redirectionURL = "https://go.microsoft.com/fwlink/?linkid=2128904&trackingid=" + chrome.runtime.id + "&partnercode=" + detailsObj.pc + "&browser=gc";

    if (detailsObj.iLPMarket) {
        redirectionURL += "&mkt=" + detailsObj.iLPMarket;
    }
    else {
        redirectionURL += "&mkt=" + market;
    }

    if (detailsObj.channel) {
        redirectionURL += "&channel=" + detailsObj.channel;
    }

    if (detailsObj.machineId) {
        redirectionURL += "&machineid=" + detailsObj.machineId;
    }
    chrome.tabs.create({ url: redirectionURL });

    var mktFre = (detailsObj.iLPMarket) ? detailsObj.iLPMarket : detailsObj.bmkt;
    if (!mktFre) {
        mktFre = navigator.language;
    }
	
	sendTelemetryData(TELEMETRY_TYPE.INSTALL, { partnerCode : detailsObj.pc, mkt : mktFre, channel : detailsObj.channel, machineId : detailsObj.machineId, currenturl : extensionUrl});
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === DAILY_PING_ALARM) {
        chrome.storage.local.get(['showFirstSearchNotification', MACHINE_ID], (items) => {
            if (items.showFirstSearchNotification == undefined) {
                getBrowserDefaultCookieAndUpdateLocalStorageValues("dailyPingEvent", items[MACHINE_ID], "");
                sendTelemetryData(TELEMETRY_TYPE.PING, { status:"2" });
            }
            else {
                sendTelemetryData(TELEMETRY_TYPE.PING, { status:"2" });
            }
        });
    }
});

function showhtmlpage() {
    chrome.tabs.create({ url: "/Welcomepage/index.html?xid=106&bmkt=" + market });
    chrome.storage.local.set({ "ExtensionUpdatepageshown": "True" });
}

/* Function to create an unique machine id */
function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    var MachineGUID = s4() + s4() + s4() + s4() + s4() + s4() + s4() + s4();
    MachineGUID = MachineGUID.toLocaleUpperCase();
    chrome.storage.local.set({
        [MACHINE_ID]: MachineGUID
    });
    return MachineGUID;
}

var MUID = "";
chrome.cookies.get({ url: bingUrl, name: 'MUID' }, function (cookie) {
    if (cookie && cookie.value != "" && cookie.value != null) {
        MUID = cookie.value;
    }
});

function getChromeWSChannel(cookieValue) {

    // Sample Chrome Webstore PaidAds cookie Value: 73091649.1608191832.10.6.utmcsr=bgads|utmccn=rwdsus|utmcmd=(not%20set)
    //Cookie value: 73091649.1614306380.141.5.utmcsr=bgads|utmccn=rwdsus|utmcmd=rwdmed|utmcct=rwdcon
    //DPC: source_medium_campaign_content (bgads_rwdmed_rwdsus_rwdcon)
    var strSource = "";
    var strCampaign = "";
    var strMedium = "";
    var strContent = "";
    var strWSChannel = "";
    var strPC = "";
    var splitStr = cookieValue.split(".");

    if (splitStr[splitStr.length - 1] != "") {
        var utmValues = splitStr[splitStr.length - 1].split("|");

        for (i = 0; i < utmValues.length; i++) {
            var utmValue = utmValues[i].split("=");
            if (utmValue[0] == "utmcsr") {
                strSource = utmValue[1];
            }
            else if (utmValue[0] == "utmccn") {
                strCampaign = utmValue[1];
            }
            else if (utmValue[0] == "utmcmd") {
                strMedium = utmValue[1];
            }
            else if (utmValue[0] == "utmcct") {
                strContent = utmValue[1];
            }
        }

        // To check if source parameter is not null or empty
        if (strSource != "(not%20set)" && strSource != "(direct)" && strSource != "(organic)" && strSource != "support.microsoft.com" && strSource != "browserdefaults.microsoft.com") {
            strWSChannel = strSource;

        }

        // To check if medium parameter is not null or empty
        if (strMedium != "(not%20set)" && strMedium != "(direct)" && strMedium != "(organic)" && strMedium != "referral" && strMedium != "none") {
            strWSChannel = strWSChannel + "_" + strMedium;

        }

        // To check if campaign parameter is not null or empty
        if (strCampaign != "(not%20set)" && strCampaign != "(direct)" && strCampaign != "(organic)" & strCampaign != "(referral)") {
            strWSChannel = strWSChannel + "_" + strCampaign;

        }

        // To check if content parameter is not null or empty. Fetch pc value from content parameter

        if (strContent != "(not%20set)" && strContent != "(direct)" && strContent != "(organic)" && strContent != "" && strContent != "/") {
            if (strContent.indexOf("-") > -1) {
                var splitStrCon = strContent.split("-");

                defaultPC = splitStrCon[1].substring(2);
                strContent = splitStrCon[0];
                strWSChannel = strWSChannel + "_" + strContent;


            }
            else {
                strWSChannel = strWSChannel + "_" + strContent;

            }

        }

        return strWSChannel;
    }
}

chrome.runtime.onMessage.addListener(function (msg) {
    if (msg == "setMachineID") {
        chrome.storage.local.get([MACHINE_ID], (items) => {
            chrome.cookies.set({ url: browserDefaultsUrl, domain: '.browserdefaults.microsoft.com', name: 'MachineID', value: items[MACHINE_ID], sameSite: 'no_restriction', secure: true }, function (cookie) {

            });
        })
    }
});

function addSearchRedirectRule(redirectRuleId, partnerCode, defaultPartnerCode, blockingURL) {
    if (partnerCode || defaultPartnerCode) {
        var rulesToAdd = [];

        var searchRedirectRule =
        {
            id: 1,
            priority: 1,
            action: {
                type: "redirect",
                redirect: {
                    transform: {
                        queryTransform: {
                            addOrReplaceParams: [
                                {
                                    key: "FORM",
                                    value: "U523DF"
                                },
                                {
                                    key: "PC",
                                    value: partnerCode ? partnerCode : "U523"
                                }
                            ]
                        }
                    }
                }
            },
            condition: {
                urlFilter: blockingURL,
                resourceTypes: ["main_frame"]
            }
        };
        rulesToAdd.push(searchRedirectRule);

        chrome.declarativeNetRequest.updateDynamicRules({
            addRules: rulesToAdd,
            removeRuleIds: [redirectRuleId]
        });
    }
}

function removegcParameterFromCookie(cookieValue) {

    let result;
    result = cookieValue.split("&").filter((x) => !x.startsWith("gc=")).join("&");
    return result;
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === RWBFCOOKIE_ALARM) {
        var inputDate = new Date();
        var _RwBfValue = "";
        var gc = inputDate.toISOString();
        chrome.cookies.get({ url: bingUrl, name: '_RwBf' }, function (cookie) {
            if (cookie && cookie.value != "" && cookie.value != null) {
                let _RwBfValue = removegcParameterFromCookie(cookie.value);
                if (_RwBfValue) {
                    _RwBfValue = _RwBfValue + "&gc=" + gc;
                }
                else {
                    _RwBfValue = "gc=" + gc;
                }
                chrome.cookies.set({ url: bingUrl, domain: '.bing.com', name: '_RwBf', value: _RwBfValue, sameSite: 'no_restriction', secure: true, expirationDate: cookie.expirationDate }, function (cookie) {
                });
            }
            else {
                var nextYearDate = new Date(inputDate.getFullYear(), 0, 1);
                nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
                chrome.cookies.set({ url: bingUrl, domain: '.bing.com', name: '_RwBf', value: "gc=" + gc, sameSite: 'no_restriction', secure: true, expirationDate: nextYearDate.getTime() }, function (cookie) {
                });
            }
        });
    }
});