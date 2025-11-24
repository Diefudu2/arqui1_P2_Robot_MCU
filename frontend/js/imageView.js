import { processSVG } from "./svgProcessor.js";
import { generateSVG } from "./svgGenerator.js";
import { sendCoordinatePayload } from "./bluetoothTest.js";

const COORDS_PREFIX_REGEX = /^\s*A\s*=\s*/;
const sanitizeCoordsPayload = (payload) => (payload ?? "").replace(COORDS_PREFIX_REGEX, "").trim();
const buildCoordsFilename = (sourceName = "coords") => `${(sourceName.replace(/\.[^/.]+$/, "") || "coords")}_coords.csv`;
const downloadCoordsCSV = (payload, filename) => {
	const blob = new Blob([payload], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
};
const countCoordinateTuples = (payload) => {
    if (!payload) return 0;
    const matches = payload.match(/\([^()]+\)/g);
    return matches ? matches.length : 0;
};

let lastCoordsPayload = null;
let lastCoordsFilename = null;
let isBluetoothReady = false;
let btnSendCoordsRef = null;
let statusCoordsRef = null;
let coordsMetaRef = null;
let coordsCurrentRef = null;

const syncSendCoordsButton = () => {
    if (btnSendCoordsRef) {
        btnSendCoordsRef.disabled = !(lastCoordsPayload && isBluetoothReady);
    }
};

const coordsReadyMessage = () => {
    if (!lastCoordsPayload) return "Genera una imagen para obtener coordenadas.";
    const base = `Coordenadas listas (${lastCoordsPayload.length} caracteres)`;
    return isBluetoothReady ? base : `${base} - Conecta el HC-05 para enviarlas.`;
};

export function setImageViewBluetoothReady(isReady) {
    isBluetoothReady = isReady;
    syncSendCoordsButton();
    if (statusCoordsRef && lastCoordsPayload) {
        statusCoordsRef.textContent = coordsReadyMessage();
    }
}

export function initImageView() {
    const fileInput = document.getElementById("fileInput");
    const previewBox = document.getElementById("previewBox");
    const btnSendCoords = document.getElementById("btnSendCoords");
    const statusCoords = document.getElementById("statusCoords");
    coordsMetaRef = document.getElementById("coordsMeta");
    coordsCurrentRef = document.getElementById("coordsCurrent");

    btnSendCoordsRef = btnSendCoords;
    statusCoordsRef = statusCoords;

    const resetCoordsState = (message = "Genera una imagen para obtener coordenadas.") => {
        lastCoordsPayload = null;
        lastCoordsFilename = null;
        if (statusCoordsRef) statusCoordsRef.textContent = message;
        if (coordsMetaRef) coordsMetaRef.textContent = "";
        if (coordsCurrentRef) coordsCurrentRef.textContent = "";
        syncSendCoordsButton();
    };

    resetCoordsState();

    fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) {
            previewBox.textContent = "Vista previa de la imagen";
            resetCoordsState();
            return;
        }

        lastCoordsFilename = buildCoordsFilename(file.name);

        const url = URL.createObjectURL(file);
        previewBox.innerHTML = "";
        const img = document.createElement("img");
        img.src = url;
        previewBox.appendChild(img);

        try {
            const svgString = await generateSVG(file);
            if (svgString) {
                const coordsPayload = await processSVG(svgString);
                const cleanPayload = sanitizeCoordsPayload(coordsPayload);
                if (cleanPayload) {
                    lastCoordsPayload = cleanPayload;
                    const tupleCount = countCoordinateTuples(cleanPayload);
                    if (coordsMetaRef) {
                        coordsMetaRef.textContent = `Total: ${tupleCount} puntos`;
                    }
                    if (coordsCurrentRef) coordsCurrentRef.textContent = "";
                    if (statusCoordsRef) statusCoordsRef.textContent = coordsReadyMessage();
                    syncSendCoordsButton();
                    downloadCoordsCSV(cleanPayload, lastCoordsFilename || buildCoordsFilename());
                } else {
                    resetCoordsState("No se generaron coordenadas.");
                }
            } else {
                resetCoordsState("No se pudo generar el SVG.");
            }
        } catch (err) {
            console.error("Error generando SVG:", err);
            resetCoordsState("Error generando coordenadas.");
        }
    });

    if (btnSendCoords) {
        btnSendCoords.addEventListener("click", async () => {
            if (!lastCoordsPayload) {
                if (statusCoordsRef) statusCoordsRef.textContent = "Genera las coordenadas primero.";
                return;
            }
            btnSendCoords.disabled = true;
            if (statusCoordsRef) statusCoordsRef.textContent = "Iniciando envío punto a punto...";

            const result = await sendCoordinatePayload(lastCoordsPayload, {
                ackTimeoutMs: 15000,
                onProgress: (state) => {
                    if (!state) return;
                    if (state.phase === "starting") {
                        if (statusCoordsRef) statusCoordsRef.textContent = `Preparando ${state.total} coordenadas...`;
                        if (coordsCurrentRef) coordsCurrentRef.textContent = "";
                    } else if (state.phase === "sending") {
                        if (statusCoordsRef) statusCoordsRef.textContent = `Coordenada ${state.index + 1} de ${state.total} enviada. Esperando READY...`;
                        if (coordsCurrentRef) coordsCurrentRef.textContent = `Actual: ${state.coordText || "-"}`;
                    } else if (state.phase === "completed") {
                        if (statusCoordsRef) statusCoordsRef.textContent = "Esperando confirmación final del plotter...";
                        if (coordsCurrentRef) coordsCurrentRef.textContent = `Última enviada: ${state.coordText || "-"}`;
                    }
                }
            });

            if (statusCoordsRef) statusCoordsRef.textContent = `${result.ok ? "✅" : "❌"} ${result.message}`;
            syncSendCoordsButton();
        });
    }
}
