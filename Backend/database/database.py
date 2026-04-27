from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from utils.Logger import Logger

load_dotenv()

def conexion_database():
    try:
        uri = os.getenv("MONGO_URI")
        client = AsyncIOMotorClient(uri)
        db = client["UbiLife"]
        Logger.add_to_log("info", "Conexión a MongoDB establecida")
        return db

    except Exception as ex:
        Logger.add_to_log("error", f"Error al conectar a MongoDB: {ex}")
        return None

db = conexion_database()