-- Миграция: Слоты для Stories и ссылка на схему зала
-- Дата: 2025-12-10

-- Добавляем поле slot_number для Stories (1, 2, 3)
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS slot_number INTEGER CHECK (slot_number IN (1, 2, 3));

-- Добавляем уникальный индекс чтобы в каждом слоте была только одна активная Story
CREATE UNIQUE INDEX IF NOT EXISTS idx_stories_active_slot 
ON stories(slot_number) 
WHERE is_active = true;

-- Добавляем поле venue_map_url для ссылки на схему зала (для канала)
ALTER TABLE posters 
ADD COLUMN IF NOT EXISTS venue_map_url TEXT;

-- Комментарии
COMMENT ON COLUMN stories.slot_number IS 'Номер слота Stories (1, 2, 3)';
COMMENT ON COLUMN posters.venue_map_url IS 'Ссылка на схему зала для публикации в канале';
