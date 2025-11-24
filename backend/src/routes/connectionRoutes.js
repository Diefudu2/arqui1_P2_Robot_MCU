import express from "express";
import { validateKey } from "../services/authService.js";
import { openSerialPort, isSerialOpen } from "../serial/serialService.js";

const router = express.Router();

// iniciador de puerto
router.post("/connect", (req, res) => {
    const { key } = req.body;

    if (!key) {
        return res.status(400).json({
            ok: false,
            message: "Falta la key en el cuerpo de la petición"
        });
    }

    if (!validateKey(key)) {
        return res.status(401).json({
            ok: false,
            message: "Key inválida"
        });
    }

    try {
        const port = openSerialPort();

        if (!isSerialOpen()) {
            port.on("open", () => console.log("Puerto abierto tras /connect"));
        }

        return res.json({
            ok: true,
            message: "Conexión autorizada y puerto serie inicializado"
        });
    } catch (err) {
        console.error("Error en /connect:", err);
        return res.status(500).json({
            ok: false,
            message: "Error al abrir puerto serie: " + err.message
        });
    }
});

export default router;
