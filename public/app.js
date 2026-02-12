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

function initMediaSource() {
    if (mediaSource) return;
    console.log("🛠️ Creando MediaSource...");
    mediaSource = new MediaSource();
    videoPlayer.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', () => {
        console.log("✅ MediaSource abierto. Configurando buffer...");
        try {
            sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vp8,opus"');
            sourceBuffer.mode = 'sequence';

            sourceBuffer.addEventListener('updateend', () => {
                if (queue.length > 0 && !sourceBuffer.updating) {
                    sourceBuffer.appendBuffer(queue.shift());
                }
            });
        } catch (e) {
            console.error("❌ Error en SourceBuffer:", e);
            status.textContent = "Error de formato: " + e.message;
        }
    });
}

playOverlay.addEventListener('click', () => {
    console.log("🖱️ Intento de sintonización...");
    status.textContent = "Sintonizando señal...";

    initMediaSource();

    // Intentar reproducir (necesario por el gesto del usuario)
    videoPlayer.play().then(() => {
        console.log("✅ Play iniciado con éxito");
    }).catch(err => {
        console.warn("⚠️ Play pendiente/bloqueado (esperando datos):", err.message);
    });

    // Continuar aunque el play esté pendiente (se resolverá cuando llegue video)
    isPlaying = true;
    playOverlay.style.display = 'none';
    socket.emit('request-header');
    console.log("📡 Solicitud de cabecera enviada");
});

volumeSlider.oninput = (e) => {
    videoPlayer.volume = e.target.value;
};

socket.on('video-stream', (arrayBuffer) => {
    if (!isPlaying || !sourceBuffer) return;

    if (liveBadge.style.display !== 'block') {
        console.log("📺 ¡Primer fragmento de video recibido!");
        liveBadge.style.display = 'block';
        status.textContent = "🔴 TRANSMITIENDO EN VIVO";
    }

    try {
        if (sourceBuffer.updating || queue.length > 0) {
            queue.push(arrayBuffer);
        } else {
            sourceBuffer.appendBuffer(arrayBuffer);
        }
    } catch (e) {
        console.warn("⚠️ Buffer lleno o error, reiniciando sintonía...");
        location.reload(); // Forma más segura de limpiar el buffer ante cambios de codec/fuente
    }
});

socket.on('start-broadcast', () => {
    console.log("📡 El transmisor ha reiniciado la señal.");
    if (isPlaying) {
        status.textContent = "Reconectando señal...";
        setTimeout(() => location.reload(), 1500);
    }
});

socket.on('reset-client', () => {
    location.reload();
});

socket.on('connect', () => {
    console.log("Conectado al servidor de TV.");
});
