let dyniframe;
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (request.message == "openpopup") {
        dyniframe = createPopup();
        return true;
    }

    if (request.message == "removepopup") {
        if (dyniframe) {
            dyniframe.remove();
        }
        return true;
	}
});

document.addEventListener('click', function (event) {
    removepopup("dynalist-ext-popup", event);
});

// show iframe in page as popup
// https://stackoverflow.com/questions/10479679/how-can-i-open-my-extensions-pop-up-with-javascript

function createPopup() {
    // make popup
    const iframe = document.createElement('iframe');
    iframe.src = chrome.extension.getURL("popup.html");
    iframe.id = "dynalist-ext-popup";
    iframe.style.margin = '0px';
    iframe.style.padding = '0px';
    iframe.style.position = 'fixed';
    iframe.style.right = '5px';
    iframe.style.top = '5px';
    iframe.style.width = '320px';
    iframe.style.height = '135px';//'112px';
    iframe.style.zIndex = 2147483647;
    iframe.style.display = 'block !important';
    iframe.style.border = 0;
    document.body.appendChild(iframe);

    return iframe;
}

function removepopup(iframeID, event) {
    let dyniframe = window[iframeID];
    if (Array.isArray(dyniframe)) {
        for (let iframe of dyniframe) {
            iframe.remove();
        }
    }

    else if (dyniframe && event.target != dyniframe) {
        dyniframe.remove();
    }
}

function isClickedIframe(event) {
    
}