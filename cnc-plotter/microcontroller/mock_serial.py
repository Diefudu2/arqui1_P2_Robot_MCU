# mock_arduino/fake_serial.py
import time

class FakeSerial:
    def __init__(self, port, baudrate, timeout=1):
        print(f"[FakeSerial] Conectado a {port} a {baudrate} baudios")

    def write(self, data):
        print(f"[FakeSerial] Recibido: {data.decode().strip()}")

    def readline(self):
        time.sleep(0.5)
        return b"OK\n"

    def close(self):
        print("[FakeSerial] Conexión cerrada")
