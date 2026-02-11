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

    mediaSource = new MediaSource();
    videoPlayer.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', () => {
        try {
            // Usar el mismo codec que el transmisor
            sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs=vp8,opus');
            sourceBuffer.mode = 'sequence';

            sourceBuffer.addEventListener('updateend', () => {
                if (queue.length > 0 && !sourceBuffer.updating) {
                    sourceBuffer.appendBuffer(queue.shift());
                }
            });
        } catch (e) {
            console.error("Error al crear SourceBuffer:", e);
            status.textContent = "Error: Tu navegador no soporta este formato de video.";
        }
    });
}

playOverlay.onclick = () => {
    initMediaSource();
    videoPlayer.play().then(() => {
        isPlaying = true;
        playOverlay.style.display = 'none';
        status.textContent = "Conectado. Esperando video...";
    }).catch(err => {
        console.error("Error de reproducción:", err);
        status.textContent = "Haz clic de nuevo para habilitar el audio/video.";
    });
};

volumeSlider.oninput = (e) => {
    videoPlayer.volume = e.target.value;
};

socket.on('video-stream', (arrayBuffer) => {
    if (!isPlaying || !sourceBuffer) return;

    liveBadge.style.display = 'block';
    status.textContent = "🔴 TRANSMITIENDO EN VIVO";

    if (sourceBuffer.updating || queue.length > 0) {
        queue.push(arrayBuffer);
    } else {
        sourceBuffer.appendBuffer(arrayBuffer);
    }
});

socket.on('reset-client', () => {
    location.reload();
});

socket.on('connect', () => {
    console.log("Conectado al servidor de TV.");
});
