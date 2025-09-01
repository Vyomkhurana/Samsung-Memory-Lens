  const recordBtn = document.getElementById("recordBtn");
    const transcriptDiv = document.getElementById("transcript");

    let mediaRecorder;
    let audioChunks = [];
    let silenceTimer;
    let audioContext, analyser, source, dataArray;

    async function startRecording() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

        audioChunks = [];
        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");

            try {
                const response = await fetch("/transcribe", {
                    method: "POST",
                    body: formData
                });
                const data = await response.json();
                transcriptDiv.textContent = data.transcript || "No speech detected.";
            } catch (err) {
                transcriptDiv.textContent = "⚠️ Error transcribing audio.";
                console.error(err);
            }
        };

        mediaRecorder.start();
        recordBtn.innerHTML = '<i class="bi bi-ear-fill"></i>';

        // 🎯 Setup silence detection
        audioContext = new AudioContext();
        source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        dataArray = new Uint8Array(analyser.fftSize);
        source.connect(analyser);

        detectSilence(() => {
            stopRecording();
        }, 2000, 0.02); // stop if silence > 2s
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
            recordBtn.innerHTML = '<i class="bi bi-mic-fill"></i>';
            if (audioContext) audioContext.close();
        }
    }

    function detectSilence(onSilence, timeout = 2000, threshold = 0.02) {
        let silenceStart = performance.now();

        function check() {
            analyser.getByteFrequencyData(dataArray);
            let average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

            if (average < threshold * 256) {
                if (performance.now() - silenceStart > timeout) {
                    onSilence();
                    return;
                }
            } else {
                silenceStart = performance.now();
            }
            requestAnimationFrame(check);
        }
        check();
    }

    recordBtn.addEventListener("click", () => {
        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            startRecording();
        } else {
            stopRecording();
        }
    });


    document.getElementById('recordBtn').addEventListener('click', function() {
    this.classList.toggle('pulse');
    // You can add logic here to start or stop recording
});