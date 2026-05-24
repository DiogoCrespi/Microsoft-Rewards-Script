function init() {
    let body = document.body;
    let rightPane = document.createElement('section');
    rightPane.id = 'reward-right-pane';
    rightPane.classList.add('reward-right-pane');
    body.appendChild(rightPane);

    let iframeElement = document.createElement('iframe');
    iframeElement.id = 'reward-pane-frame';
    iframeElement.classList.add('reward-pane-frame');
    iframeElement.setAttribute("scrolling", "no");
    iframeElement.setAttribute("src", "https://www.bing.com/rewards/panelflyout?partnerId=BrowserExtensions");
    rightPane.classList.add('open');
    rightPane.appendChild(iframeElement);
    body.appendChild(rightPane);
}


var rightPaneExists = document.getElementById('reward-right-pane');
 if (!rightPaneExists) {
	init();
 }
 else{
	if(rightPaneExists.classList.contains("hide")){
        rightPaneExists.classList.remove('hide');
        rightPaneExists.classList.add('open');
    }
    else{
        rightPaneExists.classList.add('hide');
        rightPaneExists.classList.remove('open');
    }
 }

 window.addEventListener("message",
 function (event) {
     if (event.origin == "https://www.bing.com" && event.data.action == "closeFlyout") {
         let rightPaneExists = document.getElementById('reward-right-pane');
         if (rightPaneExists.classList.contains("open")) {
             rightPaneExists.classList.add('hide');
             rightPaneExists.classList.remove('open');
         }
     }

 },
false);

      
