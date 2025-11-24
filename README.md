# CNC Pen Plotter con ATmega328P, 74HC595, MPU6050 y Servo

Este proyecto es un **CNC pen plotter** controlado por un ATmega328P (tipo Arduino UNO / baremetal) que utiliza:

- **Dos motores paso a paso 28BYJ-48** controlados mediante un **74HC595** (expansor de salidas).
- Comunicación **Bluetooth (HC‑05)** para recibir comandos de trazado.
- Un **servo** para subir/bajar el lápiz.
- Un **MPU6050** que tiene protocolo de comunicación I2C para detección de vibraciones / golpes.
- **Sensores de home** en los ejes X e Y para encontrar el origen físico (0,0) al arrancar.

El sistema se divide en tres capas principales:

1. **Frontend Web (PC 1)**: Interfaz gráfica para enviar comandos.
2. **Servidor Intermedio (PC 2)**: Traduce comandos y los envía por UART.
3. **Microcontrolador + Robot**: Ejecuta los comandos físicos.

## Diagrama de arquitectura

La siguiente imagen representa la estructura modular del sistema:

![Arquitectura CNC](img/diagrama%20arquitectura.png)

El programa principal cargado en el ATmega328P es:

```text
motores_shifter.ino
```

---
Este controla todo el movimiento en los ejes x, y y zde los motores stepper y el servo, además la lógica de los sensores endstops para el (0,0) y el acelerometro.

## Hardware 

### Microcontrolador

- ATmega328P (Arduino UNO bare-metal con bootloader).

### Motores

- 2x **28BYJ‑48** + 2x drivers ULN2003 para control de ejes x, y.
- Salidas a motores se manejan vía **74HC595**:
  - `pinLatch = 12` (RCLK)
  - `pinClock = 11` (SRCLK)
  - `pinData  = 13` (SER)
- 1x Servo Motor para control de eje z
  
### Bluetooth

- Módulo **HC‑05**:
  - `BT_RX = 2`  → conectar a TX del HC‑05
  - `BT_TX = 4`  → conectar a RX del HC‑05
- Velocidad serie: `9600 bps`.

### Servo (lápiz)

- Servo conectado al pin:
  - `SERVO_PIN = 3`
- Posiciones definidas en grados:
  - `SERVO_UP   = 55`  → lápiz arriba
  - `SERVO_DOWN = 45`  → lápiz abajo

### Sensores de home

- Dos sensores tipo endstop mecanicos:
  - `HOME_X_PIN = 7` → sensor eje X
  - `HOME_Y_PIN = 8` → sensor eje Y
- Configurados como `INPUT_PULLUP`:
  - Se asume que **cuando están activados conectan a GND**, lectura `LOW`.

### MPU6050 (acelerómetro)

- Conectado por I2C:
  - `SDA = A4`
  - `SCL = A5`
- Dirección I2C: `0x68`.

---

## Lógica principal del sistema

### 1. Homing automático al iniciar

En `setup()` se ejecuta:

```cpp
homingRoutine();
```

Esta función:

1. Sube el lápiz (`penUp()`).
2. Mueve ambos ejes en dirección negativa hasta que:
   - Ambos sensores de home se activen (`HOME_X_PIN`, `HOME_Y_PIN`), **o**
   - Se alcance un máximo de pasos de seguridad (`MAX_HOMING_STEPS`).
3. Si encuentra los dos sensores:
   - Considera que está en **(0,0)** y pone `posX = 0; posY = 0;`.
4. Si no los encuentra a tiempo:
   - Informa un error por Serial y Bluetooth.

### 2. Sistema de coordenadas 
- `X` de `0` a `1000`
- `Y` de `0` a `1000`
- Internamente, el código multiplica por 10:
  - `targetX = xVal * 10;`
  - `targetY = yVal * 10;`
- Así, `posX` y `posY` se almacenan en “**décimas de unidad lógica**”, dando más resolución en pasos de motor.

#### Validación de rango

Para evitar comandos fuera del área física del plotter:

- Si se recibe un punto con `x < 0`, `y < 0`, `x > 1000` o `y > 1000`, se **ignora** y se informa:

```text
PUNTO INVALIDO IGNORADO: (x,y) fuera de rango 0-1000
ERR:PUNTO_INVALIDO x,y     (por Bluetooth)
```

Esto se aplica tanto a:

- Listas de coordenadas (`[(x1,y1),(x2,y2),...]`).
- Puntos individuales en streaming (`x,y`).

Los puntos válidos (dentro de 0..1000) son los que se trazan normalmente.

---

## Comandos disponibles

Todos los comandos se pueden enviar:

- Por **Bluetooth** (HC‑05).

### 1. Trazo por lista de puntos

Formato:

```text
[(x1,y1),(x2,y2),...]
```

- Ejemplo:

```text
[(0,0),(100,0),(100,100),(0,100),(0,0)]
```

- Cada par `(x,y)` debe estar en **rango 0..1000**.
- Los puntos inválidos se ignoran y se sigue con el siguiente.
- El lápiz:
  - Se mueve a cada punto,
  - Baja (`penDown()`),
  - Sube (`penUp()`),
  - Y continúa al siguiente punto.

Mensajes:

- Inicio de trazo: `TRAZO: INICIANDO desde lista de puntos`
- Punto inválido: `PUNTO INVALIDO IGNORADO: (x,y) fuera de rango 0-1000`
- Progreso cada 100 puntos válidos: `TRAZO: Punto N -> (x,y)`
- Fin de trazo: `TRAZO: COMPLETADO`, puntos válidos y tiempo total.

### 2. Streaming de puntos

Comandos tipo:

```text
x,y
```

Ejemplos:

```text
10,10
200,500
```

- Cada línea es un punto único.
- Debe estar en rango 0..1000 para X e Y.
- Si es válido:
  - Se mueve al punto.
  - Marca con lápiz (baja y sube).
  - Envía `READY` por Bluetooth para indicar que puede recibir el siguiente.
- Si es inválido:
  - Se imprime mensaje de punto inválido, no se mueve, y no se marca.

Para terminar una sesión de streaming:

```text
END
```

- Muestra resumen de puntos válidos procesados y la posición final.

### 3. Comandos de control

- `home`  
  Vuelve al **origen lógico (0,0)** usando la posición interna (`moveTo(0,0)`).
  No re-ejecuta el homing con sensores; para eso se usa el homing automático inicial.

- `pos`  
  Muestra la posición actual lógica (en unidades 0..1000):

  ```text
  POS_ACTUAL:(x,y)
  ```

- `up`  
  Sube el lápiz:

  ```cpp
  penUp();
  ```

- `down`  
  Baja el lápiz (y se queda abajo):

  ```cpp
  penDown();
  ```

- `test`  
  Ejecuta un cuadrado de prueba 10x10 (en unidades lógicas):

  ```text
  (0,0) -> (100,0) -> (100,100) -> (0,100) -> (0,0)
  ```

- `speed=X`  
  Ajusta la velocidad de los motores en **ms por paso**:

  ```cpp
  stepIntervalMs = X;
  ```

  Valores menores a 2–3 ms pueden hacer que pierda pasos dependiendo de tu montaje.

- `threshold=X.YZ`  
  Ajusta el **umbral de vibración del MPU6050** en g:

  ```cpp
  MOV_THRESHOLD_G = X.YZ;
  ```

  Ejemplo:

  ```text
  threshold=0.30
  ```

---

## Comportamiento del MPU6050 (detección de vibración)

El MPU6050 se usa como un **sensor de seguridad**:

1. Se mide aceleración en g en X, Y, Z.
2. Se calcula la magnitud y se resta el componente de gravedad (~1g):

   ```cpp
   float mag   = sqrt(ax*ax + ay*ay + az*az);
   float delta = fabs(mag - 1.0);
   ```

3. Si `delta > MOV_THRESHOLD_G` (por defecto 0.50g):

   - Se considera **vibración o golpe excesivo**.
   - Se pone `mpuStop = true`.
   - Se guarda `mpuStopSince = millis();`.
   - Se muestra un mensaje por Serial/Bluetooth indicando la alerta.

4. Mientras `mpuStop == true`, en `moveTo()`:

   ```cpp
   while (mpuStop) {
     checkMPUMovement();
     delay(5);
   }
   ```

   - Los motores **se quedan congelados** en su posición actual.
   - `checkMPUMovement()` seguirá revisando el sensor.

5. Cuando la vibración baja por debajo del umbral y ha pasado al menos `MPU_MIN_STOP_MS` (5 segundos):

   - `mpuStop` pasa a `false`.
   - Se imprime un mensaje de reanudación.
   - El movimiento continúa **exactamente donde se quedó**.

Puedes ajustar:

- Sensibilidad: `MOV_THRESHOLD_G`.
- Tiempo mínimo de pausa: `MPU_MIN_STOP_MS`.

---

## Flujo general de ejecución

1. `setup()`:
   - Configura pines del 74HC595.
   - Configura sensores de home.
   - Inicia Serial y Bluetooth.
   - Ata el servo y sube el lápiz.
   - Inicia I2C y configura el MPU6050.
   - Ejecuta `homingRoutine()` para encontrar (0,0).
   - Muestra mensajes de sistema listo y parámetros actuales.

2. `loop()`:
   - Llama a `checkMPUMovement()` para monitorear vibraciones.
   - Lee comandos por Bluetooth.
   - Lee comandos por Serial (para debug).
   - Procesa comandos con `processCommand()`.

3. Cuando se reciben órdenes de movimiento (`[(x,y)...]` o `x,y`):
   - Se validan coordenadas (0..1000).
   - Se convierten a pasos internos (`*10`).
   - Se llama a `moveTo()` y a las funciones de lápiz.

---

