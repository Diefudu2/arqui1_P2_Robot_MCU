# arqui1_P2_Robot_MCU

## App-Web
#### Dependencias
```bash
sudo apt install nodejs npm
```

### Ejecucion 
#### Backend
En terminal ejecutar (solo una vez):
```bash
npm install
```
Inicar backend:
```bash
npm start
```

#### Frontend
En terminal ejecutar:
```bash
python3 -m http.server 8080
```

En el navegador:
```text
http://localhost:8080
```
### Pruebas Unitarias
#### Backend
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
### Extra
key = Plotter