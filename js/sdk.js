var currentChannel = 0;
const canales = [
    { callObj: null, estado: 0, selected: 1 },
    { callObj: null, estado: 0, selected: 0 },
    { callObj: null, estado: 0, selected: 0 },
    { callObj: null, estado: 0, selected: 0 }
];

const port = chrome.runtime.connect();

port.onMessage.addListener(function(message) {
    if (message.type === "registrationStateChanged") {
        onRegistrationStateChanged(message.payload);
    } else if (message.type === "newIncomingCall") {
        onNewIncomingCall(message.payload.callId, message.payload.callObj, message.payload.autoAnswer);
    } else if (message.type === "callStateChange") {
        onCallStateChange(message.payload.callId, message.payload.callObj, message.payload.event);
    } else if (message.type === "callTerminate") {
        onCallTerminate(message.payload.callId, message.payload.reason);
    }
});

$(document).ready(function() {
    $('#loginBtn').click(function() {
        chrome.runtime.sendMessage({
            type: "login",
            payload: {
                extn: $("#extn").val(),
                pwd: $("#pwd").val()
            }
        });
    });

    document.querySelector(".icon-phone-circled").onclick = (e) => {
        if (e.target.classList.contains("off")) colgar()
        else llamar()
    }

    document.querySelector(".icon-share").onclick = (e) => {
        transferir()
    }

    document.querySelector(".icon-pause").onclick = (e) => {
        hold(e)
    }

    document.querySelector(".icon-volume-off").onclick = (e) => {
        mute(e)
    }

    document.querySelector("#pantalla").onkeyup = (e) => {
        if (e.key == "Enter")
            llamar()
    }

    document.querySelector("#inpTrans").onkeyup = (e) => {
        if (e.key == "Enter")
            transferir()
    }

    document.querySelector("#channels").onclick = (e) => {
        const sel = Number(e.target.getAttribute("data-id"))
        if (e.target.id == "channels") return

        if (canales[currentChannel].estado == 4) return

        canales.forEach((i, index) => {
            if (index == sel) {
                i.selected = 1
                if (i.estado == 2) {
                    chrome.runtime.sendMessage({ type: "unhold", payload: { callId: i.callObj.getCallId() } });
                    i.estado = 1
                }
                if (i.estado == 3) {
                    chrome.runtime.sendMessage({ type: "answerCall", payload: { callId: i.callObj.getCallId() } });
                    i.estado = 1
                }
            } else {
                i.selected = 0
                if (i.estado == 1 || i.estado == 4) {
                    chrome.runtime.sendMessage({ type: "hold", payload: { callId: i.callObj.getCallId() } });
                    i.estado = 2
                }
            }
        })

        drawChannels()
    }

    drawChannels()
});

function mute(e) {
    const bt = e.target
    if (bt.classList.contains('hold')) {
        bt.classList.remove('hold')
        chrome.runtime.sendMessage({ type: "unmute", payload: { callId: canales[0].callObj.getCallId() } });
    } else {
        bt.classList.add('hold')
        chrome.runtime.sendMessage({ type: "mute", payload: { callId: canales[0].callObj.getCallId() } });
    }
}

function hold(e) {
    const bt = e.target
    if (bt.classList.contains('hold')) {
        bt.classList.remove('hold')
        chrome.runtime.sendMessage({ type: "unhold", payload: { callId: canales[0].callObj.getCallId() } });
    } else {
        bt.classList.add('hold')
        chrome.runtime.sendMessage({ type: "hold", payload: { callId: canales[0].callObj.getCallId() } });
    }
}

function transferir() {
    const llamada = canales[currentChannel]
    if ($("#inpTrans").val().trim() == "") {
        return;
    }
    chrome.runtime.sendMessage({ type: "transfer", payload: { number: $("#inpTrans").val(), callId: llamada.callObj.getCallId() } });
}

function llamar() {
    const llamada = canales[currentChannel]
    if (llamada.callObj == null) {
        chrome.runtime.sendMessage({ type: "makeCall", payload: { number: $("#pantalla").val() } });
        llamada.estado = 4
        drawChannels()
    } else {
        if (llamada.estado == 3) {
            chrome.runtime.sendMessage({ type: "answerCall", payload: { callId: llamada.callObj.getCallId() } });
            llamada.estado = 1
        }
    }
    drawChannels()
}

function colgar() {
    const llamada = canales[currentChannel]
    chrome.runtime.sendMessage({ type: "cancelCall", payload: { callId: llamada.callObj.getCallId() } });
    llamada.estado = 0
    drawChannels()
}

function onRegistrationStateChanged(resp) {
    if (resp.result === "AWL_MSG_LOGIN_SUCCESS") {
        $('#login').hide();
        $('#dialer').show();
    } else if (resp.result === "AWL_MSG_LOGIN_FAILED") {
        alert(resp.reason);
    }
}

function onNewIncomingCall(callId, callObj, autoAnswer) {
    let canalVacio = null
    for (let i = 0; i < canales.length; i++) {
        if (canales[i].callObj == null) {
            canalVacio = i
            break
        }
    }

    if (canalVacio == null) {
        return
    }

    const numero = callObj.getFarEndNumber()
    $("#msgText").html("<- " + callObj.getFarEndName() + ` ( ${numero} )`)
    canales[canalVacio].callObj = callObj
    canales[canalVacio].estado = 3
    drawChannels()
}

function onCallStateChange(callId, callObj, event) {
    const llamada = canales[currentChannel]
    switch (callObj.getCallState()) {
        case "AWL_MSG_CALL_CONNECTED":
            break;
        case "AWL_MSG_CALL_DISCONNECTED":
            canales[currentChannel].estado = 0
            drawChannels()
            break;
        case "AWL_MSG_CALL_FAILED":
            if (llamada.callObj !== null) {
                delete llamada.callObj;
                llamada.callObj = null;
                drawChannels()
            }
            break;
    }
}

function onCallTerminate(callId, reason) {
    for (let i = 0; i < canales.length; i++) {
        if (canales[i].callObj != null)
            if (canales[i].callObj.getCallId() == callId) {
                delete canales[i].callObj
                canales[i].callObj = null
                canales[i].estado = 0
                drawChannels()
            }
    }
}

function drawChannels() {
    const dCanales = document.querySelectorAll("#channels>div")
    dCanales.forEach((element, index) => {
        element.className = "estado" + canales[index].estado
        if (canales[index].selected == 1) {
            const icono = document.querySelector(".icon-phone-circled")
            currentChannel = index

            element.className = "ChannelSelected"
            if (canales[index].callObj != null) {
                if (canales[index].estado == 3) {
                    element.className = "estado3"
                    icono.classList.remove("off")
                    icono.classList.add("on")
                } else {
                    icono.classList.add("off")
                }
            } else {
                icono.classList.remove("off")
                icono.classList.add("on")
            }
        }
    });
}