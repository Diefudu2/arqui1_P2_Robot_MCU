# Aplicacion de usuario y comunicacion 
La aplicación web desarrollada funciona como una interfaz gráfica de control remoto para un mini CNC Plotter basado en un microcontrolador y un módulo Bluetooth HC-05. Su propósito principal es permitir al usuario conectarse al robot, cargar una imagen y enviarla al hardware, todo desde un navegador web y sin necesidad de software adicional.

## Estructura
```
.
├── backend/
|   ├── src/
|   |   ├── routes/
|   |   ├── serial/
|   |   ├── services/
|   ├── app.js
|   └── config.js
├── docs/
|   └── README.md
└── frontend/  
    ├── js/
    ├── index.html
    └── stylews.css
```

- `frontend/` Interfaz grafica 
- `backend/` Encargado de procesar todos los datos, revisar que se conecta con el hardware y modifica la imagen para que llegue de manera correcta al hardware.

## Interfaz


## Dependencias
```bash
sudo apt install nodejs npm
```

## Ejecucion 
### Backend
En terminal ejecutar (solo una vez):
```bash
npm install
```
Inicar backend:
```bash
npm start
```

### Frontend
En terminal ejecutar:
```bash
python3 -m http.server 8080
```

En el navegador:
```text
http://localhost:8080
```
## Pruebas Unitarias
### Backend
* Probar el endpoint raíz
```bash
curl http://localhost:3000/
```
* Probar /api/connect con key correcta
```bash
curl -X POST http://localhost:3000/api/connect \
  -H "Content-Type: application/json" \
  -d '{"key": "Plotter"}'
```
* Probar /api/send-image
```bash
curl -X POST http://localhost:3000/api/send-image \
  -H "Content-Type: application/json" \
  -d '{"imageName": "prueba.png"}'
```
## Extra
key = Plotter