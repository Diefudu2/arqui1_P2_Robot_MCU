// bluetoothTest.js
// Prueba básica de comunicación vía Web Serial API

let port = null;
let writer = null;
let reader = null;
let lineBuffer = "";
let ackWaiter = null;
let isSendingCoords = false;
const serialListeners = new Set();

export function subscribeSerialMonitor(callback) {
    if (typeof callback !== "function") return () => {};
    serialListeners.add(callback);
    return () => serialListeners.delete(callback);
}

// Función para conectar al puerto COM3
export async function connectBluetooth() {
    // Verificar si Web Serial API está disponible
    if (!('serial' in navigator)) {
        console.error('❌ Web Serial API no soportada. Usa Chrome o Edge.');
        alert('Tu navegador no soporta Web Serial API.\n\nUsa Chrome o Edge en su lugar.');
        return false;
    }
    
    try {
        // Solicitar acceso al puerto serial (Chrome mostrará selector)
        port = await navigator.serial.requestPort();
        
        // Abrir el puerto a 9600 bps (debe coincidir con el HC-05 y el .ino)
        await port.open({ baudRate: 9600 });
        
        // Obtener el writer para enviar datos
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
        writer = textEncoder.writable.getWriter();
        
        console.log("✅ Conectado a Bluetooth (HC-05)");
        
        // Iniciar lectura de respuestas (opcional)
        readFromSerial();
        
        return true;
    } catch (error) {
        console.error("❌ Error conectando:", error);
        return false;
    }
}

// Función para enviar mensaje
export async function sendMessage(message) {
    if (!writer) {
        console.error("No conectado. Llama a connectBluetooth() primero.");
        return false;
    }
    
    try {
        // Agregar salto de línea (el .ino lee hasta '\n')
        await writer.write(message + '\n');
        console.log(`📤 Enviado: ${message}`);
        return true;
    } catch (error) {
        console.error("❌ Error enviando:", error);
        return false;
    }
}

// Nuevo helper para coordendas masivas
export async function sendCoordinatePayload(payload, options = {}) {
    if (!writer) {
        return { ok: false, message: "Conéctate al HC-05 antes de enviar coordenadas." };
    }
    if (isSendingCoords) {
        return { ok: false, message: "Ya hay un envío de coordenadas en curso." };
    }

    const coords = parseCoordinateTuples((payload ?? "").trim());
    if (!coords.length) {
        return { ok: false, message: "No hay coordenadas válidas para enviar." };
    }

    isSendingCoords = true;
    try {
        options.onProgress?.({ phase: "starting", total: coords.length });

        for (let i = 0; i < coords.length; i++) {
            const { x, y } = coords[i];
            const coordText = `(${x},${y})`;
            await writeLine(`${x},${y}`);
            options.onProgress?.({ phase: "sending", index: i, total: coords.length, coordText });
            await waitForAck({ accept: ["READY"], label: `ACK punto ${i + 1}`, timeoutMs: options.ackTimeoutMs ?? 15000 });
        }

        await writeLine("END");
        const lastCoordText = coords.length ? `(${coords[coords.length - 1].x},${coords[coords.length - 1].y})` : "";
        options.onProgress?.({ phase: "completed", total: coords.length, coordText: lastCoordText });
        await waitForAck({ accept: ["DONE"], label: "ACK final", timeoutMs: options.ackTimeoutMs ?? 15000 });

        return { ok: true, message: `Coordenadas enviadas (${coords.length}) una a una.` };
    } catch (error) {
        console.error("❌ Error en secuencia de coordenadas:", error);
        return { ok: false, message: error.message || "Fallo al enviar coordenadas." };
    } finally {
        isSendingCoords = false;
    }
}

// Función para leer respuestas del ATmega (opcional)
async function readFromSerial() {
    if (!port?.readable) return;

    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    reader = textDecoder.readable.getReader();

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
                lineBuffer += value;
                lineBuffer = processIncomingLines(lineBuffer);
            }
        }
    } catch (error) {
        console.error("Error leyendo:", error);
    } finally {
        reader.releaseLock();
    }
}

// Función para desconectar
export async function disconnectBluetooth() {
    if (writer) {
        await writer.close();
        writer = null;
    }
    if (port) {
        await port.close();
        port = null;
    }
    lineBuffer = "";
    ackWaiter = null;
    isSendingCoords = false;
    console.log("🔌 Desconectado");
}

// Helpers ----------------------------------------------------------------
async function writeLine(text) {
    if (!writer) throw new Error("Writer no disponible.");
    await writer.write(`${text}\n`);
}

function parseCoordinateTuples(payload) {
    const coords = [];
    const regex = /\((-?\d+)\s*,\s*(-?\d+)\)/g;
    let match;
    while ((match = regex.exec(payload)) !== null) {
        coords.push({ x: Number(match[1]), y: Number(match[2]) });
    }
    return coords;
}

function processIncomingLines(buffer) {
    const lines = buffer.split(/\r?\n/);
    const remainder = lines.pop();

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        notifySerialListeners(line);

        if (ackWaiter) {
            const accepts = ackWaiter.accept || [];
            const rejects = ackWaiter.reject || [];

            if (accepts.includes(line)) {
                clearTimeout(ackWaiter.timeoutId);
                ackWaiter.resolve(line);
                ackWaiter = null;
                continue;
            }
            if (rejects.includes(line)) {
                clearTimeout(ackWaiter.timeoutId);
                ackWaiter.rejectFn(new Error(`ACK rechazado: ${line}`));
                ackWaiter = null;
                continue;
            }
        }

        console.log(`📥 Respuesta ATmega: ${line}`);
    }

    return remainder ?? "";
}

function notifySerialListeners(line) {
    serialListeners.forEach((cb) => {
        try { cb(line); } catch (err) { console.error("Listener serial falló:", err); }
    });
}

function waitForAck({ accept = ["READY"], reject = ["ERR", "ERROR"], timeoutMs = 15000, label = "ACK" } = {}) {
    if (ackWaiter) {
        return Promise.reject(new Error("Ya se espera un ACK previo."));
    }
    return new Promise((resolve, rejectFn) => {
        const timeoutId = setTimeout(() => {
            ackWaiter = null;
            rejectFn(new Error(`${label} no recibido a tiempo`));
        }, timeoutMs);

        ackWaiter = { accept, reject, resolve, rejectFn, timeoutId };
    });
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
