// --- Pines 74HC595 ---
int pinLatch = 12;   // RCLK
int pinClock = 11;   // SRCLK
int pinData  = 13;   // SER (DS)

// --- Pines HC-05 (usa SoftwareSerial si no tienes Serial1) ---
#include <SoftwareSerial.h>
#include <Wire.h>
#include <Servo.h>

const int BT_RX = 2;  // Conectar a TX del HC-05
const int BT_TX = 4;  // Conectar a RX del HC-05
SoftwareSerial bluetooth(BT_RX, BT_TX);

// --- Servo para lápiz ---
Servo servoLapiz;
const int SERVO_PIN  = 3;
const int SERVO_UP   = 55;  // grados lápiz ARRIBA (ajustado por ti)
const int SERVO_DOWN = 45;  // grados lápiz ABAJO (ajustado por ti)

// --- Sensores de home ---
const int HOME_X_PIN = 7;
const int HOME_Y_PIN = 8;

// --- Secuencia half-step (8 estados) 28BYJ-48 ---
const byte halfStepSeq[8] = {
  0b0001, 0b0011, 0b0010, 0b0110,
  0b0100, 0b1100, 0b1000, 0b1001
};

// --- Configurables motores ---
const long stepsPerRev = 4096;
unsigned long stepIntervalMs = 2;

// --- Inversión de sentido físico ---
const int invertX = -1;
const int invertY = 1;

// --- Estado de motores ---
int idxA = 0, idxB = 0;
long posX = 0, posY = 0;

// --- Buffer para recibir datos largos ---
String inputBuffer = "";
bool receivingData = false;

// --- Streaming ---
bool streamingSession = false;
unsigned long streamedPoints = 0;

// ===========================
//     MPU6050 (I2C)
// ===========================
const int MPU_ADDR        = 0x68;
const int ACCEL_XOUT_H    = 0x3B;
// Acelerómetro configurado en ±2g
const float ACCEL_SENS_2G = 16384.0;

// Umbral de movimiento en g (ajústalo según pruebas)
// Puedes cambiarlo en tiempo real con el comando: threshold=0.15
float MOV_THRESHOLD_G = 0.50;

// Muestreo cada 5 ms (~200 Hz)
const unsigned long MPU_SAMPLE_US   = 5000UL;
// Pausa mínima de seguridad cuando hay vibración fuerte (ms)
const unsigned long MPU_MIN_STOP_MS = 5000UL; // 5 segundos

// Administración de estados MPU
bool mpuEnMovimiento = false; // estado anterior "sobre umbral"
bool mpuStop         = false; // si true, los motores se detienen
unsigned long mpuStopSince = 0;  // momento en que se activó la pausa

// ===========================
//   FUNCIONES 74HC595
// ===========================
void write595(byte combined) {
  digitalWrite(pinLatch, LOW);
  shiftOut(pinData, pinClock, LSBFIRST, combined);
  digitalWrite(pinLatch, HIGH);
}

void updateOutputs() {
  byte outX = (halfStepSeq[idxB] & 0x0F) << 4;
  byte outY = halfStepSeq[idxA] & 0x0F;
  write595(outX | outY);
}

// ===========================
//   FUNCIONES SERVO (LÁPIZ)
// ===========================
void penUp() {
  servoLapiz.write(SERVO_UP);
  delay(300);  // tiempo para que llegue a posición
}

void penDown() {
  servoLapiz.write(SERVO_DOWN);
  delay(500);  // medio segundo de contacto
}

// ===========================
//   FUNCIONES HOME SENSORES
// ===========================
bool isHomeX() {
  // Asumiendo sensor a GND con INPUT_PULLUP: LOW = activado
  return digitalRead(HOME_X_PIN) == LOW;
}

bool isHomeY() {
  return digitalRead(HOME_Y_PIN) == LOW;
}

// ===========================
//   FUNCIONES MPU6050 (I2C)
// ===========================
void mpuWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

void mpuInit() {
  Wire.begin();
  // Quitar sleep
  mpuWrite(0x6B, 0x00);
  delay(10);
  // Filtro DLPF ~44Hz
  mpuWrite(0x1A, 3);
  // Acelerómetro ±2g para mejor resolución
  mpuWrite(0x1C, 0x00);   // AFS_SEL = 0 -> ±2g
  // SMPLRT_DIV (opcional, ~200Hz con DLPF activo)
  mpuWrite(0x19, 4);
}

// Leer aceleración en g
void readAccelG(float &ax, float &ay, float &az) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(ACCEL_XOUT_H);
  Wire.endTransmission(false);         // repeated start

  Wire.requestFrom((uint8_t)MPU_ADDR, (uint8_t)6);
  if (Wire.available() >= 6) {
    int16_t rx = (Wire.read() << 8) | Wire.read();
    int16_t ry = (Wire.read() << 8) | Wire.read();
    int16_t rz = (Wire.read() << 8) | Wire.read();
    ax = rx / ACCEL_SENS_2G;
    ay = ry / ACCEL_SENS_2G;
    az = rz / ACCEL_SENS_2G;
  } else {
    ax = ay = az = 0;
  }
}

// Lógica de detección de movimiento excesivo (ALERTA + STOP/RESUME con espera mínima)
void checkMPUMovement() {
  static unsigned long lastMPUTick = 0;
  unsigned long now = micros();
  if (now - lastMPUTick < MPU_SAMPLE_US) return;
  lastMPUTick = now;

  float ax, ay, az;
  readAccelG(ax, ay, az);

  float mag   = sqrt(ax*ax + ay*ay + az*az);
  float delta = fabs(mag - 1.0);

  bool sobreUmbral = (delta > MOV_THRESHOLD_G);
  unsigned long nowMs = millis();

  // 1) Si acabamos de pasar el umbral (flanco de subida)
  if (sobreUmbral && !mpuEnMovimiento) {
    mpuStop = true;
    mpuStopSince = nowMs;

    Serial.print(F("ALERTA MPU: Vibracion excesiva. delta="));
    Serial.print(delta, 3);
    Serial.print(F(" g, umbral="));
    Serial.print(MOV_THRESHOLD_G, 3);
    Serial.println(F(" g -> Pausando motores"));
    bluetooth.print(F("MPU:STOP delta="));
    bluetooth.print(delta, 3);
    bluetooth.print(F(" thr="));
    bluetooth.println(MOV_THRESHOLD_G, 3);
  }

  // 2) Si estamos en PAUSA y ya hemos bajado del umbral, comprobar tiempo mínimo
  if (mpuStop && !sobreUmbral) {
    unsigned long stoppedFor = nowMs - mpuStopSince;
    if (stoppedFor >= MPU_MIN_STOP_MS) {
      mpuStop = false;
      Serial.print(F("MPU: Reanudando movimiento tras "));
      Serial.print(stoppedFor / 1000.0, 1);
      Serial.println(F(" s de pausa"));
      bluetooth.println(F("MPU:RESUME"));
    }
  }

  // 3) Actualizar estado anterior (solo para flanco de subida)
  mpuEnMovimiento = sobreUmbral;
}

// ===========================
//        MOTORES
// ===========================
void moveTo(long targetX, long targetY) {
  long dx = targetX - posX;
  long dy = targetY - posY;
  
  if (dx == 0 && dy == 0) return;
  
  int stepX = (dx > 0) ? 1 : -1;
  int stepY = (dy > 0) ? 1 : -1;
  dx = abs(dx);
  dy = abs(dy);

  long steps = max(dx, dy);
  long errX = 0, errY = 0;

  for (long i = 0; i < steps; i++) {

    // Si el MPU pidió STOP, esperar aquí hasta que se libere
    while (mpuStop) {
      checkMPUMovement(); // seguir actualizando el estado
      delay(5);           // pequeño delay para no saturar CPU
    }

    errX += dx;
    errY += dy;

    if (errX >= steps) {
      posX += stepX;
      idxB = (idxB + stepX * invertX + 8) % 8;
      errX -= steps;
    }
    if (errY >= steps) {
      posY += stepY;
      idxA = (idxA + stepY * invertY + 8) % 8;
      errY -= steps;
    }

    updateOutputs();

    delayMicroseconds(stepIntervalMs * 1000);

    // Seguimos leyendo MPU periódicamente
    checkMPUMovement();
  }
}

// Rutina de homing al inicio (solo se llama en setup)
void homingRoutine() {
  Serial.println(F("HOMING: Iniciando busqueda de origen (0,0)"));
  bluetooth.println(F("HOM:START"));

  penUp(); // evitar rayar

  const long MAX_HOMING_STEPS = 60000; // ajusta según tu mecánica
  long steps = 0;

  while ((!isHomeX() || !isHomeY()) && steps < MAX_HOMING_STEPS) {
    // Respetar también STOP por MPU en homing
    checkMPUMovement();
    while (mpuStop) {
      checkMPUMovement();
      delay(5);
    }

    // Mover hacia negativo en cada eje que no esté en home
    if (!isHomeX()) {
      posX -= 1;
      idxB = (idxB - 1 * invertX + 8) % 8;
    }
    if (!isHomeY()) {
      posY -= 1;
      idxA = (idxA - 1 * invertY + 8) % 8;
    }

    updateOutputs();
    delayMicroseconds(stepIntervalMs * 1000);
    steps++;
  }

  if (isHomeX() && isHomeY()) {
    posX = 0;
    posY = 0;
    Serial.println(F("HOMING: Origen encontrado en (0,0)"));
    bluetooth.println(F("HOM:OK"));
  } else {
    Serial.println(F("HOMING: ERROR - no se detectaron sensores dentro del recorrido maximo"));
    bluetooth.println(F("HOM:ERR"));
  }
}

// --- Procesar coordenadas en bloque (no usado por bluetoothTest.js, pero disponible) ---
void processCoordinates(String input) {
  input.trim();
  input.replace(" ", "");
  input.replace("\n", "");
  input.replace("\r", "");
  
  if (!input.startsWith("[") || !input.endsWith("]")) {
    bluetooth.println(F("ERR:FORMATO_COORD"));
    Serial.println(F("ERROR: Formato de coordenadas incorrecto"));
    return;
  }

  Serial.print(F("DEBUG LISTA COMPLETA: '"));
  Serial.print(input);
  Serial.println(F("'"));
  
  bluetooth.println(F("TRAZO: INICIANDO desde lista de puntos"));
  Serial.println(F("TRAZO: INICIANDO desde lista de puntos"));
  unsigned long startTime = millis();
  
  input = input.substring(1, input.length() - 1);
  
  int coordCount = 0;
  int startPos = 0;
  
  while (startPos < input.length()) {
    int openParen = input.indexOf('(', startPos);
    if (openParen == -1) break;
    
    int closeParen = input.indexOf(')', openParen);
    if (closeParen == -1) {
      bluetooth.println(F("ERR:PARENTESIS"));
      Serial.println(F("ERROR: Parentesis sin cerrar en lista de puntos"));
      break;
    }
    
    String coords = input.substring(openParen + 1, closeParen);
    int commaIndex = coords.indexOf(',');

    Serial.print(F("DEBUG COORD RAW: '"));
    Serial.print(coords);
    Serial.println(F("'"));
    
    if (commaIndex > 0) {
      long xVal = coords.substring(0, commaIndex).toInt();
      long yVal = coords.substring(commaIndex + 1).toInt();

      Serial.print(F("DEBUG COORD PARSED x="));
      Serial.print(xVal);
      Serial.print(F(" y="));
      Serial.println(yVal);

      if (xVal < 0 || xVal > 1000 || yVal < 0 || yVal > 1000) {
        Serial.print(F("PUNTO INVALIDO IGNORADO: ("));
        Serial.print(xVal);
        Serial.print(F(",")); 
        Serial.print(yVal);
        Serial.println(F(") fuera de rango 0-1000"));
        bluetooth.print(F("ERR:PUNTO_INVALIDO "));
        bluetooth.print(xVal);
        bluetooth.print(F(",")); 
        bluetooth.println(yVal);
      } else {
        long targetX = xVal * 10;
        long targetY = yVal * 10;
        
        coordCount++;
        
        if (coordCount % 100 == 0) {
          Serial.print(F("TRAZO: Punto "));
          Serial.print(coordCount);
          Serial.print(F(" -> ("));
          Serial.print(targetX / 10);
          Serial.print(F(",")); 
          Serial.print(targetY / 10);
          Serial.println(F(")"));
          bluetooth.print(F("P="));
          bluetooth.println(coordCount);
        }
        
        moveTo(targetX, targetY);
        penDown();
        penUp();
      }
    }
    
    startPos = closeParen + 1;
  }
  
  unsigned long duration = millis() - startTime;
  
  bluetooth.println(F("TRAZO: COMPLETADO"));
  bluetooth.print(F("PUNTOS="));
  bluetooth.println(coordCount);
  bluetooth.print(F("TIEMPO_MS="));
  bluetooth.println(duration);
  
  Serial.println(F("TRAZO: COMPLETADO"));
  Serial.print(F("Puntos totales validos: "));
  Serial.println(coordCount);
  Serial.print(F("Tiempo total (ms): "));
  Serial.println(duration);
  Serial.print(F("Posicion final: ("));
  Serial.print(posX / 10);
  Serial.print(F(",")); 
  Serial.print(posY / 10);
  Serial.println(F(")"));
}

// --- Funciones para streaming punto a punto ---
bool parsePointCommand(const String& input, long& targetX, long& targetY) {
  int commaIdx = input.indexOf(',');
  if (commaIdx <= 0) return false;

  long xVal = input.substring(0, commaIdx).toInt();
  long yVal = input.substring(commaIdx + 1).toInt();

  if (xVal < 0 || xVal > 1000 || yVal < 0 || yVal > 1000) {
    Serial.print(F("PUNTO STREAM INVALIDO IGNORADO: ("));
    Serial.print(xVal);
    Serial.print(F(",")); 
    Serial.print(yVal);
    Serial.println(F(") fuera de rango 0-1000"));
    bluetooth.print(F("ERR:PUNTO_STREAM_INVALIDO "));
    bluetooth.print(xVal);
    bluetooth.print(F(",")); 
    bluetooth.println(yVal);
    return false;
  }

  targetX = xVal * 10;
  targetY = yVal * 10;
  return true;
}

void handleStreamingCoordinate(long targetX, long targetY) {
  streamingSession = true;
  streamedPoints++;
  Serial.print(F("STREAM: Recibido punto valido ("));
  Serial.print(targetX / 10);
  Serial.print(F(",")); 
  Serial.print(targetY / 10);
  Serial.println(F(")"));
  
  moveTo(targetX, targetY);

  // Marcar punto con el lápiz antes del READY
  penDown();
  penUp();

  // ACK para bluetoothTest.js
  bluetooth.println(F("READY"));
  Serial.println(F("READY"));
}

bool tryHandlePointCommand(const String& input) {
  long targetX = 0;
  long targetY = 0;
  if (!parsePointCommand(input, targetX, targetY)) {
    return false;
  }
  handleStreamingCoordinate(targetX, targetY);
  return true;
}

// Cerrar sesión de streaming (llamado al recibir "END")
void closeStreamingSession() {
  if (streamingSession) {
    bluetooth.println(F("STREAM: Fin de sesion"));
    bluetooth.print(F("STREAM:PUNTOS="));
    bluetooth.println(streamedPoints);
    bluetooth.print(F("STREAM:POS="));
    bluetooth.print(posX / 10);
    bluetooth.print(F(",")); 
    bluetooth.println(posY / 10);
    
    Serial.println(F("STREAM: Sesion finalizada"));
    Serial.print(F("STREAM: Puntos procesados: "));
    Serial.println(streamedPoints);
    Serial.print(F("STREAM: Posicion final: ("));
    Serial.print(posX / 10);
    Serial.print(F(",")); 
    Serial.print(posY / 10);
    Serial.println(F(")"));

    // ACK final para bluetoothTest.js: espera "DONE" tras enviar "END"
    bluetooth.println(F("DONE"));
    Serial.println(F("STREAM: DONE enviado al cliente"));

    streamingSession = false;
    streamedPoints = 0;
  } else {
    bluetooth.println(F("STREAM: No habia sesion activa"));
    Serial.println(F("STREAM: No hay sesion activa"));
  }
}

// --- Procesar comandos (funciona para Serial y Bluetooth) ---
void processCommand(String input) {
  input.trim();
  if (input.length() == 0) return;  // ignorar línea vacía

  Serial.print(F("DEBUG processCommand input: '"));
  Serial.print(input);
  Serial.println(F("'"));

  if (input.equalsIgnoreCase("END")) {
    closeStreamingSession();
    return;
  }
  if (tryHandlePointCommand(input)) {
    Serial.println(F("DEBUG: interpretado como punto STREAM (x,y)"));
    return;
  }
  if (input.startsWith("[")) {
    Serial.println(F("DEBUG: interpretado como LISTA de coordenadas"));
    processCoordinates(input);
    return;
  }
  else if (input.equalsIgnoreCase("home")) {
    bluetooth.println(F("CMD:HOME -> Volviendo a origen logico (0,0)"));
    Serial.println(F("CMD:HOME -> Volviendo a origen (0,0)"));
    penUp();           // evitar rayar al volver a home
    moveTo(0, 0);
    bluetooth.println(F("CMD:HOME -> Llegamos a (0,0)"));
    Serial.println(F("CMD:HOME -> Llegamos a (0,0)"));
  }
  else if (input.equalsIgnoreCase("pos")) {
    bluetooth.print(F("POS_ACTUAL:("));
    bluetooth.print(posX / 10);
    bluetooth.print(F(",")); 
    bluetooth.print(posY / 10);
    bluetooth.println(F(")"));
    Serial.print(F("POS_ACTUAL:("));
    Serial.print(posX / 10);
    Serial.print(F(",")); 
    Serial.print(posY / 10);
    Serial.println(F(")"));
  }
  else if (input.equalsIgnoreCase("up")) {
    penUp();
    bluetooth.println(F("PEN:UP -> Lapiz arriba"));
    Serial.println(F("PEN:UP -> Lapiz arriba"));
  }
  else if (input.equalsIgnoreCase("down")) {
    penDown();
    bluetooth.println(F("PEN:DOWN -> Lapiz abajo (mantener)"));
    Serial.println(F("PEN:DOWN -> Lapiz abajo (mantener)"));
  }
  else if (input.equalsIgnoreCase("test")) {
    bluetooth.println(F("TEST: Cuadrado 10x10 con lapiz"));
    Serial.println(F("TEST: Iniciando cuadrado 10x10 con lapiz"));
    penUp();
    moveTo(100, 0);
    penDown(); penUp();
    moveTo(100, 100);
    penDown(); penUp();
    moveTo(0, 100);
    penDown(); penUp();
    moveTo(0, 0);
    penDown(); penUp();
    bluetooth.println(F("TEST:OK"));
    Serial.println(F("TEST:OK - Cuadrado completo"));
  }
  else if (input.startsWith("speed=")) {
    stepIntervalMs = input.substring(6).toInt();
    bluetooth.print(F("VEL_MOTOR_MS="));
    bluetooth.println(stepIntervalMs);
    Serial.print(F("Velocidad de motor actualizada (ms por paso): "));
    Serial.println(stepIntervalMs);
  }
  else if (input.startsWith("threshold=")) {
    MOV_THRESHOLD_G = input.substring(10).toFloat();
    bluetooth.print(F("THRESHOLD_G="));
    bluetooth.println(MOV_THRESHOLD_G, 3);
    Serial.print(F("Nuevo umbral de vibracion MOV_THRESHOLD_G = "));
    Serial.print(MOV_THRESHOLD_G, 3);
    Serial.println(F(" g"));
  }
  else {
    bluetooth.println(F("CMD:DESCONOCIDO"));
    Serial.print(F("Comando desconocido recibido: "));
    Serial.println(input);
  }
}

// ===========================
//        setup / loop
// ===========================
void setup() {
  pinMode(pinLatch, OUTPUT);
  pinMode(pinClock, OUTPUT);
  pinMode(pinData,  OUTPUT);
  write595(0x00);
  
  // Pines sensores home
  pinMode(HOME_X_PIN, INPUT_PULLUP);
  pinMode(HOME_Y_PIN, INPUT_PULLUP);

  Serial.begin(9600);
  bluetooth.begin(9600);

  // Servo
  servoLapiz.attach(SERVO_PIN);
  servoLapiz.write(SERVO_UP);  // empezar con lápiz arriba
  delay(500);

  // I2C + MPU
  Wire.begin();
  mpuInit();

  // HOMING al inicio (solo una vez)
  homingRoutine();

  Serial.println(F("========================================"));
  Serial.println(F("SISTEMA LISTO: CNC + Bluetooth + MPU6050 + Servo"));
  Serial.println(F("Comandos principales por Serial o Bluetooth:"));
  Serial.println(F("  x,y                    - Punto unico en streaming (0..1000)"));
  Serial.println(F("  END                    - Fin de sesion streaming (envia DONE)"));
  Serial.println(F("  [(x1,y1),...]          - Trazo por lista (solo via Serial)"));
  Serial.println(F("  home                   - Ir al origen logico (0,0)"));
  Serial.println(F("  pos                    - Mostrar posicion actual"));
  Serial.println(F("  speed=X                - Velocidad en ms por paso"));
  Serial.println(F("  test                   - Cuadrado de prueba 10x10"));
  Serial.println(F("  threshold=X.YZ         - Cambiar umbral MPU en g"));
  Serial.println(F("========================================"));
  Serial.print(F("Umbral vibracion actual MOV_THRESHOLD_G = "));
  Serial.print(MOV_THRESHOLD_G, 3);
  Serial.println(F(" g"));
  Serial.print(F("Pausa minima ante vibracion fuerte = "));
  Serial.print(MPU_MIN_STOP_MS / 1000.0, 1);
  Serial.println(F(" s"));
  
  bluetooth.println(F("SISTEMA LISTO: CNC+MPU+SERVO"));
}

void loop() {
  // Chequeo MPU aun cuando no se mueven motores
  checkMPUMovement();

  // --- LEER DESDE BLUETOOTH ---
  while (bluetooth.available() > 0) {
    char c = bluetooth.read();
    
    if (c == '[') {
      inputBuffer = "[";
      receivingData = true;
      bluetooth.println(F("RX:INICIO_LISTA_COORD"));
      Serial.println(F("BT: Inicio de recepcion de lista de coordenadas"));
    }
    else if (c == ']' && receivingData) {
      inputBuffer += ']';
      receivingData = false;
      bluetooth.print(F("RX:LONGITUD="));
      bluetooth.println(inputBuffer.length());
      Serial.print(F("BT: Lista de coordenadas recibida, chars="));
      Serial.println(inputBuffer.length());
      
      Serial.print(F("DEBUG inputBuffer completo (BT): '"));
      Serial.print(inputBuffer);
      Serial.println(F("'"));

      processCommand(inputBuffer);
      inputBuffer = "";
    }
    else if (receivingData) {
      inputBuffer += c;
      
      if (inputBuffer.length() % 1000 == 0) {
        bluetooth.print(F("RX:PROGRESO_CHARS="));
        bluetooth.println(inputBuffer.length());
        Serial.print(F("BT: Progreso recepcion lista (chars): "));
        Serial.println(inputBuffer.length());
      }
    }
    else if (c == '\n') {
      processCommand(inputBuffer);
      inputBuffer = "";
    }
    else if (c != '\r') {
      inputBuffer += c;
    }
  }
  
  // --- LEER DESDE SERIAL MONITOR (para debug) ---
  while (Serial.available() > 0) {
    char c = Serial.read();
    
    if (c == '[') {
      inputBuffer = "[";
      receivingData = true;
      Serial.println(F("SERIAL: Inicio de recepcion de lista de coordenadas"));
    }
    else if (c == ']' && receivingData) {
      inputBuffer += ']';
      receivingData = false;
      Serial.print(F("SERIAL: Lista de coordenadas recibida, chars="));
      Serial.println(inputBuffer.length());

      Serial.print(F("DEBUG inputBuffer completo (SERIAL): '"));
      Serial.print(inputBuffer);
      Serial.println(F("'"));
      
      processCommand(inputBuffer);
      inputBuffer = "";
    }
    else if (receivingData) {
      inputBuffer += c;
    }
    else if (c == '\n') {
      processCommand(inputBuffer);
      inputBuffer = "";
    }
    else if (c != '\r') {
      inputBuffer += c;
    }
  }
}
