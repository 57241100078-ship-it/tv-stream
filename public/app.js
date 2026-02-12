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

function initMediaSource() {
    console.log("🛠️ Inicializando Sistema de Video...");

    // Limpiar previo si existe
    if (mediaSource && mediaSource.readyState === 'open') {
        mediaSource.endOfStream();
    }

    mediaSource = new MediaSource();
    videoPlayer.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', () => {
        console.log("✅ Conexión de video abierta.");
        try {
            // Usamos VP8 y Opus (estándar WebM)
            sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vp8,opus"');
            sourceBuffer.mode = 'sequence';

            sourceBuffer.addEventListener('updateend', () => {
                if (queue.length > 0 && !sourceBuffer.updating) {
                    sourceBuffer.appendBuffer(queue.shift());
                }
            });
        } catch (e) {
            console.error("❌ Error de compatibilidad:", e);
            status.textContent = "Error: Navegador no compatible con este flujo.";
        }
    });
}

function softReset() {
    console.log("� Re-sintonizando canal (Soft Reset)...");
    queue = [];
    sourceBuffer = null;
    initMediaSource();
    socket.emit('request-header');
}

playOverlay.addEventListener('click', () => {
    status.textContent = "Sintonizando señal...";
    initMediaSource();

    videoPlayer.onwaiting = () => {
        status.textContent = "Cargando señal...";
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
            if (videoPlayer.readyState < 3) {
                console.warn("⚠️ Señal perdida, re-sintonizando...");
                softReset();
            }
        }, 3500);
    };

    videoPlayer.onplaying = () => {
        clearTimeout(stallTimer);
        status.textContent = "🔴 TRANSMITIENDO EN VIVO";
    };

    videoPlayer.onerror = () => {
        console.warn("❌ Error en video, re-intentando...");
        softReset();
    };

    videoPlayer.play().then(() => {
        console.log("✅ Play activo");
    }).catch(err => {
        console.warn("⚠️ Play retenido:", err.message);
    });

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
        }
    } catch (e) {
        console.warn("⚠️ Error de buffer, re-sintonizando...");
        softReset();
    }
});

socket.on('start-broadcast', () => {
    console.log("📡 Nueva fuente detectada");
    if (isPlaying) softReset();
});

socket.on('reset-client', () => {
    location.reload();
});

volumeSlider.oninput = (e) => {
    videoPlayer.volume = e.target.value;
};

socket.on('connect', () => {
    console.log("Conectado al servidor de TV.");
});
