import { initConnectionView } from "./connectionView.js";
import { initImageView } from "./imageView.js";

const screenConn = document.getElementById("screen-conn");
const screenImage = document.getElementById("screen-image");

function showImageScreen() {
    screenConn.classList.add("hidden");
    screenImage.classList.remove("hidden");
}

initConnectionView(showImageScreen);
initImageView();
