const socket = io();
const preview = document.getElementById('preview');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const toggleCamBtn = document.getElementById('toggleCamBtn');
const toggleMicBtn = document.getElementById('toggleMicBtn');
const shareScreenBtn = document.getElementById('shareScreenBtn');
const liveBadge = document.getElementById('liveBadge');
const status = document.getElementById('status');
const audioBar = document.getElementById('audioBar');

let mediaRecorder;
let stream;
let screenStream;
let audioContext;
let analyser;
let dataArray;
let animationId;
let isBroadcasting = false;
let isScreenSharing = false;

async function init() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 854, height: 480 }, // Bajado a 480p para máximo alcance
            audio: true
        });
        preview.srcObject = stream;
        status.textContent = "📡 Estudio listo para transmitir";
        setupAudioMonitor(stream);
    } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        status.textContent = "❌ Error: Activa tu cámara y micrófono.";
    }
}

function setupAudioMonitor(stream) {
    if (audioContext) audioContext.close();
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
        let volume = Math.min(100, (sum / bufferLength / 128) * 100);
        audioBar.style.width = volume + "%";
        audioBar.style.background = volume > 80 ? "#ef4444" : (volume > 50 ? "#fbbf24" : "#10b981");
        animationId = requestAnimationFrame(updateLevel);
    }
    updateLevel();
}

function startRecording() {
    const activeStream = isScreenSharing ? screenStream : stream;

    // Al compartir pantalla, fusionamos el video de la pantalla con el audio del micrófono
    let finalStream = activeStream;
    if (isScreenSharing) {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
            finalStream = new MediaStream([...activeStream.getVideoTracks(), audioTracks[0]]);
        }
    }

    mediaRecorder = new MediaRecorder(finalStream, {
        mimeType: 'video/webm; codecs=vp8,opus',
        videoBitsPerSecond: 800000 // Bajado a 0.8 Mbps para fluidez extrema en móviles
    });

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socket.connected) {
            socket.emit('video-stream', event.data);
        }
    };

    socket.emit('start-broadcast');
    mediaRecorder.start(1000);
}

startBtn.onclick = () => {
    isBroadcasting = true;
    startRecording();
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    liveBadge.style.display = 'block';
    status.textContent = "🔴 TRANSMITIENDO EN VIVO";
};

stopBtn.onclick = () => {
    if (mediaRecorder) mediaRecorder.stop();
    isBroadcasting = false;
    location.reload();
};

toggleCamBtn.onclick = () => {
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        toggleCamBtn.innerHTML = `<i class="fas fa-video"></i> Cam: ${videoTrack.enabled ? 'ON' : 'OFF'}`;
        toggleCamBtn.style.background = videoTrack.enabled ? "#475569" : "#ef4444";
    }
};

toggleMicBtn.onclick = () => {
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        toggleMicBtn.innerHTML = `<i class="fas fa-microphone"></i> Mic: ${audioTrack.enabled ? 'ON' : 'OFF'}`;
        toggleMicBtn.style.background = audioTrack.enabled ? "#475569" : "#ef4444";
    }
};

shareScreenBtn.onclick = async () => {
    try {
        if (!isScreenSharing) {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: { ideal: 15, max: 20 }, // Menos FPS = menos carga para el servidor
                    width: { max: 1280 }
                },
                audio: true
            });

            isScreenSharing = true;
            preview.srcObject = screenStream;
            shareScreenBtn.innerHTML = `<i class="fas fa-camera"></i> MOSTRAR CÁMARA`;
            shareScreenBtn.style.background = "#fbbf24";

            screenStream.getVideoTracks()[0].onended = () => stopScreenShare();

            if (isBroadcasting) {
                mediaRecorder.stop();
                startRecording();
            }
        } else {
            stopScreenShare();
        }
    } catch (err) {
        console.error("Error compartiendo pantalla:", err);
    }
};

function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
    }
    isScreenSharing = false;
    preview.srcObject = stream;
    shareScreenBtn.innerHTML = `<i class="fas fa-desktop"></i> COMPARTIR PANTALLA`;
    shareScreenBtn.style.background = "#6366f1";

    if (isBroadcasting) {
        mediaRecorder.stop();
        startRecording();
    }
}

init();
