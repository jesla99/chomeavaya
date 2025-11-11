/**
 * @fileoverview Script para un softphone WebRTC utilizando el SDK de Avaya (AWL).
 * Gestiona la autenticación, el estado de múltiples canales de llamada y las acciones
 * básicas de telefonía como llamar, colgar, transferir, poner en espera y silenciar.
 *
 * @requires jQuery
 * @requires Avaya WebRTC SDK (AWL.client)
 */

// ===================================================================================
// Variables Globales y Estado de la Aplicación
// ===================================================================================

/**
 * Índice del canal actualmente seleccionado por el usuario en la interfaz.
 * @type {number}
 */
let currentChannel = 0;

/**
 * Array que gestiona el estado de los canales de llamada disponibles.
 * Estados posibles:
 * 0: Libre
 * 1: En llamada activa
 * 2: En espera (Hold)
 * 3: Llamada entrante (Ringing)
 * 4: Marcando (Llamada saliente en progreso)
 * @type {Array<{callObj: object|null, estado: number, selected: number}>}
 */
const canales = [
    { callObj: null, estado: 0, selected: 1 }, // El primer canal está seleccionado por defecto
    { callObj: null, estado: 0, selected: 0 },
    { callObj: null, estado: 0, selected: 0 },
    { callObj: null, estado: 0, selected: 0 }
];

/**
 * Instancia del cliente del SDK de Avaya.
 * @type {AWL.client}
 */
const avaya = new AWL.client();

/**
 * Objeto de audio para el tono de llamada entrante.
 * @type {Audio}
 */
const audioRing = new Audio('http://172.16.250.26/rings/ring.mp3');
audioRing.loop = true;

/**
 * Objeto de audio para el tono de marcado (llamada saliente).
 * @type {Audio}
 */
const audioTono = new Audio('http://172.16.250.26/tono.mp3');
audioTono.loop = true;

/**
 * Mapeo de mensajes de error del SDK a traducciones amigables para el usuario.
 * @type {Object<string, string>}
 */
const razonDesconexion = {
    "Call Dropped": "Llamada perdida",
    "Call dropped": "Llamada terminada",
    "Invalid Credentials": "Credenciales incorrectas."
};

// ===================================================================================
// Inicialización del SDK y Lógica de Negocio
// ===================================================================================

/**
 * Configura e inicia sesión en el servicio de Avaya.
 * Se ejecuta al hacer clic en el botón de login.
 */
function iniciarSesion() {
    const appInstanceId = avaya.generateAppInstanceID();

    const config = {
        volume: 1.0,
        serviceType: "phone",
        enableVideo: false,
        Gateway: { ip: "172.16.0.151", port: "42004" },
        Stunserver: { ip: "", port: "3478" },
        Turnserver: { ip: "", port: "3478", user: "", pwd: "" },
        AppData: { applicationID: "xxxx12345", applicationUA: "sdkClient-3.0.0", appInstanceID: appInstanceId },
        disableResiliency: false
    };

    const onCallListener = crearCallListener();

    if (avaya.setConfiguration(config, onConfigChanged, onRegistrationStateChanged, onCallListener, null) === "AWL_MSG_SETCONFIG_SUCCESS") {
        console.log("Configuración del SDK exitosa.");
        // Solicitar acceso al micrófono y luego iniciar sesión
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            avaya.logIn($("#extn").val(), $("#pwd").val(), "true", stream);
        }).catch(err => {
            console.error("Error al acceder al micrófono:", err);
            alert("No se pudo acceder al micrófono. Por favor, verifique los permisos.");
        });
    } else {
        console.error("Fallo al configurar el SDK de Avaya.");
    }
}

/**
 * Cierra la sesión del usuario en el SDK de Avaya.
 */
function cerrarSesion() {
    avaya.logOut();
    $('#login').show();
    $('#dialer').hide();
}

/**
 * Realiza una nueva llamada saliente en el canal actual si está libre.
 */
function realizarLlamada() {
    const canalActual = canales[currentChannel];
    const numeroADiscar = $("#pantalla").val().trim();

    if (!numeroADiscar) {
        alert("Por favor, ingrese un número para llamar.");
        return;
    }

    if (canalActual.callObj === null) {
        canalActual.callObj = avaya.makeCall(numeroADiscar, "audio");
        if (canalActual.callObj !== null) {
            canalActual.estado = 4; // Estado: Saliente (marcando)
            console.log(`Iniciando llamada a ${numeroADiscar}`);
            // audioTono.play();
        } else {
            alert("No fue posible realizar la llamada.");
        }
    } else {
        alert("El canal actual está ocupado. Seleccione otro canal o finalice la llamada activa.");
    }
    actualizarVistaCanales();
}

/**
 * Cuelga la llamada activa o entrante en el canal actual.
 */
function colgarLlamada() {
    const canalActual = canales[currentChannel];
    if (canalActual.callObj) {
        avaya.cancelCall(canalActual.callObj.getCallId());
        // El estado se actualizará a 0 en el evento onCallTerminate
    }
    // audioRing.pause();
    // audioTono.pause();
}

/**
 * Transfiere la llamada del canal actual a una nueva extensión.
 */
function transferirLlamada() {
    const canalActual = canales[currentChannel];
    const numeroTransferencia = $("#inpTrans").val().trim();

    if (numeroTransferencia === "") {
        alert("Se requiere un número de extensión para realizar una transferencia.");
        return;
    }
    if (canalActual.estado === 1) { // Solo se puede transferir una llamada activa
        avaya.transferCall(numeroTransferencia, canalActual.callObj.getCallId(), "unAttended");
    } else {
        alert("No hay una llamada activa en este canal para transferir.");
    }
}

/**
 * Pone o quita la llamada del canal actual del estado de espera (Hold).
 * @param {Event} e - El objeto del evento click.
 */
function ponerEnEspera(e) {
    const canalActual = canales[currentChannel];
    const boton = e.target;

    if (!canalActual.callObj || (canalActual.estado !== 1 && canalActual.estado !== 2)) {
        return; // No hacer nada si no hay llamada activa o en espera
    }

    if (boton.classList.contains('hold')) { // Quitar de espera (Unhold)
        avaya.doUnHold(canalActual.callObj.getCallId());
        canalActual.estado = 1;
        boton.classList.remove('hold');
    } else { // Poner en espera (Hold)
        avaya.doHold(canalActual.callObj.getCallId());
        canalActual.estado = 2;
        boton.classList.add('hold');
    }
    actualizarVistaCanales();
}

/**
 * Silencia o activa el micrófono para la llamada del canal actual.
 * @param {Event} e - El objeto del evento click.
 */
function silenciarLlamada(e) {
    const canalActual = canales[currentChannel];
    const boton = e.target;

    if (!canalActual.callObj || canalActual.estado !== 1) {
        return; // Solo se puede silenciar una llamada activa
    }

    if (boton.classList.contains('hold')) { // Quitar silencio (Unmute)
        avaya.doUnMute(canalActual.callObj.getCallId());
        boton.classList.remove('hold');
    } else { // Silenciar (Mute)
        avaya.doMute(canalActual.callObj.getCallId());
        boton.classList.add('hold');
    }
}


// ===================================================================================
// Manejadores de Eventos del SDK (Callbacks)
// ===================================================================================

/**
 * Callback que se ejecuta cuando la configuración del SDK cambia.
 * @param {object} resp - Objeto de respuesta del SDK.
 */
function onConfigChanged(resp) {
    console.log(`onConfigChanged :: Resultado = ${resp.result}, Razón = ${resp.reason}`);
}

/**
 * Callback que maneja los cambios en el estado de registro (login, logout, fallos).
 * @param {object} resp - Objeto de respuesta del SDK.
 */
function onRegistrationStateChanged(resp) {
    console.log(`onRegistrationStateChange :: Resultado = ${resp.result}, Razón = ${resp.reason}`);
    const razonTraducida = razonDesconexion[resp.reason] || resp.reason;

    switch (resp.result) {
        case "AWL_MSG_LOGIN_SUCCESS":
            $('#login').hide();
            $('#dialer').show();
            break;

        case "AWL_MSG_FAIL_OVER_SUCCESS":
        case "AWL_MSG_FAIL_BACK_SUCCESS":
        case "AWL_MSG_RELOGGED_IN":
            $('#msgText').text(''); // Limpiar mensajes de estado
            break;

        case "AWL_MSG_LOGIN_FAILED":
        case "AWL_MSG_FAIL_OVER_FAILED":
        case "AWL_MSG_FAIL_BACK_FAILED":
        case "AWL_MSG_LOGIN_WEBSOCKET_FAILURE":
            alert(razonTraducida);
            cerrarSesion();
            break;

        default:
             console.log("Estado de registro no manejado:", resp.result);
             break;
    }
}

/**
 * Fábrica que crea el objeto listener para los eventos de llamada.
 * @returns {object} Un objeto con los manejadores para los eventos de llamada.
 */
function crearCallListener() {
    
    /**
     * Encuentra el índice de un canal basado en el ID de la llamada.
     * @param {string} callId - El ID de la llamada a buscar.
     * @returns {number} El índice del canal, o -1 si no se encuentra.
     */
    const findChannelByCallId = (callId) => {
        return canales.findIndex(canal => canal.callObj && canal.callObj.getCallId() === callId);
    };

    /**
     * Maneja la llegada de una nueva llamada.
     * @param {string} callId - ID de la nueva llamada.
     * @param {object} callObj - Objeto de la llamada del SDK.
     */
    const _onNewIncomingCall = (callId, callObj) => {
        const canalVacioIndex = canales.findIndex(c => c.estado === 0);

        if (canalVacioIndex !== -1) {
            console.log("Nueva llamada entrante asignada al canal:", canalVacioIndex);
            // audioRing.play();
            const numero = callObj.getFarEndNumber();
            $("#msgText").html(`&lt;- Llamada de ${callObj.getFarEndName()} (${numero})`);
            
            canales[canalVacioIndex].callObj = callObj;
            canales[canalVacioIndex].estado = 3; // Estado: Entrante
            actualizarVistaCanales();
        } else {
            console.warn("No hay canales libres para recibir la nueva llamada. Se rechazará.");
            // Opcional: Rechazar la llamada automáticamente si no hay canales
            // avaya.cancelCall(callId);
        }
    };

    /**
     * Maneja los cambios de estado de una llamada existente (conectada, en progreso, etc.).
     * @param {string} callId - ID de la llamada que cambió de estado.
     * @param {object} callObj - Objeto de la llamada.
     * @param {object} event - Información adicional del evento.
     */
    const _onCallStateChange = (callId, callObj, event) => {
        const channelIndex = findChannelByCallId(callId);
        if (channelIndex === -1) return; // No se encontró el canal para esta llamada

        const canal = canales[channelIndex];
        console.log(`Cambio de estado en canal ${channelIndex}: ${callObj.getCallState()}`);
        
        switch (callObj.getCallState()) {
            case "AWL_MSG_CALL_CONNECTED":
                // audioRing.pause();
                // audioTono.pause();
                canal.estado = 1; // Estado: En llamada
                break;
            
            case "AWL_MSG_CALL_RINGING": // Llamada saliente está timbrando en el destino
                // audioTono.play();
                break;

            case "AWL_MSG_CALL_DISCONNECTED": // La otra parte colgó
            case "AWL_MSG_CALL_FAILED": // La llamada falló al establecerse
                // audioRing.pause();
                // audioTono.pause();
                if (event && event.reason) {
                    alert(`Llamada fallida: ${razonDesconexion[event.reason] || event.reason}`);
                }
                // La terminación final la maneja onCallTerminate
                break;
                
            case "AWL_MSG_CALL_FAREND_UPDATE":
                // Actualizar info del contacto si es necesario
                $("#msgText").html(`-&gt; ${callObj.getFarEndName()} (${callObj.getFarEndNumber()})`);
                break;
        }
        actualizarVistaCanales();
    };

    /**
     * Se ejecuta cuando una llamada es terminada por cualquier razón.
     * @param {string} callId - ID de la llamada terminada.
     * @param {string} reason - Razón de la terminación.
     */
    const _onCallTerminate = (callId, reason) => {
        const channelIndex = findChannelByCallId(callId);
        if (channelIndex !== -1) {
            console.log(`Llamada en canal ${channelIndex} terminada. Razón: ${reason}`);
            canales[channelIndex].callObj = null;
            canales[channelIndex].estado = 0; // Estado: Libre
            actualizarVistaCanales();
        }
    };

    return {
        onNewIncomingCall: _onNewIncomingCall,
        onCallStateChange: _onCallStateChange,
        onCallTerminate: _onCallTerminate,
    };
}


// ===================================================================================
// Lógica de la Interfaz de Usuario (UI)
// ===================================================================================

/**
 * Actualiza la apariencia de los canales en la UI según su estado actual.
 */
function actualizarVistaCanales() {
    const dCanales = document.querySelectorAll("#channels > div");
    const iconoLlamada = document.querySelector(".icon-phone-circled");

    dCanales.forEach((element, index) => {
        const canal = canales[index];
        // Asigna la clase de estado por defecto
        element.className = `estado${canal.estado}`;

        // Si el canal es el seleccionado actualmente, aplica estilos adicionales
        if (canal.selected === 1) {
            currentChannel = index; // Asegura que el índice global esté sincronizado
            element.classList.add("ChannelSelected");

            // Lógica para el botón principal de llamar/colgar
            if (canal.estado === 0) { // Libre
                iconoLlamada.classList.remove("off"); // Rojo (colgar)
                iconoLlamada.classList.add("on"); // Verde (llamar)
            } else if (canal.estado === 3) { // Entrante
                iconoLlamada.classList.remove("off"); // Rojo (colgar)
                iconoLlamada.classList.add("on"); // Verde (contestar)
            } else { // Ocupado (en llamada, en espera, saliente)
                iconoLlamada.classList.remove("on"); // Verde
                iconoLlamada.classList.add("off"); // Rojo (colgar)
            }
        }
    });
}

/**
 * Maneja el cambio de canal activo al hacer clic en uno de ellos.
 * @param {number} canalSeleccionadoIndex - El índice del canal al que se hizo clic.
 */
function cambiarCanalActivo(canalSeleccionadoIndex) {
    if (canales[currentChannel].estado === 4) return; // No permitir cambiar de canal mientras se marca

    canales.forEach((canal, index) => {
        if (index === canalSeleccionadoIndex) {
            canal.selected = 1;
            if (canal.estado === 2) { // Si estaba en espera, se reactiva (unhold)
                avaya.doUnHold(canal.callObj.getCallId());
                canal.estado = 1;
            }
            if (canal.estado === 3) { // Si era entrante, se contesta
                avaya.answerCall(canal.callObj.getCallId());
                canal.estado = 1;
            }
        } else {
            canal.selected = 0;
            if (canal.estado === 1) { // Pone en espera las otras llamadas activas
                avaya.doHold(canal.callObj.getCallId());
                canal.estado = 2;
            }
        }
    });

    actualizarVistaCanales();
}

// ===================================================================================
// Asignación de Eventos del DOM (jQuery)
// ===================================================================================
$(document).ready(function() {
    // --- Eventos de Autenticación ---
    $('#loginBtn').click(iniciarSesion);
    $('#logout').click(cerrarSesion);

    // --- Eventos de Acciones de Llamada ---
    $(".icon-phone-circled").click(e => {
        if (e.target.classList.contains("off")) {
            colgarLlamada();
        } else {
            realizarLlamada();
        }
    });

    $(".icon-share").click(transferirLlamada);
    $(".icon-pause").click(ponerEnEspera);
    $(".icon-volume-off").click(silenciarLlamada);
    // $(".icon-edit").click(crearTicket); // Lógica de ticket comentada

    // --- Eventos de Inputs (Enter para actuar) ---
    $("#pantalla").keyup(e => {
        if (e.key === "Enter") realizarLlamada();
    });

    $("#inpTrans").keyup(e => {
        if (e.key === "Enter") transferirLlamada();
    });

    // --- Evento para cambiar de canal ---
    $("#channels").click(e => {
        const targetElement = e.target.closest("div[data-id]");
        if (!targetElement) return;

        const sel = Number(targetElement.getAttribute("data-id"));
        cambiarCanalActivo(sel);
    });

    // --- Estado Inicial ---
    $('#dialer').hide();
    actualizarVistaCanales();
});