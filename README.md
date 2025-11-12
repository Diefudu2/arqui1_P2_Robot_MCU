# 🛠️ CNC Plotter Control System

Este proyecto implementa un sistema modular para controlar un robot tipo CNC plotter basado en microcontrolador ATmega328P, sin usar placas de desarrollo comerciales como Arduino Uno. La arquitectura permite comunicación local por UART y escalabilidad hacia control remoto vía WiFi.

---

## 📐 Arquitectura general

El sistema se divide en tres capas principales:

1. **Frontend Web (PC 1)**: Interfaz gráfica para enviar comandos.
2. **Servidor Intermedio (PC 2)**: Traduce comandos y los envía por UART.
3. **Microcontrolador + Robot**: Ejecuta los comandos físicos.

---

## 📊 Diagrama de arquitectura

La siguiente imagen representa la estructura modular del sistema:

![Arquitectura CNC](img/diagrama%20arquitectura.png)

> El diagrama fue generado con Graphviz y muestra la comunicación entre los componentes del sistema.

---

## 🧱 Componentes

### Microcontrolador
- ATmega328P montado en protoboard o PCB personalizada.
- Programado con Arduino IDE.
- Comunicación UART con PC 2.

### Servidor Intermedio (PC 2)
- Node.js o Python.
- Maneja UART (`serialport` o `pyserial`).
- Expone API HTTP/WebSocket para control remoto.

### Cliente Web (PC 1)
- Interfaz en JavaScript (React, Vue o HTML puro).
- Envía comandos al servidor intermedio.

---

## 🚀 Cómo empezar

1. Clona el repositorio.
2. Instala dependencias para el servidor (`npm install` o `pip install pyserial`).
3. Conecta el microcontrolador por UART.
4. Ejecuta el servidor local.
5. Abre el cliente web y envía comandos.

---

## 📁 Estructura del proyecto

