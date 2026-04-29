<template>
    <div class="scanner-container">
        <!-- Header Minimalista pero Impactante -->
        <header class="d-flex justify-content-between align-items-center">
            <div>
                <h1 class="header-title fw-bold mb-0 text-accent">
                    SCAN<span class="fw-light">IFY</span>
                </h1>
                <div class="font-tech opacity-50" style="font-size: 0.7rem">
                    VERSION_2.0 // CODERTEC
                </div>
            </div>
            <div
                :class="[
                    'status-pill font-tech fw-bold',
                    scanning ? 'status-online' : 'status-offline',
                ]"
            >
                <i class="fa-solid fa-circle-dot me-1"></i>
                {{ scanning ? "ONLINE" : "STANDBY" }}
            </div>
        </header>

        <!-- Main Interface -->
        <div class="row g-3 flex-grow-1">
            <!-- Scanner Viewport -->
            <div class="col-12">
                <div class="tech-card p-2">
                    <div class="scanner-box">
                        <!-- Muted es requerido en móviles para auto-play de video -->
                        <video ref="video" autoplay playsinline muted></video>

                        <!-- overlay con las clases decorativas integradas -->
                        <div class="overlay">
                            <!-- Brackets decorativos de enfoque -->
                            <div class="focus-bracket top-left"></div>
                            <div class="focus-bracket top-right"></div>
                            <div class="focus-bracket bottom-left"></div>
                            <div class="focus-bracket bottom-right"></div>

                            <div
                                class="frame"
                                :class="{ 'border-success': successCount > 0 }"
                            >
                                <!-- Efecto láser solo visible cuando escanea -->
                                <div v-if="scanning" class="scan-overlay"></div>
                            </div>
                        </div>
                    </div>

                    <select
                        v-model="selectedCamera"
                        @change="restartScanner"
                        class="form-select mt-3 tech-select"
                        v-if="cameras.length > 1"
                    >
                        <option
                            v-for="cam in cameras"
                            :key="cam.deviceId"
                            :value="cam.deviceId"
                        >
                            {{ cam.label || "Cámara trasera" }}
                        </option>
                    </select>

                    <div class="p-3 d-flex gap-2">
                        <button
                            v-if="!scanning"
                            class="btn btn-cyber-main flex-grow-1"
                            @click="startScanner"
                        >
                            <i class="fa-solid fa-camera me-2"></i> INICIAR
                        </button>
                        <button
                            v-else
                            class="btn btn-cyber-danger flex-grow-1"
                            @click="stopScanner"
                        >
                            <i class="fa-solid fa-stop me-2"></i> DETENER
                        </button>
                    </div>
                </div>
            </div>

            <!-- History/Settings Section -->
            <div class="col-12">
                <div class="tech-card mb-4" v-if="result">
                    <div
                        class="p-3 border-bottom border-secondary d-flex justify-content-between align-items-center"
                    >
                        <h6 class="mb-0 font-tech fw-bold">
                            <i class="fa-solid fa-barcode text-accent me-2"></i>
                            ÚLTIMO RESULTADO
                        </h6>
                    </div>

                    <div class="history-list">
                        <div class="history-item">
                            <div
                                class="d-flex justify-content-between align-items-center"
                            >
                                <div class="flex-grow-1 overflow-hidden">
                                    <div
                                        class="font-tech text-accent scanned-value fw-bold text-truncate"
                                    >
                                        {{ result }}
                                    </div>
                                </div>
                                <button
                                    class="btn btn-dark border-secondary rounded-circle ms-3 copy-btn"
                                    @click="copyToClipboard"
                                >
                                    <i
                                        :class="
                                            copied
                                                ? 'fa-solid fa-check text-success'
                                                : 'fa-regular fa-copy'
                                        "
                                    ></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { BrowserMultiFormatReader } from "@zxing/browser";

export default {
    data() {
        return {
            codeReader: null,
            cameras: [],
            selectedCamera: null,
            result: null,
            stream: null,
            scanning: false,
            successCount: 0,
            copied: false,
        };
    },

    async mounted() {
        await this.initCamera();
    },

    methods: {
        async initCamera() {
            try {
                // Solicitar permiso inicial y guardarlo en una variable temporal
                const tempStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" },
                });
                const devices = await navigator.mediaDevices.enumerateDevices();

                // 🔥 CRÍTICO: Detener el stream temporal para liberar el hardware de la cámara
                // Esto previene el error de "cámara ocupada" en dispositivos S24 y similares
                tempStream.getTracks().forEach((track) => track.stop());

                this.cameras = devices.filter((d) => d.kind === "videoinput");

                const back = this.cameras.find(
                    (c) =>
                        c.label.toLowerCase().includes("back") ||
                        c.label.toLowerCase().includes("trasera"),
                );

                this.selectedCamera = back
                    ? back.deviceId
                    : this.cameras[0]?.deviceId;
            } catch (err) {
                console.error("Error al acceder a la cámara:", err);
            }
        },

        async startScanner() {
            this.stopScanner();

            // 🔥 Pausa breve para permitir que Android (especialmente Samsung S24) libere el hardware
            await new Promise((resolve) => setTimeout(resolve, 300));

            this.codeReader = new BrowserMultiFormatReader();

            const constraints = {
                video: {
                    deviceId: this.selectedCamera
                        ? { exact: this.selectedCamera }
                        : undefined,
                    facingMode: this.selectedCamera ? undefined : "environment",
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
            };

            try {
                this.stream =
                    await navigator.mediaDevices.getUserMedia(constraints);
                this.$refs.video.srcObject = this.stream;

                // Esperar a que el video esté listo para evitar metadata errors
                await new Promise((resolve) => {
                    this.$refs.video.onloadedmetadata = () => {
                        this.$refs.video.play();
                        resolve();
                    };
                });

                const track = this.stream.getVideoTracks()[0];

                try {
                    await track.applyConstraints({
                        advanced: [{ zoom: 2.5 }, { focusMode: "continuous" }],
                    });
                } catch (e) {
                    console.warn(
                        "Zoom/Focus dinámico no soportado en este dispositivo",
                    );
                }

                this.scanning = true;
                this.successCount = 0;
                this.decodeLoop();
            } catch (err) {
                console.error("Error iniciando el escáner:", err);
            }
        },

        async decodeLoop() {
            if (!this.scanning) return;

            try {
                const canvas = this.captureFrame();
                const result = await this.codeReader.decodeFromCanvas(canvas);

                if (result) {
                    this.successCount++;

                    // Requiere 2 lecturas consecutivas para evitar falsos positivos
                    if (this.successCount >= 2) {
                        this.result = result.getText();

                        // 🔥 Feedback Háptico para móviles (Vibración)
                        if (navigator.vibrate) {
                            navigator.vibrate(200);
                        }

                        // Pausa de medio segundo para que el usuario vea que escaneó
                        setTimeout(() => {
                            this.stopScanner();
                        }, 500);
                        return;
                    }
                } else {
                    // Resetea si pierde el código
                    this.successCount = 0;
                }
            } catch (e) {
                // ZXing arroja errores constantes cuando no encuentra código, es normal ignorarlos
            }

            requestAnimationFrame(() => this.decodeLoop());
        },

        captureFrame() {
            const video = this.$refs.video;
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d", { willReadFrequently: true });

            const w = video.videoWidth;
            const h = video.videoHeight;

            // Recorte central para mejor enfoque y rendimiento
            const cropW = w * 0.6;
            const cropH = h * 0.4;

            canvas.width = cropW;
            canvas.height = cropH;

            ctx.drawImage(
                video,
                (w - cropW) / 2,
                (h - cropH) / 2,
                cropW,
                cropH,
                0,
                0,
                cropW,
                cropH,
            );

            return canvas;
        },

        stopScanner() {
            this.scanning = false;
            this.successCount = 0;

            if (this.stream) {
                this.stream.getTracks().forEach((t) => t.stop());
                this.stream = null;
            }
            if (this.$refs.video) {
                this.$refs.video.srcObject = null;
            }
            if (
                this.codeReader &&
                typeof this.codeReader.reset === "function"
            ) {
                this.codeReader.reset();
            }
        },

        restartScanner() {
            this.startScanner();
        },

        async copyToClipboard() {
            if (!this.result) return;

            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(this.result);
                } else {
                    // Fallback para móviles/navegadores antiguos
                    let textArea = document.createElement("textarea");
                    textArea.value = this.result;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-999999px";
                    textArea.style.top = "-999999px";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();

                    document.execCommand("copy");
                    textArea.remove();
                }

                this.copied = true;
                setTimeout(() => {
                    this.copied = false;
                }, 2000);
            } catch (error) {
                console.error("Error al copiar al portapapeles", error);
            }
        },
    },

    beforeUnmount() {
        this.stopScanner();
    },
};
</script>

<style lang="scss">
:root {
    --bg-dark: #05070a;
    --card-bg: rgba(17, 21, 28, 0.95);
    --accent-blue: #00d2ff;
    --accent-green: #39ff14;
    --accent-red: #ff395e;
    --text-main: #f0f6fc;
    --border-color: rgba(66, 74, 85, 0.5);
    --glow-blue: rgba(0, 210, 255, 0.3);
}

body {
    font-family: "Space Grotesk", sans-serif;
    background-color: var(--bg-dark);
    background-image:
        radial-gradient(
            circle at 50% -20%,
            rgba(0, 210, 255, 0.15) 0%,
            transparent 60%
        ),
        radial-gradient(
            circle at 50% 120%,
            rgba(57, 255, 20, 0.08) 0%,
            transparent 60%
        );
    color: var(--text-main);
    min-height: 100vh;
    min-height: 100svh;
    margin: 0;
    display: flex;
    flex-direction: column;
}

.scanner-container {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 0.75rem;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
}

/* Header Premium */
header {
    padding: 1rem 0.5rem;
    margin-bottom: 0.5rem;
}

.header-title {
    font-size: 1.75rem;
    letter-spacing: -1.5px;
    text-transform: uppercase;
}

.status-pill {
    padding: 4px 12px;
    border-radius: 50px;
    font-size: 0.7rem;
    transition: all 0.3s ease;
}

.status-online {
    background: rgba(57, 255, 20, 0.1);
    color: var(--accent-green);
    border: 1px solid var(--accent-green);
}

.status-offline {
    background: rgba(255, 255, 255, 0.1);
    color: #888;
    border: 1px solid #555;
}

/* Tech Card */
.tech-card {
    background: var(--card-bg);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border-color);
    border-radius: 28px;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.scanner-box {
    position: relative;
    max-width: 100%;
    height: 45vh;
    min-height: 350px;
    margin: auto;
    background: #000;
    border-radius: 20px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
}

video {
    width: 100%;
    height: 100%;
    object-fit: cover; /* Asegura que el video no se deforme en móviles */
}

.overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.frame {
    position: absolute;
    top: 25%;
    left: 15%;
    width: 70%;
    height: 50%;
    border: 2px solid rgba(0, 210, 255, 0.3);
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 0.2s;
}

/* Laser Line Effect */
.scan-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        to bottom,
        transparent 48%,
        var(--accent-blue) 50%,
        transparent 52%
    );
    background-size: 100% 200%;
    animation: scanAnim 2s linear infinite;
    opacity: 0.8;
    box-shadow: 0 0 15px var(--accent-blue);
}

@keyframes scanAnim {
    0% {
        background-position: 0% 100%;
    }
    100% {
        background-position: 0% -100%;
    }
}

/* Typography & Data */
.font-tech {
    font-family: "JetBrains Mono", monospace;
}
.text-accent {
    color: var(--accent-blue);
    text-shadow: 0 0 15px var(--glow-blue);
}

/* Botones Móviles Grandes */
.btn-cyber-main {
    background: linear-gradient(135deg, var(--accent-blue), #00a8cc);
    border: none;
    color: #000;
    text-transform: uppercase;
    letter-spacing: 2px;
    font-weight: 800;
    padding: 16px;
    border-radius: 16px;
    font-size: 1.1rem;
    box-shadow: 0 4px 15px var(--glow-blue);
    transition: all 0.2s ease;
}

.btn-cyber-danger {
    background: linear-gradient(135deg, #cc0033, var(--accent-red));
    border: none;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 2px;
    font-weight: 800;
    padding: 16px;
    border-radius: 16px;
    font-size: 1.1rem;
    box-shadow: 0 4px 15px rgba(255, 57, 94, 0.3);
    transition: all 0.2s ease;
}

.btn-cyber-main:active,
.btn-cyber-danger:active {
    transform: scale(0.96);
    filter: brightness(1.2);
}

/* Select inputs */
.tech-select {
    background: #11151c !important;
    color: white !important;
    border: 1px solid var(--border-color) !important;
    padding: 12px 15px !important;
    border-radius: 12px !important;
    font-size: 1rem;
}

/* Bracket Decorativos */
.focus-bracket {
    position: absolute;
    width: 30px;
    height: 30px;
    border: 3px solid var(--accent-blue);
    z-index: 5;
    opacity: 0.8;
}
.top-left {
    top: 15px;
    left: 15px;
    border-right: 0;
    border-bottom: 0;
    border-top-left-radius: 10px;
}
.top-right {
    top: 15px;
    right: 15px;
    border-left: 0;
    border-bottom: 0;
    border-top-right-radius: 10px;
}
.bottom-left {
    bottom: 15px;
    left: 15px;
    border-right: 0;
    border-top: 0;
    border-bottom-left-radius: 10px;
}
.bottom-right {
    bottom: 15px;
    right: 15px;
    border-left: 0;
    border-top: 0;
    border-bottom-right-radius: 10px;
}

.copy-btn {
    width: 45px;
    height: 45px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.copy-btn:active {
    transform: scale(0.9);
}
</style>
