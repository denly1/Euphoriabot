"""
FastAPI backend для подключения веб-приложения к PostgreSQL
Предоставляет REST API для получения афиш из базы данных
"""

import os
import uuid
import shutil
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from typing import Optional
import asyncpg
from contextlib import asynccontextmanager
import logging
import httpx

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TusaBotAPI")

# Настройки БД из переменных окружения
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "EuphoriaDB")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "1")

# Telegram Bot Token для получения файлов
BOT_TOKEN = os.getenv("BOT_TOKEN", "")

# Список ID админов
ADMIN_IDS = set(map(int, os.getenv("ADMIN_IDS", "825042510,8160172817").split(",")))

# Глобальный пул соединений
db_pool: Optional[asyncpg.Pool] = None


# Функция проверки админа
def is_admin(user_id: int) -> bool:
    """Проверяет, является ли пользователь админом"""
    return user_id in ADMIN_IDS


# Модели данных
class Poster(BaseModel):
    id: int
    file_id: str
    caption: Optional[str]
    ticket_url: Optional[str]
    created_at: str
    is_active: bool


class PosterForWeb(BaseModel):
    """Модель афиши для веб-приложения (без file_id)"""
    id: int
    title: str  # Первая строка caption
    subtitle: str  # Остальной caption
    ticket_url: Optional[str]
    image_url: str  # URL для получения изображения через Telegram Bot API
    created_at: str


class StoryCreate(BaseModel):
    """Модель для создания Story"""
    file_id: str
    caption: Optional[str] = None
    order_num: int = 0


class StoryUpdate(BaseModel):
    """Модель для обновления Story"""
    caption: Optional[str] = None
    order_num: Optional[int] = None
    is_active: Optional[bool] = None


# Lifespan context manager для управления пулом БД
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global db_pool
    try:
        db_pool = await asyncpg.create_pool(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            min_size=1,
            max_size=10,
        )
        logger.info("Database pool created successfully")
    except Exception as e:
        logger.error(f"Failed to create database pool: {e}")
        raise
    
    yield
    
    # Shutdown
    if db_pool:
        await db_pool.close()
        logger.info("Database pool closed")


# Создание приложения FastAPI
app = FastAPI(
    title="TusaBot API",
    description="API для получения афиш мероприятий",
    version="1.0.0",
    lifespan=lifespan
)

# Настройка CORS для доступа из веб-приложения
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Эндпоинты API

@app.get("/")
async def root():
    """Корневой эндпоинт"""
    return {
        "message": "TusaBot API",
        "version": "1.0.0",
        "endpoints": {
            "/posters": "Получить все активные афиши",
            "/posters/latest": "Получить последнюю афишу",
            "/posters/{poster_id}": "Получить афишу по ID"
        }
    }


@app.get("/health")
async def health_check():
    """Проверка здоровья API"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database pool not initialized")
    
    try:
        async with db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Database connection failed: {str(e)}")


@app.get("/posters")
async def get_posters():
    """Получить все активные афиши"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, file_id, caption, ticket_url, venue_map_file_id, created_at, is_active
                FROM posters
                WHERE is_active = true
                ORDER BY created_at DESC
                """
            )
            
            posters = []
            for row in rows:
                file_id = row['file_id']
                # Проверяем, является ли file_id локальным путем к файлу
                is_local_file = file_id.startswith('/posters/') or file_id.startswith('posters/')
                
                caption = row['caption'] or ""
                lines = caption.split('\n', 1)
                title = lines[0] if lines else "Мероприятие"
                subtitle = lines[1] if len(lines) > 1 else ""
                
                # Формируем URL для фото
                if is_local_file:
                    # Убедимся что путь начинается с /
                    photo_url = file_id if file_id.startswith('/') else f'/{file_id}'
                else:
                    # Это Telegram file_id, используем прокси
                    photo_url = f"/photo/{file_id}"
                
                posters.append({
                    "id": row['id'],
                    "file_id": file_id,
                    "photo_url": photo_url,
                    "caption": caption,
                    "title": title,
                    "subtitle": subtitle,
                    "ticket_url": row['ticket_url'],
                    "venue_map_file_id": row['venue_map_file_id'],
                    "created_at": row['created_at'].isoformat(),
                    "is_active": row['is_active']
                })
            
            return posters
    except Exception as e:
        logger.error(f"Failed to fetch posters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/posters/latest")
async def get_latest_poster():
    """Получить последнюю активную афишу"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, file_id, caption, ticket_url, venue_map_file_id, created_at, is_active
                FROM posters
                WHERE is_active = true
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
            
            if not row:
                raise HTTPException(status_code=404, detail="No active posters found")
            
            # Парсим caption для разделения на title и subtitle
            caption = row['caption'] or ""
            lines = caption.split('\n', 1)
            title = lines[0] if lines else "Мероприятие"
            subtitle = lines[1] if len(lines) > 1 else ""
            
            # file_id теперь может быть путем к файлу (/posters/poster_123.jpg) или Telegram file_id
            file_id = row['file_id']
            is_local_file = file_id.startswith('/posters/') or file_id.startswith('posters/')
            
            # Формируем URL для фото
            if is_local_file:
                photo_url = file_id if file_id.startswith('/') else f'/{file_id}'
            else:
                photo_url = f"/photo/{file_id}"
            
            return {
                "id": row['id'],
                "file_id": file_id,
                "photo_url": photo_url,
                "caption": caption,
                "title": title,
                "subtitle": subtitle,
                "ticket_url": row['ticket_url'],
                "venue_map_file_id": row['venue_map_file_id'],
                "created_at": row['created_at'].isoformat(),
                "is_active": row['is_active']
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch latest poster: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/posters/{poster_id}")
async def get_poster(poster_id: int):
    """Получить афишу по ID"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, file_id, caption, ticket_url, venue_map_file_id, created_at, is_active
                FROM posters
                WHERE id = $1
                """,
                poster_id
            )
            
            if not row:
                raise HTTPException(status_code=404, detail="Poster not found")
            
            return {
                "id": row['id'],
                "file_id": row['file_id'],
                "caption": row['caption'],
                "ticket_url": row['ticket_url'],
                "venue_map_file_id": row['venue_map_file_id'],
                "created_at": row['created_at'].isoformat(),
                "is_active": row['is_active']
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch poster {poster_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stats")
async def get_stats():
    """Получить общую статистику"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        async with db_pool.acquire() as conn:
            # Статистика пользователей
            user_stats = await conn.fetchrow("""
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(vk_id) as users_with_vk,
                    COUNT(CASE WHEN gender = 'male' THEN 1 END) as male_users,
                    COUNT(CASE WHEN gender = 'female' THEN 1 END) as female_users
                FROM users
            """)
            
            # Статистика афиш
            poster_stats = await conn.fetchrow("""
                SELECT 
                    COUNT(*) as total_posters,
                    COUNT(CASE WHEN is_active = true THEN 1 END) as active_posters
                FROM posters
            """)
            
            return {
                "users": {
                    "total": user_stats['total_users'],
                    "with_vk": user_stats['users_with_vk'],
                    "male": user_stats['male_users'],
                    "female": user_stats['female_users']
                },
                "posters": {
                    "total": poster_stats['total_posters'],
                    "active": poster_stats['active_posters']
                }
            }
    except Exception as e:
        logger.error(f"Failed to fetch stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/photo/{file_id}")
async def get_photo(file_id: str):
    """Получить фото афиши через Telegram Bot API"""
    if not BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Bot token not configured")
    
    try:
        # Получаем информацию о файле
        async with httpx.AsyncClient() as client:
            file_info_url = f"https://api.telegram.org/bot{BOT_TOKEN}/getFile?file_id={file_id}"
            file_response = await client.get(file_info_url)
            file_data = file_response.json()
            
            if not file_data.get("ok"):
                raise HTTPException(status_code=404, detail="File not found")
            
            file_path = file_data["result"]["file_path"]
            
            # Скачиваем файл
            file_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}"
            photo_response = await client.get(file_url)
            
            if photo_response.status_code != 200:
                raise HTTPException(status_code=404, detail="Failed to download photo")
            
            # Возвращаем фото
            return StreamingResponse(
                iter([photo_response.content]),
                media_type="image/jpeg",
                headers={"Cache-Control": "public, max-age=86400"}  # Кеш на 24 часа
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get photo {file_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stories")
async def get_stories():
    """Получить все активные Stories (3 слота)"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, file_id, caption, slot_number, created_at, is_active
                FROM stories
                WHERE is_active = true
                ORDER BY slot_number ASC
                """
            )
            
            stories = []
            for row in rows:
                file_id = row['file_id']
                # Проверяем, является ли это локальным файлом или Telegram file_id
                is_local_file = file_id.startswith('/uploads/') or file_id.startswith('uploads/')
                
                if is_local_file:
                    photo_url = file_id if file_id.startswith('/') else f'/{file_id}'
                else:
                    photo_url = f"/photo/{file_id}"
                
                stories.append({
                    "id": row['id'],
                    "file_id": file_id,
                    "photo_url": photo_url,
                    "caption": row['caption'],
                    "slot_number": row['slot_number'],
                    "created_at": row['created_at'].isoformat(),
                    "is_active": row['is_active']
                })
            
            return stories
    except Exception as e:
        logger.error(f"Failed to fetch stories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/stories")
async def create_story(story: StoryCreate, user_id: int):
    """Создать новую Story (только для админов)"""
    if not is_admin(user_id):
        raise HTTPException(status_code=403, detail="Access denied. Admins only.")
    
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO stories (file_id, caption, order_num, is_active)
                VALUES ($1, $2, $3, true)
                RETURNING id, file_id, caption, order_num, created_at, is_active
                """,
                story.file_id, story.caption, story.order_num
            )
            
            return {
                "id": row['id'],
                "file_id": row['file_id'],
                "caption": row['caption'],
                "order_num": row['order_num'],
                "created_at": row['created_at'].isoformat(),
                "is_active": row['is_active']
            }
    except Exception as e:
        logger.error(f"Failed to create story: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/stories/{story_id}")
async def update_story(story_id: int, story: StoryUpdate, user_id: int):
    """Обновить Story (только для админов)"""
    if not is_admin(user_id):
        raise HTTPException(status_code=403, detail="Access denied. Admins only.")
    
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        async with db_pool.acquire() as conn:
            # Формируем SQL динамически в зависимости от того, что обновляется
            updates = []
            values = []
            param_num = 1
            
            if story.caption is not None:
                updates.append(f"caption = ${param_num}")
                values.append(story.caption)
                param_num += 1
            
            if story.order_num is not None:
                updates.append(f"order_num = ${param_num}")
                values.append(story.order_num)
                param_num += 1
            
            if story.is_active is not None:
                updates.append(f"is_active = ${param_num}")
                values.append(story.is_active)
                param_num += 1
            
            if not updates:
                raise HTTPException(status_code=400, detail="No fields to update")
            
            values.append(story_id)
            sql = f"""
                UPDATE stories
                SET {', '.join(updates)}
                WHERE id = ${param_num}
                RETURNING id, file_id, caption, order_num, created_at, is_active
            """
            
            row = await conn.fetchrow(sql, *values)
            
            if not row:
                raise HTTPException(status_code=404, detail="Story not found")
            
            return {
                "id": row['id'],
                "file_id": row['file_id'],
                "caption": row['caption'],
                "order_num": row['order_num'],
                "created_at": row['created_at'].isoformat(),
                "is_active": row['is_active']
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update story {story_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/stories/{story_id}")
async def delete_story(story_id: int, user_id: int):
    """Удалить Story (только для админов)"""
    if not is_admin(user_id):
        raise HTTPException(status_code=403, detail="Access denied. Admins only.")
    
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        async with db_pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM stories WHERE id = $1",
                story_id
            )
            
            if result == "DELETE 0":
                raise HTTPException(status_code=404, detail="Story not found")
            
            return {"message": "Story deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete story {story_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/check-admin/{user_id}")
async def check_admin_endpoint(user_id: int):
    """Проверить, является ли пользователь админом"""
    return {"is_admin": is_admin(user_id)}


@app.post("/upload-story-photo")
async def upload_story_photo(
    user_id: int = Form(...),
    file: UploadFile = File(...)
):
    """Загрузить фото для Story"""
    # Проверка прав админа
    if not is_admin(user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Проверка типа файла
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Создаем директорию для хранения если её нет
        upload_dir = Path("uploads/stories")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Генерируем уникальное имя файла
        file_extension = Path(file.filename or "image.jpg").suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = upload_dir / unique_filename
        
        # Сохраняем файл
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Возвращаем относительный путь для сохранения в БД
        relative_path = f"/uploads/stories/{unique_filename}"
        
        logger.info(f"Story photo uploaded: {relative_path}")
        
        return {
            "success": True,
            "photo_url": relative_path,
            "filename": unique_filename
        }
    except Exception as e:
        logger.error(f"Failed to upload story photo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/uploads/stories/{filename}")
async def get_story_photo(filename: str):
    """Получить загруженное фото Story"""
    file_path = Path("uploads/stories") / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")
    
    return FileResponse(file_path)


@app.post("/stories/create-in-slot")
async def create_story_in_slot(
    user_id: int = Form(...),
    slot_number: int = Form(...),
    file_id: str = Form(...),
    caption: str = Form(None)
):
    """Создать Story в указанном слоте"""
    # Проверка прав админа
    if not is_admin(user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Проверка слота
    if slot_number not in [1, 2, 3]:
        raise HTTPException(status_code=400, detail="Slot number must be 1, 2, or 3")
    
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        async with db_pool.acquire() as conn:
            # Деактивируем старую Story в этом слоте
            await conn.execute(
                "UPDATE stories SET is_active = false WHERE slot_number = $1 AND is_active = true",
                slot_number
            )
            
            # Создаем новую Story
            row = await conn.fetchrow(
                """
                INSERT INTO stories (file_id, caption, slot_number, is_active)
                VALUES ($1, $2, $3, true)
                RETURNING id, file_id, caption, slot_number, created_at, is_active
                """,
                file_id, caption, slot_number
            )
            
            return {
                "id": row['id'],
                "file_id": row['file_id'],
                "caption": row['caption'],
                "slot_number": row['slot_number'],
                "created_at": row['created_at'].isoformat(),
                "is_active": row['is_active']
            }
    except Exception as e:
        logger.error(f"Failed to create story in slot {slot_number}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
