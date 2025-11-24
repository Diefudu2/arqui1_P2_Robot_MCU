import { connectBluetooth } from "./bluetoothTest.js";

export function initConnectionView(onConnected) {
    const btnConnect = document.getElementById("btnConnect");
    const statusConn = document.getElementById("statusConn");

    // Verificar que los elementos existan
    if (!btnConnect || !statusConn) {
        console.error("[ERROR] No se encontraron los elementos necesarios:", {
            btnConnect: !!btnConnect,
            statusConn: !!statusConn
        });
        return;
    }

    btnConnect.addEventListener("click", async () => {
        console.log("[DEBUG] Botón conectar presionado");

        btnConnect.disabled = true;

        statusConn.textContent = "Conectando...";

        try {
            const success = await connectBluetooth();
            
            if (success) {
                statusConn.textContent = "✅ Conectado al HC-05 vía Bluetooth";
                // Avisar al main que puede cambiar de pantalla
                onConnected();
            } else {
                statusConn.textContent = "❌ Error al conectar. Verifica que el HC-05 esté emparejado.";
                btnConnect.disabled = false;
            }
        } catch (err) {
            console.error("[ERROR]", err);
            statusConn.textContent = "❌ Error inesperado: " + err.message;
            btnConnect.disabled = false;
        }
    });
}
