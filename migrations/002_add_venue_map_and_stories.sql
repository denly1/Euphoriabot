-- Миграция: Добавление схемы зала и Stories
-- Дата: 2025-12-02

-- Добавляем поле venue_map_file_id в таблицу posters
ALTER TABLE posters 
ADD COLUMN IF NOT EXISTS venue_map_file_id TEXT;

-- Создаем таблицу для Stories
CREATE TABLE IF NOT EXISTS stories (
    id SERIAL PRIMARY KEY,
    file_id TEXT NOT NULL,
    caption TEXT,
    story_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true
);

-- Индексы для stories
CREATE INDEX IF NOT EXISTS idx_stories_is_active ON stories(is_active);
CREATE INDEX IF NOT EXISTS idx_stories_order ON stories(story_order);

-- Комментарии
COMMENT ON COLUMN posters.venue_map_file_id IS 'Telegram file_id фото схемы зала';
COMMENT ON TABLE stories IS 'Таблица для хранения Stories (короткие видео/фото)';
