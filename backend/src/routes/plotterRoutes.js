import express from "express";
import { sendImageCommand } from "../services/plotterService.js";

const router = express.Router();
// envia los comandos de imagen al plotter
router.post("/send-image", async (req, res) => {
    const { imageName } = req.body;

    if (!imageName) {
        return res.status(400).json({
            ok: false,
            message: "Falta imageName en el cuerpo de la petición"
        });
    }

    try {
        await sendImageCommand(imageName);
        return res.json({
            ok: true,
            message: "Comando enviado al plotter"
        });
    } catch (err) {
        console.error("Error en /send-image:", err);
        return res.status(500).json({
            ok: false,
            message: "Error al enviar comando: " + err.message
        });
    }
});

export default router;
