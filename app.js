// Variabili globali
let roomId = null;
let isHost = false;
let connections = [];
let localStream = null;
let peerConnections = {};
let socket = null;
let connectionCounter = 0;

// Configurazione ICE server per WebRTC
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Elementi DOM
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const copyRoomIdBtn = document.getElementById('copyRoomIdBtn');
const startSharingBtn = document.getElementById('startSharingBtn');
const stopSharingBtn = document.getElementById('stopSharingBtn');
const screenVideo = document.getElementById('screenVideo');
const statusDiv = document.getElementById('status');
const connectionCountDiv = document.getElementById('connectionCount');
const createRoomSection = document.getElementById('createRoomSection');
const hostSection = document.getElementById('hostSection');
const joinRoomSection = document.getElementById('joinRoomSection');

// Inizializzazione Socket.IO
function initializeSocketConnection() {
    // Sostituisci con l'URL del tuo server di segnalazione
    const serverUrl = 'https://your-signaling-server.com';
    
    // Nella versione reale, questo connette al server
    // socket = io(serverUrl);
    
    // Per questa demo, simuliamo il comportamento
    return {
        emit: (event, data) => {
            console.log(`Emesso evento ${event}:`, data);
        },
        on: (event, callback) => {
            console.log(`Registrato listener per evento ${event}`);
        }
    };
}

// Funzione per generare un ID stanza casuale
function generateRoomId() {
    return Math.random().toString(36).substring(2, 10);
}

// Visualizza status
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
    statusDiv.classList.remove('hidden');
    
    setTimeout(() => {
        statusDiv.classList.add('hidden');
    }, 5000);
}

// Crea una stanza
createRoomBtn.addEventListener('click', () => {
    roomId = generateRoomId();
    isHost = true;
    
    // Mostra ID stanza e sezione host
    roomIdDisplay.textContent = roomId;
    createRoomSection.classList.add('hidden');
    hostSection.classList.remove('hidden');
    joinRoomSection.classList.add('hidden');
    startSharingBtn.disabled = false;
    
    showStatus('Stanza creata con successo!', 'success');
    
    // Inizializza la connessione WebRTC
    socket = initializeSocketConnection();
    setupWebRTC();
});

// Configura WebRTC
function setupWebRTC() {
    if (isHost) {
        // L'host ascolta le richieste di connessione
        socket.on('join-request', handleJoinRequest);
        
        // Simula nuove connessioni (solo per demo)
        simulateNewConnections();
    } else {
        // Il client invia richiesta di connessione
        socket.emit('join-room', { roomId });
        
        // Ascolta l'offerta dall'host
        socket.on('offer', handleOffer);
    }
    
    // Gestione dei messaggi ICE
    socket.on('ice-candidate', handleIceCandidate);
}

// Funzione per simulare nuove connessioni (solo per demo)
function simulateNewConnections() {
    const interval = setInterval(() => {
        if (isHost && connectionCounter < 5) {
            connectionCounter++;
            connectionCountDiv.textContent = `Utenti collegati: ${connectionCounter}`;
            showStatus(`Nuovo utente connesso!`, 'info');
        }
    }, 10000);
}

// Gestione richiesta di connessione (per l'host)
function handleJoinRequest(data) {
    const peerId = data.peerId;
    
    // Crea una nuova connessione peer per il client
    const peerConnection = new RTCPeerConnection(iceServers);
    peerConnections[peerId] = peerConnection;
    
    // Aggiungi tracce locali
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }
    
    // Gestione candidati ICE
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                peerId: peerId,
                candidate: event.candidate
            });
        }
    };
    
    // Crea un'offerta
    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            socket.emit('offer', {
                peerId: peerId,
                offer: peerConnection.localDescription
            });
        })
        .catch(error => {
            console.error('Errore nella creazione dell\'offerta:', error);
            showStatus('Errore nella connessione', 'error');
        });
}

// Gestione dell'offerta (per il client)
function handleOffer(data) {
    const peerConnection = new RTCPeerConnection(iceServers);
    
    // Gestione delle tracce in entrata
    peerConnection.ontrack = (event) => {
        screenVideo.srcObject = event.streams[0];
    };
    
    // Gestione candidati ICE
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                peerId: data.peerId,
                candidate: event.candidate
            });
        }
    };
    
    // Imposta l'offerta remota
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => {
            socket.emit('answer', {
                peerId: data.peerId,
                answer: peerConnection.localDescription
            });
        })
        .catch(error => {
            console.error('Errore nella gestione dell\'offerta:', error);
            showStatus('Errore nella connessione', 'error');
        });
}

// Gestione dei candidati ICE
function handleIceCandidate(data) {
    const peerConnection = peerConnections[data.peerId];
    
    if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
            .catch(error => {
                console.error('Errore nell\'aggiunta del candidato ICE:', error);
            });
    }
}

// Copia ID stanza
copyRoomIdBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomId)
        .then(() => {
            showStatus('ID stanza copiato negli appunti!', 'success');
        })
        .catch(err => {
            showStatus('Impossibile copiare: ' + err, 'error');
        });
});

// Inizia condivisione schermo
startSharingBtn.addEventListener('click', async () => {
    try {
        localStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });
        
        screenVideo.srcObject = localStream;
        startSharingBtn.classList.add('hidden');
        stopSharingBtn.classList.remove('hidden');
        
        showStatus('Condivisione schermo avviata', 'success');
        
        // Aggiungi stream alle connessioni esistenti
        addStreamToConnections();
        
        // Gestisci fine condivisione
        localStream.getTracks()[0].onended = () => {
            stopSharing();
        };
    } catch (err) {
        showStatus('Errore nell\'avvio della condivisione: ' + err.message, 'error');
    }
});

// Aggiungi stream a tutte le connessioni
function addStreamToConnections() {
    if (!localStream) return;
    
    Object.values(peerConnections).forEach(peerConnection => {
        const senders = peerConnection.getSenders();
        
        if (senders.length === 0) {
            // Aggiungi tracce se non esistono
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        } else {
            // Sostituisci tracce esistenti
            senders.forEach((sender, i) => {
                if (localStream.getTracks()[i]) {
                    sender.replaceTrack(localStream.getTracks()[i]);
                }
            });
        }
    });
    
    // Per la demo, simula lo streaming
    simulateStreaming();
}

// Interrompi condivisione
stopSharingBtn.addEventListener('click', stopSharing);

function stopSharing() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        screenVideo.srcObject = null;
        localStream = null;
    }
    
    startSharingBtn.classList.remove('hidden');
    stopSharingBtn.classList.add('hidden');
    showStatus('Condivisione schermo interrotta', 'info');
}

// Unisciti a una stanza
joinRoomBtn.addEventListener('click', () => {
    const inputRoomId = roomIdInput.value.trim();
    
    if (!inputRoomId) {
        showStatus('Inserisci un ID stanza valido', 'error');
        return;
    }
    
    roomId = inputRoomId;
    isHost = false;
    
    // Gestisci UI
    createRoomSection.classList.add('hidden');
    joinRoomSection.classList.add('hidden');
    showStatus('Connessione alla stanza ' + roomId + '...', 'info');
    
    // Inizializza la connessione WebRTC
    socket = initializeSocketConnection();
    setupWebRTC();
    
    // Simula connessione per la demo
    simulateViewerConnection();
});

// Simula connessione per lo spettatore (solo per demo)
function simulateViewerConnection() {
    setTimeout(() => {
        showStatus('Connesso! In attesa che l\'host inizi lo streaming...', 'success');
        
        // Simula ricezione dello stream dopo un po'
        setTimeout(() => {
            createFakeStream();
            showStatus('Stream ricevuto! Visualizzazione in corso...', 'success');
        }, 2000);
    }, 1500);
}

// Simula uno stream (solo per demo)
function simulateStreaming() {
    showStatus('Streaming attivo e pronto per la visualizzazione', 'success');
}

// Crea uno stream finto per la demo
function createFakeStream() {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    
    function drawPlaceholder() {
        ctx.fillStyle = '#3498db';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Streaming Attivo', canvas.width/2, canvas.height/2);
        ctx.font = '24px Arial';
        ctx.fillText('(Demo: contenuto simulato)', canvas.width/2, canvas.height/2 + 50);
    }
    
    drawPlaceholder();
    const stream = canvas.captureStream(30);
    screenVideo.srcObject = stream;
    
    // Aggiorna periodicamente il canvas per simulare uno stream vero
    setInterval(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawPlaceholder();
        const now = new Date();
        ctx.fillText(`Orario attuale: ${now.toLocaleTimeString()}`, canvas.width/2, canvas.height/2 + 100);
    }, 1000);
}
