var PARTNER_CODE = 'PartnerCode';
var notificationIconUrl = chrome.runtime.getURL("images/48x48.png");
var endpointUrlGetNotification =
    "https://www.bing.com/BrowserExtension/Rewards/GetNotification";
var endpointUrlReportNotificationDisplayed =
    "https://www.bing.com/BrowserExtension/Rewards/NotificationDisplayed";
var endpointUrlReportNotificationClicked =
    "https://www.bing.com/BrowserExtension/Rewards/NotificationClicked";
var endpointUrlReportNotificationClosed =
    "https://www.bing.com/BrowserExtension/Rewards/NotificationClosed";
var endpointUrlNotificationsPermissionChanged =
    "https://www.bing.com/BrowserExtension/Rewards/NotificationsPermissionChanged";
var lsInstalledDate = "installedDate";
var lsLastNotificationDisplayedDate = "lastNotifDispDate";
var lsLastNotificationDisplayedId = "lastNotifDispId";
var lsLastNewTabNotificationDisplayedId = "lastNewTabNotifDispId";
var lsHasDSE = "hasDSE";
var lsChannel = "Channel";
var lsIsNotifEnabled = "isNotifEnabled";
var lsNotificationTargetUrlMapping = "notifTargetUrlMapping";
var onInstallEventName = "runtime.onInstalled";
var newTabEventName = "tabs.onCreated";

//Sets 'hasDSE' in chromeStorage whenever notifications.js gets executed
chrome.management.getSelf(function (e) {
    return chrome.storage.local.set({[lsHasDSE]: e.permissions && e.permissions.indexOf("searchProvider") > 0 });
});

chrome.runtime.onInstalled.addListener(getOnInstallNotificationIfEnabled);

chrome.tabs.onCreated.addListener(getOnNewTabNotification);

chrome.notifications.onPermissionLevelChanged.addListener(
    reportPermissionLevelChanged
);

chrome.notifications.onClicked.addListener(
    reportNotificationClickedAndOpenPage
);

chrome.notifications.onClosed.addListener(reportNotificationClosed);

function getOnInstallNotificationIfEnabled(details) {
    chrome.storage.local.set({
        [lsIsNotifEnabled]: true,
    });
    getOnInstallNotification(details);
}

function getOnInstallNotification(details) {
    if (details.reason === 'install') {
        var installDate = new Date().toUTCString();
        chrome.storage.local.set({[lsInstalledDate]: installDate});
    }
    var data = {
        ExtensionEvent: onInstallEventName,
        ExtensionEventReason: details.reason,
    };

    chrome.storage.local.get([PARTNER_CODE], function (items) {
        let partnerCode = items[PARTNER_CODE] ? items[PARTNER_CODE] : "U523";
        var endpointUrl =
            endpointUrlGetNotification +
            "?evt=ext" +
            details.reason +
            "&pc=" +
            partnerCode;

        getAndShowNotification(endpointUrl, data, onInstallEventName);
    });
}

function getOnNewTabNotification(tab) {
    isEnabled().then((res) => {
        if (res == false) {
            return;
        }
        if (res == true) {
            var data = { ExtensionEvent: newTabEventName };

            chrome.storage.local.get([PARTNER_CODE], function (items) {
                let partnerCode = items[PARTNER_CODE] ? items[PARTNER_CODE] : "U523";
                var endpointUrl =
                    endpointUrlGetNotification + "?evt=newtab" + "&pc=" + partnerCode;
                getAndShowNotification(endpointUrl, data, newTabEventName);
            });
        }
    });
}

function reportPermissionLevelChanged(permissionLevel) {
    isEnabled().then((res) => {
        if (res == false) {
            return;
        }
        if (res == true) {
            if (typeof permissionLevel === "undefined" || !permissionLevel) {
                return;
            }
            var data = { ExtensionNotificationsPermission: permissionLevel };
            chrome.storage.local.get([PARTNER_CODE], function (items) {
                let partnerCode = items[PARTNER_CODE] ? items[PARTNER_CODE] : "U523";
                var endpointUrl =
                    endpointUrlNotificationsPermissionChanged +
                    "?p=" +
                    permissionLevel +
                    "&pc=" +
                    partnerCode;
                sendRequest(endpointUrl, data);
            });
        }
    });
}

function reportNotificationDisplayed(notificationId, extensionEvent) {
    isEnabled().then((res) => {
        if (res == false) {
            return;
        }
        if (res == true) {
            if (typeof notificationId === "undefined" || !notificationId) {
                return;
            }

            var data = { NotificationId: notificationId };
            chrome.storage.local.get([PARTNER_CODE], function (items) {
                let partnerCode = items[PARTNER_CODE] ? items[PARTNER_CODE] : "U523";
                var endpointUrl =
                    endpointUrlReportNotificationDisplayed +
                    "?nid=" +
                    notificationId +
                    "&pc=" +
                    partnerCode;
                sendRequest(endpointUrl, data);

                var displayedDate = new Date().toUTCString();
                if (extensionEvent && extensionEvent === newTabEventName) {
                    chrome.storage.local.set({
                        [lsLastNotificationDisplayedDate]: displayedDate,
                        [lsLastNotificationDisplayedId]: notificationId,
                        [lsLastNewTabNotificationDisplayedId]: notificationId
                    });
                }
                else {
                    chrome.storage.local.set({
                        [lsLastNotificationDisplayedDate]: displayedDate,
                        [lsLastNotificationDisplayedId]: notificationId
                    });
                }
            });
        }
    });
}

function reportNotificationClosed(notificationId, byUser) {
    isEnabled().then((res) => {
        if (res == false) {
            return;
        }
        if (res == true) {
            if (typeof notificationId === "undefined" || !notificationId) {
                return;
            }

            var data = { NotificationId: notificationId };

            if (typeof byUser !== "undefined" && byUser) {
                data.ExtensionEventTriggeredByUser = true;
            }

            chrome.storage.local.get([PARTNER_CODE], function (items) {
                let partnerCode = items[PARTNER_CODE] ? items[PARTNER_CODE] : "U523";
                var endpointUrl =
                    endpointUrlReportNotificationClosed +
                    "?nid=" +
                    notificationId +
                    "&pc=" +
                    partnerCode;
                sendRequest(endpointUrl, data);
            });
        }
    });
}

function reportNotificationClickedAndOpenPage(notificationId) {
    if (typeof notificationId === "undefined" || !notificationId) {
        return;
    }

    chrome.notifications.clear(notificationId);

    chrome.storage.local.get([PARTNER_CODE], function (items) {
        let partnerCode = items[PARTNER_CODE] ? items[PARTNER_CODE] : "U523";
        var data = { NotificationId: notificationId };
        var endpointUrl =
            endpointUrlReportNotificationClicked +
            "?nid=" +
            notificationId +
            "&pc=" +
            partnerCode;
        sendRequest(endpointUrl, data);

        var targetUrl;
        try {
            var targetUrlObj = getNotificationTargetUrl(notificationId);
            targetUrlObj.then((responseUrl) => {
                targetUrl = responseUrl;

                if (
                    typeof targetUrl === "undefined" ||
                    !targetUrl ||
                    !(targetUrl.includes("http://") || targetUrl.includes("https://"))
                ) {
                    return;
                }

                chrome.tabs.create({ url: targetUrl });
            });
        }
        catch {
            return;
        }
    });
}

function getAndShowNotification(endpointUrl, data, extensionEventName) {
    sendRequest(endpointUrl, data).then(function (response) {
        if (!response || response.ErrorCode !== 0 || !response.NotificationData) {
            return;
        }

        var notificationData = response.NotificationData;
        var notification = {
            id: notificationData.Id,
            title: notificationData.Title,
            message: notificationData.Message,
            type: notificationData.TemplateType,
            requireInteraction: notificationData.RequireInteraction,
            targetUrl: notificationData.TargetUrl,
            iconUrl: notificationData.IconUrl,
            priority: notificationData.Priority,
        };

        showNotification(notification, extensionEventName);
    });
}

function showNotification(notification, extensionEventName) {
    if (
        notification.id === "RewardsExtWelcomeNotSignedIn" &&
        notification.targetUrl
    ) {
        return;
    }

    chrome.notifications.getPermissionLevel(function (level) {
        if (
            level === "granted" &&
            notification.id &&
            notification.title &&
            notification.message
        ) {
            if (notification.iconUrl) {
                toDataURL(notification.iconUrl).then((dataUrl) => {
                    notificationIconUrl = dataUrl;
                    createNotification(notification, extensionEventName);
                });
            }
            else {
                createNotification(notification, extensionEventName);
            }
            try {
                saveNotificationTargetUrl(notification.id, notification.targetUrl);
            } catch {
                return;
            }
        }
    });
}

function createRequestPayload(data) {
    return new Promise((resolve) => {
        if (!data) {
            resolve(null);
        }

        try {
            chrome.storage.local.get([lsChannel, lsInstalledDate, lsLastNotificationDisplayedDate, lsLastNotificationDisplayedId, lsLastNewTabNotificationDisplayedId, lsHasDSE], (items) => {
                data.ExtensionHasDSE = items[lsHasDSE] === true;
                data.ExtensionChannelId = items[lsChannel];
                data.ExtensionId = chrome.runtime.id;
                var installedDateStr = items[lsInstalledDate];
                if (installedDateStr != null) {
                    data.ExtensionInstalledDate = new Date(installedDateStr);
                }
                var lastNotificationDisplayedStr = items[lsLastNotificationDisplayedDate] ? items[lsLastNotificationDisplayedDate] : null;
                if (lastNotificationDisplayedStr != null) {
                    data.LastNotificationDisplayedDate = new Date(
                        lastNotificationDisplayedStr
                    );
                }
                data.LastNotificationDisplayedId = items[lsLastNotificationDisplayedId] ? items[lsLastNotificationDisplayedId] : null;
                data.LastNewTabNotificationDisplayedId = items[lsLastNewTabNotificationDisplayedId] ? items[lsLastNewTabNotificationDisplayedId] : null;
                var payload = JSON.stringify(data);
                resolve(payload);
            });
        } catch (error) { resolve(null); }

    });
}

async function sendRequest(endpointUrl, data) {
    var payload = await createRequestPayload(data);

    return fetch(endpointUrl, {
        credentials: "include",
        method: "POST",
        headers: {
            "Content-Type": "application/json;charset=utf-8",
            "X-BBE-CSRF": "BrowserExtensionsNotifications",
        },
        body: payload,
    })
        .then(function (response) {
            if (response && response.ok) {
                return response.json();
            }
            return null;
        })
        .catch(function (error) {
            return null;
        });
}

function saveNotificationTargetUrl(notificationId, notificationTargetUrl) {
    var notificationTargetUrlMapping = {};
    chrome.storage.local.get(lsNotificationTargetUrlMapping, (items) => {
        var stringNotificationTargetUrlMapping = items[lsNotificationTargetUrlMapping];
        if (stringNotificationTargetUrlMapping) {
            notificationTargetUrlMapping = JSON.parse(
                stringNotificationTargetUrlMapping
            );

            if (!notificationTargetUrlMapping) {
                notificationTargetUrlMapping = {};
            }
        }

        notificationTargetUrlMapping[notificationId] = notificationTargetUrl;
        var stringNotificationTargetUrlMapping = JSON.stringify(
            notificationTargetUrlMapping
        );
        chrome.storage.local.set({ [lsNotificationTargetUrlMapping]: stringNotificationTargetUrlMapping });
    });
}

function getNotificationTargetUrl(notificationId) {
    return new Promise((resolve) => {
        chrome.storage.local.get(lsNotificationTargetUrlMapping, (items) => {
            var stringNotificationTargetUrlMapping = items[lsNotificationTargetUrlMapping];
            if (stringNotificationTargetUrlMapping) {
                var notificationTargetUrlMapping = JSON.parse(
                    stringNotificationTargetUrlMapping
                );

                if (!notificationTargetUrlMapping) {
                    resolve(null);
                }

                var notifTargetUrl = notificationTargetUrlMapping[notificationId];
                delete notificationTargetUrlMapping[notificationId];
                stringNotificationTargetUrlMapping = JSON.stringify(
                    notificationTargetUrlMapping
                );
                chrome.storage.local.set({ [lsNotificationTargetUrlMapping]: stringNotificationTargetUrlMapping });
                resolve(notifTargetUrl);
            }

            notificationTargetUrlMapping = {};
            var stringNotificationTargetUrlMapping = JSON.stringify(
                notificationTargetUrlMapping
            );
            chrome.storage.local.set({ [lsNotificationTargetUrlMapping]: stringNotificationTargetUrlMapping });
            resolve(null);
        });
    });
}

function isEnabled() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get([lsIsNotifEnabled], (items) => {
            var isNotifEnabled = items[lsIsNotifEnabled];
            if (typeof (isNotifEnabled) !== 'undefined' && isNotifEnabled === true) {
                resolve(true);
            }
            resolve(false);
        });
    })
}

async function toDataURL(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }
    catch (error) { resolve(null); }
}


function createNotification(notification, extensionEventName) {
    chrome.notifications.create(
        notification.id,
        {
            title: notification.title,
            message: notification.message,
            type: "basic",
            iconUrl: notificationIconUrl,
            requireInteraction: notification.requireInteraction,
        },
        (notificationId) =>
            reportNotificationDisplayed(notificationId, extensionEventName)
    );
}