# Diseño de hardware
Este proyecto implementa un sistema modular para controlar un robot tipo CNC plotter basado en microcontrolador ATmega328P, sin usar placas de desarrollo comerciales como Arduino Uno. La arquitectura permite comunicación local por UART y escalabilidad hacia control remoto vía WiFi.
## Arquitectura general

El sistema se divide en tres capas principales:

1. **Frontend Web (PC 1)**: Interfaz gráfica para enviar comandos.
2. **Servidor Intermedio (PC 2)**: Traduce comandos y los envía por UART.
3. **Microcontrolador + Robot**: Ejecuta los comandos físicos.

## Diagrama de arquitectura

La siguiente imagen representa la estructura modular del sistema:

![Arquitectura CNC](img/diagrama%20arquitectura.png)

> El diagrama fue generado con Graphviz y muestra la comunicación entre los componentes del sistema.

## Componentes

### Microcontrolador
- ATmega328P montado en protoboard o PCB personalizada.
- Programado con Arduino IDE.
- Comunicación UART con PC 2.

### Sensores
- 
- 

### Servidor Intermedio (PC 2)
- Node.js o Python.
- Maneja UART (`serialport` o `pyserial`).
- Expone API HTTP/WebSocket para control remoto.

### Cliente Web (PC 1)
- Interfaz en JavaScript (Node.js).
- Envía comandos al servidor intermedio.



# Arquitectura de software embebido

## Flujo de Trabajo
![Diagrama de Flujo](img/Flujo%20del%20programa%20principal.png)

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
## Comunicación Aplicación Web → Backend

Protocolo: HTTP (API REST).
Formato de datos: JSON.
Endpoints principales:
- POST /api/connect: Valida la key de acceso y habilita la comunicación con el hardware.
- POST /api/send-image: Envía el nombre de la imagen seleccionada para su posterior procesamiento.

## Comunicación Backend → Robot (Microcontrolador)

Tecnología: Bluetooth Clásico (HC-05).
Perfil: SPP (Serial Port Profile).
Puerto virtual: /dev/rfcomm0
Protocolo: UART serial (9600 baudios).

El backend envía comandos al CNC Plotter mediante escritura serial sobre el enlace Bluetooth.

## Control del Sistema

Autenticación mediante key: evita accesos no autorizados.

Establecimiento de conexión con el HC-05: apertura del puerto serial y verificación de estado.

Carga y validación de imágenes: selección desde el navegador con vista previa.

Envío de comandos al robot: el backend transforma las acciones del usuario en instrucciones seriales.

## Monitoreo

Visualización del estado de conexión (Conectado / Desconectado).
Mensajes en tiempo real sobre:
- Apertura del puerto serial
- Envío de comandos
- Validaciones y errores
Registro de eventos en consola del backend para depuración.