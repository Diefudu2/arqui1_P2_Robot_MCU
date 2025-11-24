import express from "express";
import cors from "cors";
import { HTTP_PORT } from "./config.js";
import connectionRoutes from "./routes/connectionRoutes.js";
import plotterRoutes from "./routes/plotterRoutes.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.use("/api", connectionRoutes);
app.use("/api", plotterRoutes);

// Endpoint de prueba simple
app.get("/", (req, res) => {
    res.send("Backend CNC Plotter funcionando");
});

app.listen(HTTP_PORT, () => {
    console.log(`Servidor HTTP escuchando en http://localhost:${HTTP_PORT}`);
});
