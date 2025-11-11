let creating; // A global promise to avoid concurrency issues
let popupPort = null;
const offscreenUrl = chrome.runtime.getURL('offscreen.html');

// Function to manage the offscreen document
async function setupOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['USER_MEDIA'],
            justification: 'WebRTC connection requires a DOM environment',
        });
        await creating;
        creating = null;
    }
}

// Listener for connections from the popup
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'popup') {
        popupPort = port;
        port.onDisconnect.addListener(() => {
            popupPort = null;
        });
    }
});

// Listener for messages from any part of the extension
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    // Check if the offscreen document needs to be created
    if (message.type === 'login' || message.type === 'makeCall') {
        await setupOffscreenDocument();
    }

    // Differentiate messages based on the sender's URL
    if (sender.url === offscreenUrl) {
        // Message is from the offscreen document, forward to the popup
        if (popupPort) {
            popupPort.postMessage(message);
        }
    } else {
        // Message is from the popup, forward to the offscreen document
        chrome.runtime.sendMessage(message);
    }
});
