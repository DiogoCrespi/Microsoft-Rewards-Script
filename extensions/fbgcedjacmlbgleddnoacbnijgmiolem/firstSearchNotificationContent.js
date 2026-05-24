chrome.runtime.sendMessage("setMachineID");

var listenerRef = function clickListener() {
    var searchNotification = document.querySelector(".firstSearchNotification");
    searchNotification.style.display = "none";
    window.removeEventListener("focus", listenerRef);
    window.removeEventListener("click", listenerRef);
    try {
        chrome.runtime.sendMessage("notificationDismissed");
    } catch (exception) {
        var changeItBackNotification = document.querySelector(".changeItBackNotification");
        if (changeItBackNotification) {
            changeItBackNotification.style.display = "block";
        }
    }
}

if (!document.hasFocus()) {
    var body = document.querySelector("body");

    chrome.storage.local.get("Channel", (items) => {
        var firstSearchNotificationSource = "https://www.bing.com/browserextension/rewards/firstsearchoverlay";
        if (items["Channel"]) {
            firstSearchNotificationSource += "?channel=" + items["Channel"];
        }
        var firstSearchNotificationFrame = createIframe(firstSearchNotificationSource, "firstSearchNotification");
        body.appendChild(firstSearchNotificationFrame);
        window.addEventListener("focus", listenerRef);
        window.addEventListener("click", listenerRef);
    
        var version = chrome.runtime.getManifest().version;
        var promptMkt = chrome.i18n.getMessage("ExtnLanguage");
        var browserLanguage = navigator.language ? navigator.language : navigator.userLanguage;
        browserLanguage = browserLanguage ? browserLanguage.toLowerCase() : browserLanguage;
        var promptMktToCompare = promptMkt && browserLanguage && browserLanguage.length != 5 ? promptMkt.substring(0, 2) : promptMkt;
        if (promptMktToCompare && browserLanguage && promptMktToCompare == browserLanguage) {
            var changeItBackNotificationSource = "https://go.microsoft.com/fwlink/?linkid=2179704&xid=106&version=" + version + "&bmkt=" + promptMkt;
            var changeItBackNotificationFrame = createIframe(changeItBackNotificationSource, "changeItBackNotification");
            changeItBackNotificationFrame.style.display = "none";
            body.appendChild(changeItBackNotificationFrame);
        }
    })

}

function createIframe(src, className = "") {
    var notificationFrame = document.createElement("iframe");
    notificationFrame.classList.add(className);
    notificationFrame.src = src;
    notificationFrame.style.top = "0";
    notificationFrame.style.left = "0";
    notificationFrame.style.zIndex = "1011";
    notificationFrame.style.width = "100vw";
    notificationFrame.style.height = "100%";
    notificationFrame.style.position = "fixed";
    notificationFrame.style.border = "none";
    return notificationFrame;
}