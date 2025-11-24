import { SerialPort } from "serialport";
import { SERIAL_PORT_PATH, SERIAL_BAUD_RATE } from "../config.js";

let port = null;
// abrir puerto
export function openSerialPort() {
    if (port && port.isOpen) {
        return port;
    }

    port = new SerialPort({
        path: SERIAL_PORT_PATH,
        baudRate: SERIAL_BAUD_RATE
    });

    port.on("open", () => {
        console.log("Puerto serie abierto:", SERIAL_PORT_PATH);
    });

    port.on("error", (err) => {
        console.error("Error en puerto serie:", err.message);
    });

    port.on("close", () => {
        console.log("Puerto serie cerrado");
    });

    return port;
}
// ver si el puerto esta abierto
export function isSerialOpen() {
    return port && port.isOpen;
}
// envia cosas al plotter
export function sendToPlotter(data) {
    return new Promise((resolve, reject) => {
        if (!port || !port.isOpen) {
            return reject(new Error("Puerto serie no está abierto"));
        }

        port.write(data, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}
