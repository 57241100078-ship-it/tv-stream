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
let currentObjectURL = null;

function initMediaSource() {
    console.log("🛠️ Reiniciando motor de video...");

    // Limpieza total de memoria y recursos previos
    if (currentObjectURL) {
        URL.revokeObjectURL(currentObjectURL);
    }

    videoPlayer.pause();
    videoPlayer.src = "";
    videoPlayer.load();

    queue = [];
    sourceBuffer = null;
    mediaSource = new MediaSource();
    currentObjectURL = URL.createObjectURL(mediaSource);
    videoPlayer.src = currentObjectURL;

    mediaSource.addEventListener('sourceopen', () => {
        console.log("✅ Sistema de video listo.");
        try {
            // Usamos un string de codec más genérico para máxima compatibilidad
            const type = 'video/webm; codecs="vp8, opus"';
            sourceBuffer = mediaSource.addSourceBuffer(type);
            sourceBuffer.mode = 'sequence';

            sourceBuffer.addEventListener('updateend', () => {
                if (queue.length > 0 && !sourceBuffer.updating) {
                    sourceBuffer.appendBuffer(queue.shift());
                }
            });

            // IMPORTANTE: Pedir la cabecera SOLO cuando el buffer esté listo
            console.log("📡 Solicitando nueva cabecera...");
            socket.emit('request-header');
        } catch (e) {
            console.error("❌ Error al configurar buffer:", e);
            status.textContent = "Error: Re-intentando conexión...";
            setTimeout(softReset, 2000);
        }
    });
}

function softReset() {
    if (!isPlaying) return;
    status.textContent = "Sincronizando señal...";
    initMediaSource();
}

playOverlay.addEventListener('click', () => {
    isPlaying = true;
    playOverlay.style.display = 'none';
    initMediaSource();

    videoPlayer.onwaiting = () => {
        status.textContent = "Sincronizando señal...";
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
            if (videoPlayer.readyState < 3) {
                console.warn("⏳ Tiempo de espera agotado, refrescando...");
                softReset();
            }
        }, 4000);
    };

    videoPlayer.onplaying = () => {
        clearTimeout(stallTimer);
        status.textContent = "🔴 TRANSMITIENDO EN VIVO";
        liveBadge.style.display = 'block';
    };

    videoPlayer.onerror = () => {
        console.error("❌ Error en el flujo de video.");
        softReset();
    };

    videoPlayer.play().catch(() => { });
});

socket.on('video-stream', (arrayBuffer) => {
    if (!isPlaying || !sourceBuffer) return;

    try {
        if (sourceBuffer.updating || queue.length > 0) {
            queue.push(arrayBuffer);
        } else {
            sourceBuffer.appendBuffer(arrayBuffer);
            if (videoPlayer.paused) videoPlayer.play().catch(() => { });
        }
    } catch (e) {
        console.warn("⚠️ Error de buffer, limpiando...");
        softReset();
    }
});

socket.on('start-broadcast', () => {
    console.log("📡 Cambio de fuente en el estudio.");
    if (isPlaying) {
        status.textContent = "Conectando nueva fuente...";
        setTimeout(softReset, 1000);
    }
});

socket.on('reset-client', () => {
    location.reload();
});

volumeSlider.oninput = (e) => {
    videoPlayer.volume = e.target.value;
};

socket.on('connect', () => {
    console.log("Conectado al servidor.");
});
