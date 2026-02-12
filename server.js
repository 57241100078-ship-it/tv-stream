const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Variable para la cabecera del stream de video
let videoHeader = null;

io.on('connection', (socket) => {
    console.log('Nuevo usuario conectado:', socket.id);

    // El Espectador pide la señal
    socket.on('request-header', () => {
        if (videoHeader) {
            socket.emit('video-stream', videoHeader);
            console.log('📡 Cabecera enviada al espectador');
        }
    });

    // El Transmisor avisa que inicia
    socket.on('start-broadcast', () => {
        console.log('🔴 TRANSMISIÓN DE TV INICIADA');
        videoHeader = null;
        socket.broadcast.emit('reset-client');
    });

    // Recibir video desde el Transmisor y reenviar
    socket.on('video-stream', (blob) => {
        if (!videoHeader) {
            videoHeader = blob;
            console.log('✅ Cabecera de video capturada');
        }
        socket.broadcast.emit('video-stream', blob);
    });

    socket.on('disconnect', () => {
        // console.log('Usuario desconectado');
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log('\n==================================================');
    console.log('          📺  TU CANAL DE TV ESTÁ EN VIVO  📺');
    console.log('==================================================');
    console.log(`\nESTADO: Listo en el puerto ${PORT}`);
    console.log('\nPara probar localmente:');
    console.log(`👉 http://localhost:${PORT}/broadcaster.html`);
    console.log('\n==================================================');
});

