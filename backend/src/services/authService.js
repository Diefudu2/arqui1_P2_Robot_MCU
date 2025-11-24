import { SECRET_KEY } from "../config.js";
// revisa si es o no es la contrasena
export function validateKey(key) {
    return key === SECRET_KEY;
}
