# Controller - Система управления оборудованием

Веб-приложение для удаленного управления лазерным оборудованием через браузер. Поддерживает модели TL.0009, TL.0250, TL.0320 и TL.0400.

## 🚀 Возможности

- **Управление устройствами** - отправка команд и контроль позиций
- **Пресеты** - сохранение и загрузка предустановленных позиций (16 слотов)
- **Мониторинг в реальном времени** - получение телеметрии с устройств
- **Расширенные настройки** - конфигурация параметров для каждой модели
- **Мобильная версия** - адаптивный интерфейс с поддержкой QR-кодов
- **Диагностика** - инструменты для проверки состояния оборудования
- **Логирование команд** - история всех отправленных команд

## 🛠️ Технологический стек

- **Frontend**: Next.js 16, React 19, TypeScript
- **Стили**: TailwindCSS v4, shadcn/ui
- **База данных**: SQLite с Prisma ORM
- **State Management**: Zustand, TanStack Query
- **Аутентификация**: NextAuth
- **Runtime**: Node.js / Bun (production)

## 📦 Установка

### Требования

- Node.js v24+ или Bun
- Git

### Шаги установки

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd controller
```

2. Установите зависимости:
```bash
npm install
```

3. Настройте переменные окружения:
```bash
# Файл .env уже содержит конфигурацию по умолчанию
# DATABASE_URL=file:./db/custom.db
```

4. Сгенерируйте Prisma клиент:
```bash
npx prisma generate
```

5. Синхронизируйте базу данных:
```bash
npx prisma db push
```

## 🏃 Запуск

### Режим разработки

```bash
npm run dev
```

Сервер запустится на http://localhost:3000

### Production сборка

```bash
# Сборка
npm run build

# Запуск production сервера (требуется Bun)
npm run start
```

### Автозапуск через systemd (рекомендуется)

Для автоматического запуска при загрузке системы:

```bash
# Сервис уже настроен и включён
sudo systemctl status controller.service

# Управление сервисом
sudo systemctl start controller.service    # Запустить
sudo systemctl stop controller.service     # Остановить
sudo systemctl restart controller.service  # Перезапустить
sudo systemctl enable controller.service   # Включить автозапуск
sudo systemctl disable controller.service  # Отключить автозапуск

# Просмотр логов
sudo journalctl -u controller.service -f        # В реальном времени
sudo journalctl -u controller.service -n 100    # Последние 100 строк
```

## 📁 Структура проекта

```
controller/
├── src/
│   ├── app/              # Next.js App Router страницы и API routes
│   ├── components/       # React компоненты (shadcn/ui + custom)
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Утилиты и сервисы (db, tcp-manager)
│   └── store/           # Zustand stores
├── mini-services/
│   └── device-bridge/   # Сервис для работы с hardware протоколами
├── prisma/
│   └── schema.prisma    # Схема базы данных
├── db/
│   └── custom.db        # SQLite база данных
└── public/              # Статические файлы
```

## 🗄️ База данных

Проект использует SQLite с Prisma ORM. Основные модели:

- **DeviceConfig** - конфигурация устройств (TL.0009, TL.0250, TL.0320, TL.0400)
- **Preset** - пресеты позиций (azimuth, elevation, speed)
- **ExtendedSettings** - расширенные настройки для каждой модели
- **CommandLog** - лог отправленных команд

### Команды Prisma

```bash
# Синхронизация схемы с БД
npm run db:push

# Генерация клиента
npm run db:generate

# Миграции (development)
npm run db:migrate

# Сброс базы данных
npm run db:reset
```

## 🔧 Конфигурация

### Переменные окружения

Файл `.env`:
```env
DATABASE_URL=file:./db/custom.db
```

### Доступ по сети

Для доступа к dev серверу из локальной сети, IP адрес добавлен в `next.config.ts`:
```typescript
allowedDevOrigins: ['192.168.0.23']
```

## 📡 API Endpoints

- `GET /api/presets?deviceId=TL.0009` - получение пресетов устройства
- `POST /api/commands` - отправка команд устройству
- `GET /api/telemetry` - получение телеметрии
- `GET /api/server-url` - URL сервера устройства

## 🎨 UI Компоненты

Проект использует shadcn/ui компоненты:
- Dialog, Popover, Tooltip
- Tabs, Accordion
- Forms с валидацией (React Hook Form + Zod)
- Tables (TanStack Table)
- Charts (Recharts)
- Markdown редактор (MDXEditor)

## 📱 Мобильная версия

Приложение полностью адаптировано для мобильных устройств:
- Responsive дизайн
- QR-коды для быстрого подключения
- Touch-friendly интерфейс

## 🔐 Аутентификация

Используется NextAuth для управления сессиями пользователей.

## 🧪 Линтинг

```bash
npm run lint
```

## 📝 Лицензия

MIT

## 👥 Авторы

Разработано для управления лазерным оборудованием TechLaser.
