chrome.management.onEnabled.addListener(function (ExtensionInfo) {

    if (ExtensionInfo.id != chrome.runtime.id) {
        return;
    }

    chrome.storage.local.get(["BingDefaultsSet"], (items) => {
        if (!items.BingDefaultsSet) {
            chrome.storage.local.set({
                "BingDefaultsSet": "done"
            });
        }
    });
});

chrome.action.onClicked.addListener(function (tab) {
    checkFlyoutStatus(tab);
});


async function checkFlyoutStatus(tab) {

    if (!navigator.onLine) {
        chrome.tabs.create({ url: chrome.runtime.getURL('offline_popup.html') });
        return;
    }

    try {
        const response = await fetch('https://www.bing.com/rewards/panelflyout?partnerId=BrowserExtensions', { method: 'HEAD' });
        if (response.ok == true && response.status == 200) {
            flyoutStatusOnline(tab);
        }
        else {
            chrome.tabs.create({ url: chrome.runtime.getURL('offline_popup.html') });
        }

    } catch (e) {
        chrome.tabs.create({ url: chrome.runtime.getURL('offline_popup.html') });
    }
}

function flyoutStatusOnline(tab){
    // Execute the content script in the current tab
    if (tab.url == undefined) {
        openNewBingTabWithFlyout();
    }
    else {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['rewardAction.js']
        }, function () {
            if (chrome.runtime.lastError) {
                openNewBingTabWithFlyout();
            }
        });
        chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["rewardAction.css"]
        });
    }
}

function openNewBingTabWithFlyout(){
    // Execute the content script in the current tab
    chrome.tabs.create({ url: "https://www.bing.com" }, (tab) => {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['rewardAction.js']
        });
        chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["rewardAction.css"]
        });
    });
}
