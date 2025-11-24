// svgGenerator.js
// Genera un SVG a partir de un PNG aplicando umbralización y contornos

export function generateSVG(file, options = {}) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);

        const baseName = file.name.replace(/\.[^/.]+$/, "");
        console.log("[generateSVG] Iniciando procesamiento (versión parche)");
        window.__SVG_GEN_VERSION = 'auto-v2';

        // Leer la imagen con FileReader
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                // Dibujar imagen en canvas
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);

                // Obtener datos de píxeles
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // Umbralización: convertir a blanco/negro
                const threshold = 128;
                const binary = [];
                for (let y = 0; y < canvas.height; y++) {
                    binary[y] = [];
                    for (let x = 0; x < canvas.width; x++) {
                        const i = (y * canvas.width + x) * 4;
                        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
                        binary[y][x] = gray < threshold ? 1 : 0;
                    }
                }

                // Detección de contornos simple: buscar transiciones
                let paths = "";
                for (let y = 1; y < canvas.height - 1; y++) {
                    for (let x = 1; x < canvas.width - 1; x++) {
                        if (binary[y][x] === 1 &&
                            (binary[y - 1][x] === 0 || binary[y + 1][x] === 0 ||
                             binary[y][x - 1] === 0 || binary[y][x + 1] === 0)) {
                            // Marcar punto de contorno
                            paths += `M${x},${y} h1 v1 h-1 Z `;
                        }
                    }
                }

                // Construir contenido SVG
                const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
    <path d="${paths}" fill="black"/>
</svg>
                `.trim();

                // Descarga automática siempre
                try {
                    const ts = Date.now();
                    console.log("[generateSVG] Descargando SVG automático", `${baseName}_${ts}.svg`);
                    const blob = new Blob([svgContent], { type: "image/svg+xml" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${baseName}_${ts}.svg`;
                    document.body.appendChild(a);
                    a.click();
                    // Fallback segundo intento tras breve delay (algunos navegadores/policy)
                    setTimeout(() => {
                        try {
                            a.click();
                        } catch {}
                    }, 150);
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (err) {
                    console.warn("No se pudo descargar SVG:", err);
                }

                resolve(svgContent);
            };
            img.onerror = function (err) {
                reject(new Error('Error cargando la imagen: ' + err));
            };
            img.src = e.target.result;
        };
        reader.onerror = function (err) {
            reject(new Error('Error leyendo el archivo: ' + err));
        };
        reader.readAsDataURL(file);
    });
}
