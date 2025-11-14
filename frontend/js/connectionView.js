import { apiConnect } from "./apiClient.js";

export function initConnectionView(onConnected) {
    const keyInput = document.getElementById("keyInput");
    const btnConnect = document.getElementById("btnConnect");
    const statusConn = document.getElementById("statusConn");

    btnConnect.addEventListener("click", async () => {
        const key = keyInput.value.trim();
        if (!key) {
            statusConn.textContent = "Por favor ingresa la key.";
            return;
        }

        btnConnect.disabled = true;
        statusConn.textContent = "Conectando...";

        try {
            const res = await apiConnect(key);
            if (res.ok) {
                statusConn.textContent = "Conectado ✅";
                // Avisar al main que puede cambiar de pantalla
                onConnected();
            } else {
                statusConn.textContent = "Error: " + res.message;
            }
        } catch (err) {
            statusConn.textContent = "Error inesperado: " + err.message;
        } finally {
            btnConnect.disabled = false;
        }
    });
}
