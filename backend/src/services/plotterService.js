import { openSerialPort, sendToPlotter, isSerialOpen } from "../serial/serialService.js";

// Abrimos el puerto al cargar este módulo 
//openSerialPort();

// Envía un comando sencillo al plotter basado en el nombre de la imagen.

export async function sendImageCommand(imageName) {
    if (!isSerialOpen()) {
        openSerialPort();
    }

    const payload = `START_DRAW\n${imageName}\nEND_DRAW\n`;
    console.log("Enviando al plotter:", JSON.stringify(payload));

    await sendToPlotter(payload);
}
