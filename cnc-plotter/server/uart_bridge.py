# server/uart_bridge.py
import sys
import os
sys.path.append(os.path.abspath(os.path.join(
    os.path.dirname(__file__), '..', 'microcontroller')))
from mock_serial import FakeSerial

ser = FakeSerial(port='COM3', baudrate=9600)

def enviar_comando(cmd):
    ser.write((cmd + '\n').encode())
    respuesta = ser.readline().decode().strip()
    return respuesta
