import { initConnectionView } from "./connectionView.js";
import { initImageView } from "./imageView.js";

const screenConn = document.getElementById("screen-conn");
const screenImage = document.getElementById("screen-image");

const step1 = document.getElementById("step-1");
const step2 = document.getElementById("step-2");
const sidebarStatus = document.getElementById("sidebarStatus");

function setStep(activeStep) {
    if (!step1 || !step2) return;
    step1.classList.toggle("step-active", activeStep === 1);
    step2.classList.toggle("step-active", activeStep === 2);
}

function setSidebarConnected() {
    if (!sidebarStatus) return;
    sidebarStatus.textContent = "Conectado";
    sidebarStatus.classList.remove("status-chip-disconnected");
    sidebarStatus.classList.add("status-chip-connected");
}

function showImageScreen() {
    screenConn.classList.add("hidden");
    screenImage.classList.remove("hidden");
    setStep(2);
    setSidebarConnected();
}

// Estado inicial
setStep(1);

initConnectionView(showImageScreen);
initImageView();
