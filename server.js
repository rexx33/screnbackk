// Configurazione del server Express e Socket.io
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Crea l'app Express
const app = express();
const server = http.createServer(app);

// Configura Socket.io
const io = new Server(server, {
    cors: {
        origin: '*', // In produzione, specifica i domini consentiti
        methods: ['GET', 'POST']
    }
});

// Servi i file statici
app.use(express.static(path.join(__dirname, 'public')));

// Mappa delle stanze e connessioni
const rooms = new Map();

// Gestione delle connessioni WebSocket
io.on('connection', (socket) => {
    console.log(`Nuovo utente connesso: ${socket.id}`);

    // Creazione stanza
    socket.on('create-room', (data) => {
        const roomId = data.roomId;
        socket.join(roomId);
        
        // Memorizza che questo socket è l'host della stanza
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                host: socket.id,
                clients: new Set()
            });
        }
        
        console.log(`Stanza creata: ${roomId} da host ${socket.id}`);
    });

    // Partecipazione a una stanza
    socket.on('join-room', (data) => {
        const roomId = data.roomId;
        
        // Verifica se la stanza esiste
        if (!rooms.has(roomId)) {
            socket.emit('error', { message: 'Stanza non trovata' });
            return;
        }

        // Unisciti alla stanza
        socket.join(roomId);
        const room = rooms.get(roomId);
        room.clients.add(socket.id);
        
        // Notifica l'host della nuova connessione
        socket.to(room.host).emit('join-request', {
            peerId: socket.id,
            roomId: roomId
        });
        
        console.log(`Utente ${socket.id} si è unito alla stanza ${roomId}`);
        
        // Aggiorna il conteggio delle connessioni
        io.to(room.host).emit('connection-count', {
            count: room.clients.size
        });
    });

    // Trasmissione offerta WebRTC
    socket.on('offer', (data) => {
        console.log(`Offerta da ${socket.id} a ${data.peerId}`);
        io.to(data.peerId).emit('offer', {
            peerId: socket.id,
            offer: data.offer
        });
    });

    // Trasmissione risposta WebRTC
    socket.on('answer', (data) => {
        console.log(`Risposta da ${socket.id} a ${data.peerId}`);
        io.to(data.peerId).emit('answer', {
            peerId: socket.id,
            answer: data.answer
        });
    });

    // Trasmissione candidati ICE
    socket.on('ice-candidate', (data) => {
        console.log(`Candidato ICE da ${socket.id} a ${data.peerId}`);
        io.to(data.peerId).emit('ice-candidate', {
            peerId: socket.id,
            candidate: data.candidate
        });
    });

    // Gestione disconnessione
    socket.on('disconnect', () => {
        console.log(`Utente disconnesso: ${socket.id}`);
        
        // Trova e aggiorna tutte le stanze in cui l'utente era presente
        rooms.forEach((room, roomId) => {
            // Se l'host si disconnette, notifica tutti i client
            if (room.host === socket.id) {
                io.to(roomId).emit('host-disconnected');
                rooms.delete(roomId);
                console.log(`Host disconnesso, stanza ${roomId} chiusa`);
            } 
            // Se un client si disconnette, rimuovilo e aggiorna il conteggio
            else if (room.clients.has(socket.id)) {
                room.clients.delete(socket.id);
                io.to(room.host).emit('client-disconnected', {
                    peerId: socket.id
                });
                io.to(room.host).emit('connection-count', {
                    count: room.clients.size
                });
                console.log(`Client ${socket.id} disconnesso dalla stanza ${roomId}`);
            }
        });
    });
});

// Avvia il server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server in ascolto sulla porta ${PORT}`);
});
