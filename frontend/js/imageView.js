import { apiSendImage } from "./apiClient.js";

export function initImageView() {
    const fileInput = document.getElementById("fileInput");
    const previewBox = document.getElementById("previewBox");
    const btnSend = document.getElementById("btnSend");
    const statusSend = document.getElementById("statusSend");

    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (!file) {
            previewBox.textContent = "Vista previa de la imagen";
            btnSend.disabled = true;
            return;
        }

        const url = URL.createObjectURL(file);
        previewBox.innerHTML = "";
        const img = document.createElement("img");
        img.src = url;
        previewBox.appendChild(img);
        btnSend.disabled = false;
    });

    btnSend.addEventListener("click", async () => {
        const file = fileInput.files[0];
        if (!file) return;

        statusSend.textContent = "Enviando al plotter...";
        btnSend.disabled = true;

        try {
            const res = await apiSendImage(file.name);
            if (res.ok) {
                statusSend.textContent = "✅ " + res.message;
            } else {
                statusSend.textContent = "Error: " + res.message;
            }
        } catch (err) {
            statusSend.textContent = "Error inesperado: " + err.message;
        } finally {
            btnSend.disabled = false;
        }
    });
}
