import { connectBluetooth, sendMessage, disconnectBluetooth, subscribeSerialMonitor } from "./bluetoothTest.js";
import { initImageView, setImageViewBluetoothReady } from "./imageView.js";
import { initConnectionView } from "./connectionView.js";

const screenConn = document.getElementById("screen-conn");
const screenImage = document.getElementById("screen-image");

const step1 = document.getElementById("step-1");
const step2 = document.getElementById("step-2");
const sidebarStatus = document.getElementById("sidebarStatus");

const btnSendTest = document.getElementById("btnSendTest");
const testInput = document.getElementById("testInput");
const statusTest = document.getElementById("statusTest");
const btnGoImage = document.getElementById("btnGoImage");
const serialLog = document.getElementById("serialLog");
const btnClearLog = document.getElementById("btnClearLog");
const serialBuffer = [];
const SERIAL_LOG_LIMIT = 500;

function setStep(activeStep) {
    if (!step1 || !step2) return;
    step1.classList.toggle("step-active", activeStep === 1);
    step2.classList.toggle("step-active", activeStep === 2);
}

function setSidebarConnected() {
    if (!sidebarStatus) return;
    sidebarStatus.textContent = "Conectado";
    sidebarStatus.classList.remove("status-chip-disconnected");
    sidebarStatus.classList.add("status-chip-connected");
}

function showImageScreen() {
    screenImage.classList.remove("hidden");
    setStep(2);
    setSidebarConnected();
}

// Manejador de envío de mensaje de prueba
if (btnSendTest && testInput && statusTest) {
    btnSendTest.addEventListener("click", async () => {
        const message = testInput.value.trim();
        if (!message) {
            statusTest.textContent = "⚠️ Escribe un mensaje primero";
            return;
        }
        
        statusTest.textContent = "Enviando...";
        const success = await sendMessage(message);
        
        if (success) {
            statusTest.textContent = `✅ Enviado: "${message}" - Revisa el Monitor Serial del Arduino`;
            testInput.value = "";
        } else {
            statusTest.textContent = "❌ Error al enviar";
        }
    });
}

if (btnGoImage) {
    btnGoImage.addEventListener("click", () => {
        showImageScreen();
    });
}

function appendSerialLine(line) {
    if (!serialLog) return;
    serialBuffer.push(line);
    if (serialBuffer.length > SERIAL_LOG_LIMIT) serialBuffer.shift();
    const nearBottom = serialLog.scrollTop + serialLog.clientHeight >= serialLog.scrollHeight - 5;
    serialLog.textContent = serialBuffer.join("\n");
    if (nearBottom) serialLog.scrollTop = serialLog.scrollHeight;
}

if (serialLog && serialLog.textContent.trim() === "") {
    serialLog.textContent = "[Monitor serial listo]";
}

subscribeSerialMonitor((line) => appendSerialLine(line));

if (btnClearLog) {
    btnClearLog.addEventListener("click", () => {
        serialBuffer.length = 0;
        if (serialLog) {
            serialLog.textContent = "[Monitor serial listo]";
        }
    });
}

// Estado inicial
setStep(1);
initImageView();
setImageViewBluetoothReady(false);

// Inicializar vista de conexión
initConnectionView(() => {
    if (btnSendTest) {
        btnSendTest.disabled = false;
    }
    // btnGoImage siempre disponible para generar/descargar SVG+CSV
    setSidebarConnected();
    setImageViewBluetoothReady(true);
});
