# Comandos Docker — UbiLife MongoDB

## Requisitos previos
- Docker Desktop instalado y corriendo
- Tener la carpeta `docker/dump/` (pedírsela al compañero)

---

## Configuración inicial (solo la primera vez)

```bash
# 1. Levantar los contenedores
docker-compose up -d

# 2. Cargar los datos en la base de datos
bash docker/restaurar.sh

# 3. Copiar el .env de ejemplo
cp Backend/.env.docker Backend/.env
# → Abrir Backend/.env y completar SECRET_KEY y credenciales MQTT
```

---

## Uso diario

```bash
# Encender
docker-compose up -d

# Apagar (los datos se conservan)
docker-compose down

# Ver si los contenedores están corriendo
docker ps

# Ver logs de MongoDB en tiempo real
docker logs -f ubilife_mongo
```

---

## Interfaz web (mongo-express)

Con los contenedores encendidos, abrir en el navegador:

```
http://localhost:8081
```

Desde ahí se puede ver, editar y eliminar datos sin usar la terminal.

---

## Consola de MongoDB (mongosh)

Para ejecutar comandos directamente en la base de datos:

```bash
docker exec -it ubilife_mongo mongosh
```

Una vez dentro, seleccionar la base de datos:

```js
use UbiLife
```

---

## Consultar datos

```js
// Ver todas las colecciones
show collections

// Ver todos los documentos de una colección
db.Pacientes.find()
db.Cuidadores.find()
db.ZonasSeguras.find()
db.Grupos.find()
db.Alertas.find()
db.Dispositivos.find()
db.HistorialUbicaciones.find()

// Buscar un documento por campo
db.Pacientes.findOne({ nombre_paciente: "Juan Pérez" })
db.Cuidadores.findOne({ email: "correo@ejemplo.com" })

// Ver solo algunos campos (el 0 oculta el campo, el 1 lo muestra)
db.Pacientes.find({}, { nombre_paciente: 1, _id: 1 })
```

---

## Eliminar datos

### Eliminar un documento por ID
```js
// Primero buscar el _id del documento
db.Pacientes.findOne({ nombre_paciente: "Juan Pérez" })

// Luego eliminarlo con ese _id
db.Pacientes.deleteOne({ _id: ObjectId("PEGAR_EL_ID_AQUI") })
```

### Eliminar por cualquier campo
```js
// Eliminar un cuidador por email
db.Cuidadores.deleteOne({ email: "correo@ejemplo.com" })

// Eliminar todas las alertas de un paciente
db.Alertas.deleteMany({ paciente_id: "PEGAR_EL_ID_AQUI" })

// Eliminar todas las zonas seguras de un paciente
db.ZonasSeguras.deleteMany({ paciente_id: "PEGAR_EL_ID_AQUI" })

// Eliminar todo el historial de ubicaciones de un paciente
db.HistorialUbicaciones.deleteMany({ paciente_id: "PEGAR_EL_ID_AQUI" })
```

### Vaciar una colección completa
```js
// Borra todos los documentos de la colección (la colección sigue existiendo)
db.Alertas.deleteMany({})
db.HistorialUbicaciones.deleteMany({})
db.TokensRevocados.deleteMany({})
```

---

## Editar un documento

```js
// Cambiar el nombre de un paciente
db.Pacientes.updateOne(
  { _id: ObjectId("PEGAR_EL_ID_AQUI") },
  { $set: { nombre_paciente: "Nuevo Nombre" } }
)

// Desactivar una zona segura
db.ZonasSeguras.updateOne(
  { _id: ObjectId("PEGAR_EL_ID_AQUI") },
  { $set: { activa: false } }
)

// Limpiar el fcm_token de un cuidador
db.Cuidadores.updateOne(
  { email: "correo@ejemplo.com" },
  { $unset: { fcm_token: "" } }
)
```

---

## Reiniciar la base de datos desde cero

```js
// Dentro de mongosh — elimina TODAS las colecciones
db.Cuidadores.drop()
db.Familiares.drop()
db.Pacientes.drop()
db.Dispositivos.drop()
db.DispositivosDisponibles.drop()
db.ZonasSeguras.drop()
db.Grupos.drop()
db.Alertas.drop()
db.HistorialUbicaciones.drop()
db.TokensRevocados.drop()
```

O bien, restaurar el dump original nuevamente:

```bash
# Desde la terminal (fuera de mongosh)
bash docker/restaurar.sh
```

---

## Eliminar el volumen (borrado total)

Esto elimina todos los datos permanentemente. Útil para empezar desde cero.

```bash
docker-compose down
docker volume rm ubilife_mongo_data
docker-compose up -d
bash docker/restaurar.sh   # volver a cargar los datos del dump
```

---

## Salir de mongosh

```
exit
```
