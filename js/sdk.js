//ids de llamadas en orden para la opcion de lineas {id:string, estado:number}
//estados: 0:libre, 1:En llamada, 2:espera, 3:entrante, 4:saliente
var currentChannel = 0;
const canales = [
    {callObj: null, estado: 0, selected: 1},
    {callObj: null, estado: 0, selected: 0},
    {callObj: null, estado: 0, selected: 0},
    {callObj: null, estado: 0, selected: 0}
];

// Inicializar la instancia de SDK Client
var cli = new AWL.client();

// Crear un nuevo objeto de audio
const rin = new Audio('http://172.16.250.26/rings/ring.mp3');
rin.loop = true

const tono =  new Audio('http://172.16.250.26/tono.mp3');
tono.loop =  true

const razon={
    "Call Dropped":"Llamada perdida",
    "Call dropped":"Llamada Terminada",
    "Invalid Credentials":"Credenciales incorrectas."
}


//cuando el documento carga
$(document).ready(function() {
    //cuando se da click sobre el boton de logín
    $('#loginBtn').click( function() {
        //Genermos un id para la nueva instancia
        var appInstanceId = cli.generateAppInstanceID();   

        //objeto de configuración WEBRTC
        const cfg = {
            volume: 1.0,
            serviceType: "phone",
            enableVideo: false,
            Gateway: {ip: "172.16.0.151", port:"42004"},
            Stunserver: {ip: "", port: "3478"},
            Turnserver: {ip: "", port: "3478", user: "", pwd: ""},
            AppData: {applicationID : "xxxx12345", applicationUA : "sdkClient-3.0.0", appInstanceID : appInstanceId },
            disableResiliency : false
        };

        //objeto con evento de escucha para una llamada
        const onCallListener = new CallListener();
        
        if(cli.setConfiguration(cfg, onConfigChanged, onRegistrationStateChanged, onCallListener, onAuthTokenRenewed)==="AWL_MSG_SETCONFIG_SUCCESS"){
            console.log("\n\n SETCONFIG SUCCESS\n\n");
        }

        //Loguin dentro de el CLI
        
    // Obtener acceso al micrófono y comenzar análisis de volumen
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 1.5;

        const destination = audioContext.createMediaStreamDestination();
        source.connect(gainNode);
        gainNode.connect(destination);

        cli.setDomElements({ relayAudioTagId: "remoteAudio" });
        cli.logIn($("#extn").val(), $("#pwd").val(), "true", destination.stream);
    }).catch(err => {
        console.warn("No se pudo acceder al micrófono para análisis de volumen:", err);
    });
    
    });
    
    $('#logout').click(function(){
        cli.logOut();
    });

    document.querySelector(".icon-phone-circled").onclick=(e)=>{ 
        if (e.target.classList.contains("off")) colgar()
        else llamar()
    }

    document.querySelector(".icon-share").onclick=(e)=>{ 
        transferir()
    }

    document.querySelector(".icon-edit").onclick=(e)=>{ 
        // CrearTiket()
    }

    document.querySelector(".icon-pause").onclick=(e)=>{ 
        hold(e)
    }

    document.querySelector(".icon-volume-off").onclick=(e)=>{ 
        mute(e)
    }

    document.querySelector("#pantalla").onkeyup=(e)=>{
        if (e.key == "Enter")
            llamar()
    }

    document.querySelector("#inpTrans").onkeyup=(e)=>{
        if (e.key == "Enter")
            transferir()
    }

    document.querySelector("#channels").onclick=( e )=>{
        const sel=Number( e.target.getAttribute("data-id") )
        if (e.target.id == "channels") return
        
        if ( canales[currentChannel].estado == 4 ) return

        canales.forEach((i,index)=>{
            //si el canal es el canal seleccionado
            if (index == sel){
                i.selected = 1
                if (i.estado == 2){ //unhold
                    cli.doUnHold(i.callObj.getCallId())
                    i.estado=1
                }
                if (i.estado == 3) { //responder
                    cli.answerCall(i.callObj.getCallId())
                    // rin.pause()
                    i.estado=1
                }
            }else{ //si el canal no es el seleccionad
                i.selected = 0
                if (i.estado == 1 || i.estado == 4) {
                    cli.doHold(i.callObj.getCallId())
                    i.estado=2
                }
            }
        })

        drawChannels()
    }

    drawChannels()
});

function mute(e){
    const bt = e.target
    if (bt.classList.contains('hold')){
        bt.classList.remove('hold')
        cli.doUnMute(canales[0].callObj.getCallId())
    }else{
        bt.classList.add('hold')
        cli.doMute(canales[0].callObj.getCallId())
    }
}

function hold(e){
    const bt = e.target
    if (bt.classList.contains('hold')){
        bt.classList.remove('hold')
        cli.doUnHold(canales[0].callObj.getCallId())
    }else{
        bt.classList.add('hold')
        cli.doHold(canales[0].callObj.getCallId())
    }
}

function transferir(){
    const llamada=canales[currentChannel]
    if ($("#inpTrans").val().trim() == ""){
        // client.invoke('notify', 'Se requiere un número de extensión para realizar una transferencia.', 'error');
        return;
    }
    cli.transferCall($("#inpTrans").val(), llamada.callObj.getCallId(), "unAttended")
}

function llamar(){
    const llamada=canales[currentChannel]
    if ( llamada.callObj == null ){
        llamada.callObj=cli.makeCall($("#pantalla").val(), "audio");
        llamada.estado=4

        //si la llamada fué satisfactoria
        if(llamada.callObj !== null){
            //llamada.estado=1
            drawChannels()
            
        }else{ 
            //En caso de error de llamada
            // alert("No fué posible realizar la llamada.");
        }
    }else{
        $("#inpAsunto").val("")
        $("#inpDetalle").val("")
        $("#inpTrans").val("")
        if (llamada.estado==3){
            cli.answerCall(llamada.callObj.getCallId())
            llamada.estado=1
            // rin.pause()
        }else{
            // tono.pause()
            console.log("Hay un llamada en curso, para realizar una nueva termine la llamada actual o seleccione otro canal.")
        }
    }
    drawChannels()
}

function colgar(){
    const llamada=canales[currentChannel]
    cli.cancelCall(llamada.callObj.getCallId())
    llamada.estado=0
    // rin.pause()
    // tono.pause()
}


function onConfigChanged(resp){
    console.log('\n onConfigChanged :: RESULT = ' + resp.result);
    console.log('\n onConfigChanged :: reason = ' + resp.reason);
}

function onRegistrationStateChanged(resp){
    console.log('\n onRegistrationStateChange :: RESULT = ' + resp.result);
    console.log('\n onRegistrationStateChange :: reason = ' + resp.reason);
    if(resp.result === "AWL_MSG_LOGIN_SUCCESS") {

        $('#login').hide();
        $('#dialer').show();
        // verForm(false)
        

    }
    else if(resp.result === "AWL_MSG_FAILING_OVER" || resp.result === "AWL_MSG_FAILING_BACK"){
        $("#dialer").hide()    
        alert(razones(resp.reason));
    }
    else if(resp.result === "AWL_MSG_FAIL_OVER_SUCCESS" || resp.result === "AWL_MSG_FAIL_BACK_SUCCESS" || resp.result === "AWL_MSG_RELOGGED_IN"){
        $('#msgText').text('');
    }
    else if(resp.result === "AWL_MSG_FAIL_OVER_FAILED" || resp.result === "AWL_MSG_FAIL_BACK_FAILED" || resp.result === "AWL_MSG_LOGIN_FAILED"){
        $('#dialer').hide();
        alert(razones(resp.reason));
        $('#login').show();
        //tamaño del login
        // client.invoke('popover',{
        //     height: loginHeight,
        //     width: loginWidth
        // } )
    }
    else{
        $('#dialer').hide();
        console.log("!!! SE CERRO!!!")
        console.log(resp.result)
        console.log("******************")
        if ( resp.result == 'AWL_MSG_LOGIN_WEBSOCKET_FAILURE'){
            
        }
    }
}



var CallListener = function () {
    var _onNewIncomingCall = function (callId, callObj, autoAnswer) {
        //window.client.postMessage("b3:Llamada entrante de " + callObj.getFarEndName() + `( ${numero} )`)
        // client.invoke('popover',{
        //     height: dialHeight,
        //     width: dialwidth
        //   } )

        // rin.play()
        let canalVacio=null

        //buscamos el primer canal vacío
        for (let i=0; i<canales.length; i++){
            if (canales[i].callObj==null){
                canalVacio=i
                break
            }
        }

        if (canalVacio == null){
            console.log("No hay canales vacío para recibir la llamada")
            return
        }
        
        //conectamos la llamada a un canal        
        console.log("\n onCallStateChanged : Nuevo objeto entrante agregado");

        
        const numero = callObj.getFarEndNumber()

        $("#msgText").html("<- " + callObj.getFarEndName() + ` ( ${numero} )` )
        canales[canalVacio].callObj =callObj
        canales[canalVacio].estado=3

    };
    var _onCallStateChange = function (callId, callObj, event) {
       const llamada = canales[currentChannel]

        switch (callObj.getCallState()) {
            case "AWL_MSG_CALL_PROGRESSING":
                //tono.pause()
                break;
            case "AWL_MSG_CALL_IDLE":
                break;
            case "AWL_MSG_CALL_CONNECTED":
                //tono.pause()
                //rin.pause()
                console.log(" - - - - - -  HABLANDO - - - - - ")
                // verForm(true)
                break;
            case "AWL_MSG_CALL_RINGING":
                //tono.play()
                break;
            case "AWL_MSG_CALL_DISCONNECTED":
                console.log(" - - - - - -  DEJANDO DE HABLAR - - - - - ")
                canales[currentChannel].estado=0
                console.log("ESTADO ", canales[currentChannel])
                // verForm(false)
                break;
            case "AWL_MSG_CALL_FAILED":
                
                console.log("!!!!! Fallo !!!!")
                console.log(event)
                console.log( "!!!!!!!")
                //rin.pause()

                if(llamada.callObj !== null){
                    delete llamada.callObj;
                    llamada.callObj = null;
                    drawChannels()
                }				
                break;
            case "AWL_MSG_CALL_INCOMING":
                
                const numero = callObj.getFarEndNumber()
                $("#msgText").html("<- " + callObj.getFarEndName() + ` ( ${numero} )` )
                // getCliente(numero)
                
                break;
            case "AWL_MSG_CALL_HELD":
                break;
            case "AWL_MSG_CALL_FAREND_UPDATE":
                if (llamada.callObj != null){
                    $("#msgText").html("-> " +llamada.callObj.getFarEndName() + ` ( ${llamada.callObj.getFarEndNumber()} )` )
                    console.log("onCallStateChange  : Numero remoto = "+llamada.callObj.getFarEndNumber());
                    console.log("onCallStateChange  : Nombre = "+llamada.callObj.getFarEndName());
                    console.log("onCallStateChange  : URI = "+llamada.callObj.getSipUri());
                }
                break;
            default:
                console.log("\n CallState doesn't match");

        }
    };
    
    var _onCallTerminate = function(callId, reason){
        //rin.pause()
        // currentClient=undefined
        for(let i=0; i<canales.length; i++){
            if(canales[i].callObj != null)
                if(canales[i].callObj.getCallId() == callId){
                    delete canales[i].callObj
                    canales[i].callObj=null
                    canales[i].estado=0
                    drawChannels()
                }
        }
        console.log("\n Llamada terminada: ");
    };


    return{
        onNewIncomingCall: _onNewIncomingCall,
        onCallStateChange: _onCallStateChange,
        onCallTerminate: _onCallTerminate,
    };

};

  
function drawChannels() {
    const dCanales = document.querySelectorAll("#channels>div")
    dCanales.forEach((element, index) => {
        element.className = "estado"+canales[index].estado
        if (canales[index].selected==1) {
            const icono=document.querySelector(".icon-phone-circled")
            currentChannel=index

            element.className = "ChannelSelected"
            //si hay una llamada en ese canal
            if (canales[index].callObj != null){
                if (canales[index].estado == 3){
                    element.className = "estado3"
                    icono.classList.remove("off")
                    icono.classList.add("on")
                }else{
                    icono.classList.add("off")
                }
                
            }else{ //si no hay llamada en este canal
                //colocamos el icono de llamada en llamar
                icono.classList.remove("off")
                icono.classList.add("on")
            }
        }
    });
    
}

