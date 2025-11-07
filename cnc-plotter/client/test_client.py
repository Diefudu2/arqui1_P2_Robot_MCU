import sys
import os
sys.path.append(os.path.abspath(os.path.join(
    os.path.dirname(__file__), '..', 'server')))

from uart_bridge import enviar_comando


while True:
    cmd = input("Comando a enviar: ")
    if cmd.lower() in ['exit', 'quit']:
        break
    respuesta = enviar_comando(cmd)
    print("Respuesta:", respuesta)
