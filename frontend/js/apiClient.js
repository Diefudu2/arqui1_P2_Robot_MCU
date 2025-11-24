const USE_MOCK = true;

const BASE_URL = "http://localhost:3000/api";

export async function apiConnect(key) {
    if (USE_MOCK) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (key === "Plotter") {
                    resolve({ ok: true, message: "Conectado (mock)" });
                } else {
                    resolve({ ok: false, message: "Key inválida (mock)" });
                }
            }, 700);
        });
    }
    const res = await fetch(`${BASE_URL}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
    });
    return res.json();
}

export async function apiSendImage(imageName) {
    if (USE_MOCK) {
        return new Promise((resolve) => {
            setTimeout(
                () => resolve({ ok: true, message: `Comando enviado (mock) para ${imageName}` }),
                700
            );
        });
    }

    const res = await fetch(`${BASE_URL}/send-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageName }),
    });
    return res.json();
}
