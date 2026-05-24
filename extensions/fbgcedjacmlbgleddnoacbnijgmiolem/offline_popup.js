var market = chrome.i18n.getMessage("ExtnLanguage");

document.addEventListener('DOMContentLoaded', function () {

	document.getElementById("rewards-name").innerHTML = chrome.i18n.getMessage("RewardsTitle");
	document.getElementById("flyout-title").innerHTML = chrome.i18n.getMessage("Flyout_Signup_Title");
	document.getElementById("flyout-description").innerHTML = chrome.i18n.getMessage("Flyout_Signup_Description");
	document.getElementById("flyout-disclaimer").innerHTML = chrome.i18n.getMessage("Flyout_Signup_Disclaimer");
	document.getElementById("flyout-terms").innerHTML = chrome.i18n.getMessage("Flyout_Signup_Terms");
	document.getElementById("flyout-separator").innerHTML = chrome.i18n.getMessage("Flyout_Signup_Separator");
	document.getElementById("flyout-privacy").innerHTML = chrome.i18n.getMessage("Flyout_Signup_Privacy");
	document.getElementById("flyout-signin").innerHTML = chrome.i18n.getMessage("Flyout_Signup_SignIn");
	document.getElementById("flyout-join").innerHTML = chrome.i18n.getMessage("Flyout_Signup_Join");

	if (market == "bg-bg" ) {
		document.getElementById("flyout-join").style.width = "105px";
	}
	if (market == "sr-cyrl-rs") {
		document.getElementById("flyout-join").style.width = "95px";
	}
	if (market == "cs-cz") {
		document.getElementById("flyout-join").style.width = "60px";
	}
	
	if (market == "da-dk" || market == "el-gr") {
		document.getElementById("flyout-join").style.width = "70px";
	}
	if (market == "de-de" || market == "hr-hr" || market == "hu-hu" || market == "uk-ua") {
		document.getElementById("flyout-join").style.width = "80px";
	}
	if (market == "es-es" || market == "es-419" || market == "et-ee" || market == "it-it"|| market == "id-id"||market == "ca-es"||market == "bn-in"||market =="am-et") {
		document.getElementById("flyout-join").style.width = "50px";
	}
	if (market == "th-th" || market == "he-il"||market == "fil-ph") {
		document.getElementById("flyout-join").style.width = "40px";
	}
	if (market == "pt-pt" || market == "tr-tr" || market == "zh-cn" || market == "zh-tw") {
		document.getElementById("flyout-join").style.width = "36px";
	}
	if (market == "ms-my"||market =="ko-kr" || market == "ar-sa"||market == "fa-ir") {
		document.getElementById("flyout-join").style.width = "30px";
	}
	if (market == "ja-jp" || market == "nb-no" || market == "pl-pl" || market == "sv-se" ||market == "fr-fr" ||market =="hi-in"||market == "vi-vn" )
	{
		document.getElementById("flyout-join").style.width = "56px";
	}
	if (market == "sk-sk" || market == "sl-si")
	{
		document.getElementById("flyout-join").style.width = "62px";
	}
	if (market == "lv-lv" || market == "nl-nl" || market == "pt-br" || market == "ro-ro" )
	{
		document.getElementById("flyout-join").style.width = "72px";
	}
	if (market == "lt-lt")
	{
		document.getElementById("flyout-join").style.width = "100px";
	}
	if (market == "pl-pl" )
	{
		document.getElementById("flyout-title").style.fontSize = "17px";
	}
});