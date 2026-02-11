const socket = io();
const preview = document.getElementById('preview');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const liveBadge = document.getElementById('liveBadge');
const status = document.getElementById('status');
const audioBar = document.getElementById('audioBar');

let mediaRecorder;
let stream;
let audioContext;
let analyser;
let dataArray;
let animationId;

async function init() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: true
        });
        preview.srcObject = stream;
        status.textContent = "📡 Estudio listo para transmitir";

        // Configurar monitoreo de audio (voz)
        setupAudioMonitor(stream);

    } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        status.textContent = "❌ Error: Activa tu cámara y micrófono.";
    }
}

function setupAudioMonitor(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    function updateLevel() {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        let average = sum / bufferLength;
        let volume = Math.min(100, (average / 128) * 100);
        audioBar.style.width = volume + "%";

        // Color de la barra según volumen
        if (volume > 80) audioBar.style.background = "#ef4444";
        else if (volume > 50) audioBar.style.background = "#fbbf24";
        else audioBar.style.background = "#10b981";

        animationId = requestAnimationFrame(updateLevel);
    }
    updateLevel();
}

startBtn.onclick = () => {
    socket.emit('start-broadcast');

    mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm; codecs=vp8,opus',
        videoBitsPerSecond: 1500000 // 1.5 Mbps para mayor nitidez
    });

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            socket.emit('video-stream', event.data);
        }
    };

    mediaRecorder.start(1000);

    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    liveBadge.style.display = 'block';
    status.textContent = "🔴 TRANSMITIENDO EN VIVO";
};

stopBtn.onclick = () => {
    mediaRecorder.stop();
    cancelAnimationFrame(animationId);
    location.reload();
};

init();
