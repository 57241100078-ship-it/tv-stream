const socket = io();
const videoPlayer = document.getElementById('videoPlayer');
const status = document.getElementById('status');
const liveBadge = document.getElementById('liveBadge');
const playOverlay = document.getElementById('playOverlay');
const volumeSlider = document.getElementById('volumeSlider');

let mediaSource;
let sourceBuffer;
let queue = [];
let isPlaying = false;
let stallTimer;
let resetCount = 0;

function initMediaSource() {
    console.log("🛠️ Re-inicializando motor de video...");

    // Limpieza profunda de recursos
    if (mediaSource) {
        try {
            if (mediaSource.readyState === 'open') mediaSource.endOfStream();
        } catch (e) { }
    }

    videoPlayer.pause();
    videoPlayer.src = "";
    videoPlayer.load();

    mediaSource = new MediaSource();
    videoPlayer.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', () => {
        console.log("✅ Canal de datos abierto");
        try {
            sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vp8,opus"');
            sourceBuffer.mode = 'sequence';

            sourceBuffer.addEventListener('updateend', () => {
                if (queue.length > 0 && !sourceBuffer.updating) {
                    sourceBuffer.appendBuffer(queue.shift());
                }
            });
        } catch (e) {
            console.error("❌ Codec no soportado:", e);
            status.textContent = "Error: Formato no compatible.";
        }
    });
}

function softReset() {
    console.log("🔄 Re-sintonizando...");
    queue = [];
    sourceBuffer = null;
    initMediaSource();

    // Reintentar pedir cabecera un par de veces por si el servidor no la tiene lista
    socket.emit('request-header');
    setTimeout(() => { if (!sourceBuffer) socket.emit('request-header'); }, 1000);
    setTimeout(() => { if (!sourceBuffer) socket.emit('request-header'); }, 2000);
}

playOverlay.addEventListener('click', () => {
    status.textContent = "Conectando...";
    initMediaSource();

    videoPlayer.onwaiting = () => {
        status.textContent = "Buscando señal...";
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
            if (videoPlayer.readyState < 3) {
                resetCount++;
                if (resetCount > 2) location.reload(); // Último recurso
                else softReset();
            }
        }, 4000);
    };

    videoPlayer.onplaying = () => {
        clearTimeout(stallTimer);
        resetCount = 0;
        status.textContent = "🔴 TRANSMITIENDO EN VIVO";
    };

    videoPlayer.onerror = () => {
        console.error("❌ Error de video detectado");
        softReset();
    };

    videoPlayer.play().catch(() => console.log("Play diferido"));

    isPlaying = true;
    playOverlay.style.display = 'none';
    socket.emit('request-header');
});

socket.on('video-stream', (arrayBuffer) => {
    if (!isPlaying || !sourceBuffer) return;

    if (liveBadge.style.display !== 'block') {
        liveBadge.style.display = 'block';
    }

    try {
        if (sourceBuffer.updating || queue.length > 0) {
            queue.push(arrayBuffer);
        } else {
            sourceBuffer.appendBuffer(arrayBuffer);
            if (videoPlayer.paused && videoPlayer.readyState >= 2) {
                videoPlayer.play().catch(() => { });
            }
        }
    } catch (e) {
        console.warn("⚠️ Buffer corrupto, re-sincronizando...");
        softReset();
    }
});

socket.on('start-broadcast', () => {
    console.log("📡 El estudio cambió de cámara/pantalla");
    if (isPlaying) {
        status.textContent = "Cambiando fuente...";
        setTimeout(softReset, 800);
    }
});

socket.on('reset-client', () => {
    location.reload();
});

volumeSlider.oninput = (e) => {
    videoPlayer.volume = e.target.value;
};

socket.on('connect', () => console.log("Socket conectado."));
