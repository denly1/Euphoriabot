# 🎉 EuphoriaBot - Полная инструкция по деплою

## ✅ Что уже сделано:

### 1. Исправлены все файлы проекта
- ✅ `api.py` - изменено `FamilyDB` → `EuphoriaDB`
- ✅ `db.py` - изменено `FamilyDB` → `EuphoriaDB`
- ✅ `db_config.py` - изменено `FamilyDB` → `EuphoriaDB`
- ✅ `.env` - правильная конфигурация для EuphoriaDB
- ✅ `project/src/lib/api.ts` - создан файл API для React

### 2. Настроен автодеплой на GitHub
- ✅ `.github/workflows/deploy.yml` - обновлен для сервера `194.87.131.97`
- ✅ Использует systemd для управления сервисами
- ✅ Автоматически обновляет бота, API и мини-приложение

### 3. На сервере работает:
- ✅ PostgreSQL с базой `EuphoriaDB`
- ✅ Telegram Bot (systemd: `euphoriabot`)
- ✅ API Server (systemd: `euphoriabot-api`)
- ✅ Nginx (проксирует запросы)
- ✅ Домен: `euphoria.publicvm.com`

---

## 🚀 Как запушить проект на GitHub:

```bash
cd "c:\Users\Sasha\Desktop\TusaBot — копия (2) — копия"

# Добавить все изменения
git add .

# Коммит
git commit -m "Fix: Change FamilyDB to EuphoriaDB, update deploy config"

# Пуш на GitHub
git push origin main
```

---

## 🔑 Настройка GitHub Secrets (ВАЖНО!):

Для автодеплоя нужно добавить SSH ключ в GitHub:

1. Перейдите на https://github.com/denly1/Euphoriabot/settings/secrets/actions
2. Нажмите **New repository secret**
3. Name: `SSH_PRIVATE_KEY`
4. Value: Ваш приватный SSH ключ (из PuTTY или сервера)

### Как получить SSH ключ:

На сервере выполните:
```bash
cat ~/.ssh/id_rsa
```

Скопируйте весь вывод (включая `-----BEGIN` и `-----END`) и вставьте в GitHub Secret.

Если ключа нет, создайте:
```bash
ssh-keygen -t rsa -b 4096 -C "euphoriabot@deploy"
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/id_rsa
```

---

## 📱 Проверка работы:

### 1. Telegram Bot
- Найдите бота в Telegram
- Отправьте `/start`
- Бот должен ответить

### 2. API
```bash
curl http://euphoria.publicvm.com/api/health
# Ответ: {"status":"healthy","database":"connected"}
```

### 3. Мини-приложение
Откройте в браузере: **http://euphoria.publicvm.com**

---

## 🔄 Автоматический деплой:

После каждого `git push origin main`:
1. GitHub Actions подключится к серверу
2. Выполнит `git pull`
3. Перезапустит бота и API
4. Пересоберет React приложение
5. Перезапустит Nginx

---

## 📊 Управление на сервере:

```bash
# Просмотр логов
tail -f /var/log/euphoriabot/bot.log
tail -f /var/log/euphoriabot/api.log

# Перезапуск сервисов
systemctl restart euphoriabot
systemctl restart euphoriabot-api
systemctl restart nginx

# Статус сервисов
systemctl status euphoriabot
systemctl status euphoriabot-api
systemctl status nginx
```

---

## ✅ Итоговая структура:

```
EuphoriaBot (GitHub: denly1/Euphoriabot)
├── Сервер: 194.87.131.97
├── Домен: euphoria.publicvm.com
├── База данных: EuphoriaDB (PostgreSQL)
├── Бот: Telegram (@ваш_бот)
├── API: http://euphoria.publicvm.com/api
└── Мини-приложение: http://euphoria.publicvm.com
```

---

## 🎯 Что дальше:

1. ✅ Запушить проект на GitHub
2. ✅ Добавить SSH_PRIVATE_KEY в GitHub Secrets
3. ✅ Проверить работу автодеплоя
4. ✅ Протестировать бота в Telegram
5. ✅ Открыть мини-приложение в браузере

---

## 🔒 SSL (опционально):

Если хотите HTTPS:
1. Активируйте SSL на PublicVM (уже сделано)
2. Обновите `.env.production`:
   ```
   VITE_API_URL=https://euphoria.publicvm.com/api
   ```
3. Пересоберите приложение на сервере

---

## 🎉 Готово!

Теперь у вас:
- ✅ Полностью рабочий Telegram бот
- ✅ API для мини-приложения
- ✅ База данных EuphoriaDB
- ✅ Автоматический деплой через GitHub
- ✅ Бесплатный домен на год
- ✅ Никаких упоминаний FamilyDB!
