importScripts(
    'thirdparty/jquery-1.8.3.min.js',
    'AWL-min/awl.min.js',
    'jrapi.js'
);

var cli = new AWL.client();
var port;

chrome.runtime.onConnect.addListener(function(newPort) {
    port = newPort;
});

function onRegistrationStateChanged(resp) {
    if (port) {
        port.postMessage({
            type: "registrationStateChanged",
            payload: resp
        });
    }
}

function CallListener() {
    return {
        onNewIncomingCall: function(callId, callObj, autoAnswer) {
            if (port) {
                port.postMessage({
                    type: "newIncomingCall",
                    payload: { callId, callObj, autoAnswer }
                });
            }
        },
        onCallStateChange: function(callId, callObj, event) {
            if (port) {
                port.postMessage({
                    type: "callStateChange",
                    payload: { callId, callObj, event }
                });
            }
        },
        onCallTerminate: function(callId, reason) {
            if (port) {
                port.postMessage({
                    type: "callTerminate",
                    payload: { callId, reason }
                });
            }
        }
    };
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === "login") {
        var appInstanceId = cli.generateAppInstanceID();
        const cfg = {
            volume: 1.0,
            serviceType: "phone",
            enableVideo: false,
            Gateway: { ip: "172.16.0.151", port: "42004" },
            Stunserver: { ip: "", port: "3478" },
            Turnserver: { ip: "", port: "3478", user: "", pwd: "" },
            AppData: { applicationID: "xxxx12345", applicationUA: "sdkClient-3.0.0", appInstanceID: appInstanceId },
            disableResiliency: false
        };
        const onCallListener = new CallListener();
        cli.setConfiguration(cfg, function() {}, onRegistrationStateChanged, onCallListener, function() {});
        cli.logIn(request.payload.extn, request.payload.pwd, "true");
    } else if (request.type === "makeCall") {
        cli.makeCall(request.payload.number, "audio");
    } else if (request.type === "answerCall") {
        cli.answerCall(request.payload.callId);
    } else if (request.type === "cancelCall") {
        cli.cancelCall(request.payload.callId);
    } else if (request.type === "hold") {
        cli.doHold(request.payload.callId);
    } else if (request.type === "unhold") {
        cli.doUnHold(request.payload.callId);
    } else if (request.type === "mute") {
        cli.doMute(request.payload.callId);
    } else if (request.type === "unmute") {
        cli.doUnMute(request.payload.callId);
    } else if (request.type === "transfer") {
        cli.transferCall(request.payload.number, request.payload.callId, "unAttended");
    }
});
