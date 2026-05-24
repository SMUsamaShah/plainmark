import { registry }    from './endpoints/registry.js';
import { getURLTitle } from './util.js';

// Create context menus once on install/update to avoid "already exists" errors
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({ id: 'save-page',      title: 'Save page',    contexts: ['page'] });
        chrome.contextMenus.create({ id: 'save-link',      title: 'Save link',    contexts: ['link'] });
        chrome.contextMenus.create({ id: 'save-selection', title: "Save '%s'",    contexts: ['selection'] });
    });
});

// All context menu saves open the popup with prefilled data so the user can add notes
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    let data = {};

    if (info.menuItemId === 'save-page') {
        data = { title: tab.title, url: tab.url };

    } else if (info.menuItemId === 'save-link') {
        let linkTitle = '';
        try { linkTitle = await getURLTitle(info.linkUrl); } catch (_) {}
        data = {
            title: linkTitle || info.linkUrl,
            url:   info.linkUrl,
            note:  `Source: ${tab.title} ${tab.url}`,
        };

    } else if (info.menuItemId === 'save-selection') {
        data = {
            title: info.selectionText,
            url:   tab.url,
            note:  `${tab.title} ${tab.url}`,
        };
    }

    chrome.tabs.sendMessage(tab.id, { message: 'openpopup', data });
});

// Icon click: open popup with current tab data (pass title+url so popup doesn't need to query tabs)
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.sendMessage(tab.id, {
        message: 'openpopup',
        data: { title: tab.title, url: tab.url },
    });
});

// Message handler for popup ↔ service worker communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request)
        .then(sendResponse)
        .catch(e => sendResponse({ error: e.message }));
    return true; // keep channel open for async response
});

async function handleMessage(request) {
    const endpoint = await registry.getActive();

    switch (request.message) {
        case 'getConfig':
            return { endpointId: endpoint.id, endpointName: endpoint.name };

        case 'add':
            return endpoint.add(request.title, request.url, request.note);

        case 'update':
            return endpoint.update(request.id, request.note);

        case 'delete':
            return endpoint.delete(request.id);

        default:
            return { error: `unknown message: ${request.message}` };
    }
}
