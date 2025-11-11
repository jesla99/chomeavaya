let creating; // A global promise to avoid concurrency issues
var port;

async function setupOffscreenDocument(path) {
    // Check all windows controlled by the extension to see if one
    // of them is the offscreen document with the given path
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    // create offscreen document
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: ['USER_MEDIA'],
            justification: 'reason for needing user media',
        });
        await creating;
        creating = null;
    }
}

chrome.runtime.onConnect.addListener(function(newPort) {
    port = newPort;
});

chrome.runtime.onMessage.addListener(async function(message, sender, sendResponse) {
    if (port) {
        port.postMessage(message);
    }

    await setupOffscreenDocument('offscreen.html');
    chrome.runtime.sendMessage(message);
});
