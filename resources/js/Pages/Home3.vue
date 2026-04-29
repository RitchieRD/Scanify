<template>
    <div class="scanner-container">
        <!-- Header Minimalista (Ahora con texto claro para contrastar con el fondo azul) -->
        <header class="d-flex justify-content-between align-items-center">
            <div>
                <h1 class="header-title fw-bold mb-0 text-light">
                    SCAN<span class="fw-light">IFY</span>
                </h1>
                <div
                    class="text-light opacity-75"
                    style="font-size: 0.75rem; letter-spacing: 1px"
                >
                    Creado por CODERTEC
                </div>
            </div>
            <div
                :class="[
                    'status-pill fw-bold',
                    scanning ? 'status-online' : 'status-offline',
                ]"
            >
                <i class="fa-solid fa-circle-dot me-1"></i>
                {{ scanning ? "ESCANEA AHORA" : "EN ESPERA" }}
            </div>
        </header>

        <!-- Main Interface -->
        <div class="row g-3 flex-grow-1 mt-1">
            <!-- Scanner Viewport -->
            <div class="col-12">
                <div class="app-card p-2">
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
                                :class="{ 'frame-success': successCount > 0 }"
                            >
                                <!-- Efecto láser ahora utiliza el color rojo #E20612 -->
                                <div v-if="scanning" class="scan-overlay"></div>
                            </div>
                        </div>
                    </div>

                    <select
                        v-model="selectedCamera"
                        @change="restartScanner"
                        class="form-select mt-3 app-select"
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
                            class="btn btn-action-start flex-grow-1 shadow-sm"
                            @click="startScanner"
                        >
                            <i class="fa-solid fa-qrcode me-2"></i> INICIAR
                            ESCÁNER
                        </button>
                        <button
                            v-else
                            class="btn btn-action-stop flex-grow-1 shadow-sm"
                            @click="stopScanner"
                        >
                            <i class="fa-solid fa-stop me-2"></i> DETENER
                        </button>
                    </div>
                </div>
            </div>

            <!-- RESULTADO MEJORADO -->
            <div class="col-12" v-if="result">
                <div class="app-card result-card mb-4 slide-up">
                    <div
                        class="p-3 border-bottom border-light d-flex justify-content-between align-items-center bg-white"
                    >
                        <h6 class="mb-0 fw-bold text-primary">
                            <i
                                class="fa-solid fa-circle-check me-2"
                                style="color: #28a745"
                            ></i>
                            LECTURA EXITOSA
                        </h6>
                    </div>

                    <div class="p-4 bg-white">
                        <div
                            class="result-box d-flex justify-content-between align-items-center"
                        >
                            <div class="flex-grow-1 overflow-hidden pe-3">
                                <span
                                    class="text-muted fw-bold mb-1 d-block"
                                    style="
                                        font-size: 0.7rem;
                                        letter-spacing: 1px;
                                    "
                                >
                                    CÓDIGO DETECTADO
                                </span>
                                <div
                                    class="scanned-value text-primary fw-bolder text-truncate"
                                >
                                    {{ result }}
                                </div>
                            </div>

                            <!-- Botón de copiar mejorado -->
                            <button
                                class="btn-copy-large"
                                :class="{ 'copied-success': copied }"
                                @click="copyToClipboard"
                                :title="copied ? 'Copiado!' : 'Copiar código'"
                            >
                                <i
                                    :class="
                                        copied
                                            ? 'fa-solid fa-check'
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
    /* Paleta de Colores Invertida (Fondo Azul) */
    --bg-main: #024c93; /* Color principal ahora es el fondo */
    --bg-secondary: #f6f6f6; /* Gris claro para interiores */
    --accent-primary: #024c93; /* Azul para textos en fondos claros */
    --accent-danger: #e20612; /* Color de acento/peligro (Rojo) */

    /* Colores derivados para UI */
    --card-bg: #ffffff;
    --text-light: #f6f6f6; /* Texto sobre fondo azul */
    --text-dark: #2c3e50; /* Texto sobre fondo claro */
    --border-color: rgba(2, 76, 147, 0.12);
    --glow-primary: rgba(2, 76, 147, 0.25);
    --glow-danger: rgba(226, 6, 18, 0.3);
}

body {
    font-family: "Space Grotesk", "Segoe UI", sans-serif;
    background-color: var(--bg-main);
    color: var(
        --text-light
    ); /* Texto general claro para contrastar con el fondo azul */
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

/* Helpers de Texto */
.text-primary {
    color: var(--accent-primary) !important;
}
.text-light {
    color: var(--text-light) !important;
}

/* Header */
header {
    padding: 1rem 0.5rem;
    margin-bottom: 0.25rem;
}

.header-title {
    font-size: 1.85rem;
    letter-spacing: -1px;
    text-transform: uppercase;
}

/* Status Pill ajustado para fondo oscuro */
.status-pill {
    padding: 6px 14px;
    border-radius: 50px;
    font-size: 0.75rem;
    transition: all 0.3s ease;
    letter-spacing: 0.5px;
}

.status-online {
    background: rgba(246, 246, 246, 0.15);
    color: var(--text-light);
    border: 1px solid rgba(246, 246, 246, 0.4);
}

.status-offline {
    background: rgba(226, 6, 18, 0.2);
    color: #ffb3b8; /* Rojo muy claro para contrastar en fondo azul */
    border: 1px solid var(--accent-danger);
}

/* App Card General */
.app-card {
    background: var(--card-bg);
    color: var(--text-dark); /* Texto oscuro dentro de las tarjetas */
    border: none;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}

/* Área del Escáner */
.scanner-box {
    position: relative;
    max-width: 100%;
    height: 45vh;
    min-height: 350px;
    margin: auto;
    background: #000;
    border-radius: 14px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
}

video {
    width: 100%;
    height: 100%;
    object-fit: cover;
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
    border: 2px solid rgba(2, 76, 147, 0.4);
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.2s;
}

.frame-success {
    border-color: #28a745; /* Verde de éxito */
    box-shadow: 0 0 15px rgba(40, 167, 69, 0.4);
}

/* Efecto Láser - ROJO (#E20612) */
.scan-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        to bottom,
        transparent 48%,
        var(--accent-danger) 50%,
        transparent 52%
    );
    background-size: 100% 200%;
    animation: scanAnim 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    opacity: 0.85;
    box-shadow: 0 0 12px var(--accent-danger);
}

@keyframes scanAnim {
    0% {
        background-position: 0% 100%;
    }
    100% {
        background-position: 0% -100%;
    }
}

/* Botones Principales */
.btn-action-start {
    background: var(--accent-primary);
    border: none;
    color: #ffffff;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    padding: 16px;
    border-radius: 14px;
    font-size: 1rem;
    box-shadow: 0 4px 15px var(--glow-primary);
    transition: all 0.2s ease;
}

.btn-action-stop {
    background: var(--accent-danger);
    border: none;
    color: #ffffff;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    padding: 16px;
    border-radius: 14px;
    font-size: 1rem;
    box-shadow: 0 4px 15px var(--glow-danger);
    transition: all 0.2s ease;
}

.btn-action-start:active,
.btn-action-stop:active {
    transform: scale(0.96);
}

/* Select inputs */
.app-select {
    background: var(--bg-secondary) !important;
    color: var(--accent-primary) !important;
    border: 1px solid var(--border-color) !important;
    padding: 14px 15px !important;
    border-radius: 12px !important;
    font-size: 1rem;
    font-weight: 600;
}

/* Bracket Decorativos - Azules */
.focus-bracket {
    position: absolute;
    width: 30px;
    height: 30px;
    border: 3px solid var(--accent-primary);
    z-index: 5;
    opacity: 0.9;
}
.top-left {
    top: 15px;
    left: 15px;
    border-right: 0;
    border-bottom: 0;
    border-top-left-radius: 8px;
}
.top-right {
    top: 15px;
    right: 15px;
    border-left: 0;
    border-bottom: 0;
    border-top-right-radius: 8px;
}
.bottom-left {
    bottom: 15px;
    left: 15px;
    border-right: 0;
    border-top: 0;
    border-bottom-left-radius: 8px;
}
.bottom-right {
    bottom: 15px;
    right: 15px;
    border-left: 0;
    border-top: 0;
    border-bottom-right-radius: 8px;
}

/* ---------------------------------
   MEJORAS EN LA SECCIÓN DE RESULTADO 
   --------------------------------- */

.result-card {
    border-top: none;
}

.bg-white {
    background-color: #ffffff !important;
}

.border-light {
    border-color: rgba(0, 0, 0, 0.05) !important;
}

.result-box {
    background: var(--bg-secondary);
    padding: 1rem 1.25rem;
    border-radius: 14px;
    border: 1px dashed rgba(2, 76, 147, 0.3);
}

.scanned-value {
    font-size: 1.4rem;
    word-break: break-all;
    letter-spacing: 0.5px;
}

/* Botón de Copiar Grande */
.btn-copy-large {
    min-width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-primary);
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-size: 1.2rem;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 10px rgba(2, 76, 147, 0.2);
}

.btn-copy-large:active {
    transform: scale(0.9);
}

.copied-success {
    background: #28a745 !important;
    box-shadow: 0 4px 10px rgba(40, 167, 69, 0.3) !important;
}

/* Animación de entrada suave para el resultado */
.slide-up {
    animation: slideUp 0.4s ease-out forwards;
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
