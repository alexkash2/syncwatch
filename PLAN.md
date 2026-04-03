# SyncWatch — План реализации

## Контекст

Университетский проект: веб-приложение для синхронного просмотра видео. Пользователи создают комнаты, каждый воспроизводит **локальный** файл со своего устройства (ничего не загружается на сервер). Приложение проверяет идентичность файлов через частичный хеш и синхронизирует воспроизведение через WebSocket.

**Стек**: FastAPI + WebSocket (backend), React + TypeScript + Tailwind CSS (frontend), PostgreSQL, Docker Compose.

**Решения**: Tailwind CSS для стилизации. Хост покидает комнату → комната закрывается для всех.

---

## 1. Структура проекта (монорепо)

```
syncwatch/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── CHANGELOG.md
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan
│   │   ├── config.py            # pydantic-settings
│   │   ├── database.py          # async engine, sessionmaker, get_db
│   │   ├── models/
│   │   │   ├── base.py          # DeclarativeBase
│   │   │   ├── user.py
│   │   │   ├── room.py
│   │   │   ├── room_participant.py
│   │   │   └── chat_message.py
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── room.py
│   │   │   ├── chat.py
│   │   │   └── ws.py
│   │   ├── api/
│   │   │   ├── router.py        # агрегирует все роутеры
│   │   │   ├── auth.py          # /api/auth/*
│   │   │   ├── rooms.py         # /api/rooms/*
│   │   │   └── users.py         # /api/users/*
│   │   ├── ws/
│   │   │   ├── manager.py       # ConnectionManager: rooms -> connections
│   │   │   ├── handler.py       # WebSocket endpoint, dispatch
│   │   │   ├── sync.py          # алгоритм синхронизации
│   │   │   └── messages.py      # типы сообщений, enum'ы
│   │   ├── services/
│   │   │   ├── auth_service.py  # хеширование паролей, JWT
│   │   │   ├── room_service.py  # CRUD комнат, участники
│   │   │   └── chat_service.py  # сохранение/загрузка чата
│   │   └── core/
│   │       ├── security.py      # JWT утилиты, bcrypt
│   │       ├── dependencies.py  # get_current_user
│   │       └── exceptions.py
│   └── tests/
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx              # Router
│       ├── api/
│       │   ├── client.ts        # axios + JWT interceptor
│       │   ├── auth.ts
│       │   └── rooms.ts
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useWebSocket.ts
│       │   ├── useVideoSync.ts  # синхронизация видео с WS
│       │   └── useFileHash.ts
│       ├── contexts/
│       │   ├── AuthContext.tsx
│       │   └── RoomContext.tsx
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   ├── HomePage.tsx     # создать/войти в комнату
│       │   ├── RoomPage.tsx     # основная страница просмотра
│       │   └── NotFoundPage.tsx
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Header.tsx
│       │   │   ├── ProtectedRoute.tsx
│       │   │   └── Layout.tsx
│       │   ├── room/
│       │   │   ├── VideoPlayer.tsx
│       │   │   ├── FileSelector.tsx
│       │   │   ├── ChatPanel.tsx
│       │   │   ├── ParticipantList.tsx
│       │   │   ├── PlaybackControls.tsx
│       │   │   └── RoomInfo.tsx
│       │   └── common/
│       │       ├── Button.tsx
│       │       ├── Input.tsx
│       │       └── Spinner.tsx
│       ├── utils/
│       │   ├── fileHash.ts      # частичное хеширование
│       │   ├── formatTime.ts
│       │   └── constants.ts
│       └── types/
│           ├── auth.ts
│           ├── room.ts
│           └── ws.ts
```

---

## 2. База данных

### users
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID, PK | |
| username | VARCHAR(50), UNIQUE | |
| email | VARCHAR(255), UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt |
| is_active | BOOLEAN, default true | |
| created_at | TIMESTAMP WITH TZ | |
| updated_at | TIMESTAMP WITH TZ | |

### rooms
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID, PK | |
| name | VARCHAR(100) | название комнаты |
| room_code | VARCHAR(8), UNIQUE | 8-символьный код для входа |
| host_id | UUID, FK -> users | создатель и хост |
| is_active | BOOLEAN, default true | |
| max_participants | INTEGER, default 10 | |
| file_hash | VARCHAR(128), NULLABLE | SHA-256 частичного хеша |
| file_size | BIGINT, NULLABLE | |
| file_duration | FLOAT, NULLABLE | секунды |
| file_name | VARCHAR(500), NULLABLE | для отображения |
| created_at | TIMESTAMP WITH TZ | |

### room_participants
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID, PK | |
| room_id | UUID, FK -> rooms | |
| user_id | UUID, FK -> users | |
| is_ready | BOOLEAN, default false | файл проверен и загружен |
| joined_at | TIMESTAMP WITH TZ | |
| left_at | TIMESTAMP WITH TZ, NULLABLE | NULL = в комнате |

Partial unique index: `(room_id, user_id) WHERE left_at IS NULL`

### chat_messages
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID, PK | |
| room_id | UUID, FK -> rooms | |
| user_id | UUID, FK -> users | |
| content | TEXT, max 2000 | |
| created_at | TIMESTAMP WITH TZ | |

### Связи
- User 1→N Room (как хост)
- User 1→N RoomParticipant
- Room 1→N RoomParticipant
- Room 1→N ChatMessage

---

## 3. REST API

### Auth (`/api/auth`)
| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| POST | /register | `{username, email, password}` → 201 | Нет |
| POST | /login | `{email, password}` → `{access_token, refresh_token}` | Нет |
| POST | /refresh | `{refresh_token}` → новая пара токенов | Нет |
| GET | /me | текущий пользователь | Да |

JWT: access — 30 мин, refresh — 7 дней, HS256.

### Rooms (`/api/rooms`)
| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| POST | / | создать комнату `{name}` | Да |
| GET | / | список моих комнат (пагинация) | Да |
| GET | /{room_id} | детали комнаты + участники | Да |
| POST | /join | `{room_code}` → войти в комнату | Да |
| POST | /{room_id}/leave | покинуть комнату | Да |
| DELETE | /{room_id} | закрыть комнату (только хост) | Да |
| PUT | /{room_id}/file-info | хост устанавливает эталонный файл | Да |

### Chat (`/api/rooms/{room_id}/messages`)
| Метод | Путь | Описание |
|-------|------|----------|
| GET | / | `?before=<timestamp>&limit=50` — история |

---

## 4. WebSocket-протокол

### Подключение
`ws://<host>/ws/{room_id}?token=<jwt>` → сервер валидирует JWT, проверяет участие, добавляет в ConnectionManager, шлёт `room_state` с полным текущим состоянием.

### ConnectionManager (в памяти)
```python
class ConnectionManager:
    rooms: dict[str, dict[str, WebSocket]]      # room_id -> {user_id -> ws}
    room_states: dict[str, RoomPlaybackState]    # room_id -> состояние

@dataclass
class RoomPlaybackState:
    is_playing: bool = False
    current_time: float = 0.0        # позиция в секундах
    last_update_epoch: float = 0.0   # server monotonic time
    playback_rate: float = 1.0
```

### Типы сообщений

**Синхронизация:**
| Тип | Направление | Payload | Описание |
|-----|-------------|---------|----------|
| file_verify_request | C→S | `{file_hash, file_size, file_duration}` | участник отправляет хеш |
| file_verify_response | S→C | `{match, reason?}` | результат проверки |
| ready | C→S | — | файл загружен, готов |
| play | C→S | `{timestamp}` | хост нажал play |
| pause | C→S | `{timestamp}` | хост нажал pause |
| seek | C→S | `{timestamp}` | хост перемотал |
| sync_state | S→C | `{is_playing, current_time, server_time}` | broadcast после play/pause/seek |
| sync_check | S→C | `{current_time, server_time, is_playing}` | heartbeat каждые 5 сек |
| sync_report | C→S | `{current_time, is_playing, buffer_health}` | ответ клиента на sync_check |
| sync_correction | S→C | `{target_time, action}` | сервер корректирует позицию |

**Присутствие:**
| Тип | Направление | Payload |
|-----|-------------|---------|
| user_joined | S→C | `{user_id, username}` |
| user_left | S→C | `{user_id, username}` |
| participant_ready | S→C | `{user_id, is_ready}` |
| room_state | S→C | `{participants[], playback_state, file_info}` |

**Чат:**
| Тип | Направление | Payload |
|-----|-------------|---------|
| chat_send | C→S | `{content}` |
| chat_message | S→C | `{id, user_id, username, content, created_at}` |

**Права:** только хост может отправлять play/pause/seek. Остальные получают `error {code: "not_host"}`.

---

## 5. Алгоритм синхронизации

### Каноническое время на сервере
```python
def get_current_time(state: RoomPlaybackState) -> float:
    if not state.is_playing:
        return state.current_time
    elapsed = time.monotonic() - state.last_update_epoch
    return state.current_time + elapsed * state.playback_rate
```

### Play
1. Хост → `{type: "play", timestamp: 120.5}`
2. Сервер: `is_playing=True, current_time=120.5, last_update_epoch=now()`
3. Broadcast `sync_state` всем (включая хоста)
4. Все клиенты: `video.currentTime = 120.5; video.play()`

### Pause / Seek — аналогично, обновляется `RoomPlaybackState`, broadcast.

### Heartbeat (каждые 5 сек)
Сервер → `sync_check` с каноническим временем → клиент сравнивает со своим:
- **|drift| < 0.5с** — ничего не делаем
- **0.5с–3.0с** — nudge: `playbackRate = 1.05` (догоняем) или `0.95` (притормаживаем)
- **>3.0с** — hard seek на каноническое время

### Вход посреди просмотра
Новый участник получает `room_state` → выбирает файл → верифицирует → `ready` → подтягивается к текущей позиции.

---

## 6. Верификация файлов

### Что хешируем
3 среза по 1 МБ: начало (offset 0), середина (offset fileSize/2), конец (offset fileSize-1MB) + размер файла как 8 байт big-endian.

Для файлов < 3 МБ — читаем целиком.

Итог: `SHA-256(head + middle + tail + sizeBytes)` через Web Crypto API.

### Проверка на сервере
```python
match = (hash совпадает) AND (size совпадает) AND (|duration разница| <= 1.0с)
```

---

## 7. Фазы реализации

### Фаза 1: Скаффолдинг + Auth
- docker-compose (postgres, backend, frontend)
- FastAPI скелет, config, database (async + asyncpg)
- Модель User, Alembic, первая миграция
- Эндпоинты auth: register, login, refresh, me
- Frontend: Vite + React + TS, AuthContext, LoginPage, RegisterPage
- Axios с JWT interceptor, ProtectedRoute
- **Результат**: регистрация, логин, защищённая главная страница

### Фаза 2: Комнаты
- Модели Room, RoomParticipant + миграция
- CRUD комнат, генерация кода, join/leave
- Frontend: создание/вход в комнату, список комнат, RoomPage скелет
- **Результат**: создание комнаты, вход по коду, список участников

### Фаза 3: WebSocket + Чат
- ConnectionManager, WS endpoint `/ws/{room_id}`
- user_joined/user_left, room_state при подключении
- ChatMessage модель + миграция, chat_send/chat_message
- REST для истории чата
- Frontend: useWebSocket, ChatPanel, ParticipantList
- **Результат**: реалтайм чат, видно кто в комнате

### Фаза 4: Выбор файла + Верификация
- fileHash.ts — частичное хеширование
- FileSelector: выбор файла, хеширование, извлечение duration
- WS: file_verify_request/response, ready/not_ready
- PUT /file-info для хоста
- **Результат**: проверка идентичности файлов работает

### Фаза 5: Видеоплеер + Синхронизация
- VideoPlayer с `<video>`, PlaybackControls (только хост)
- useVideoSync: применение sync_state к видео
- Серверный heartbeat, drift detection, коррекция
- Обработка входа посреди просмотра
- Независимая громкость
- **Результат**: синхронный просмотр работает, drift < 1с

### Фаза 6: Полировка + Docker
- Реконнект с exponential backoff
- Edge cases (комната закрыта, хост ушёл)
- Валидация, rate limiting чата
- Dockerfiles (backend: uvicorn, frontend: nginx)
- nginx.conf: SPA + proxy /api и /ws
- .env.example, README
- **Результат**: `docker compose up` — всё работает

---

## 8. Скоуп MVP vs. на потом

### В MVP
- Регистрация/логин (email + пароль), JWT
- Комнаты: создание, вход по коду, закрытие
- Верификация файлов через частичный хеш
- Синхронное воспроизведение (play/pause/seek)
- Heartbeat + drift correction
- Независимая громкость
- Текстовый чат
- Список участников + статус готовности
- Docker Compose

### Отложено
- Вход по прямой ссылке `/join/CODE`
- Передача роли хоста (при уходе хоста комната закрывается)
- "Пауза для всех при буферизации"
- Пароль на комнату
- Аватары, OAuth
- Плейлисты / очередь видео
- Синхронизация субтитров
- Мобильная адаптация
- Telegram-уведомления
- Redis для горизонтального масштабирования

---

## 9. Ключевые зависимости

### Backend (requirements.txt)
```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.29.0
alembic>=1.13.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.9
websockets>=12.0
```

### Frontend (package.json)
```
react, react-dom ^19
react-router ^7
axios ^1.7
tailwindcss ^4
vite ^6, typescript ^5.5
```

---

## 10. Критические файлы (наибольшая сложность)

1. **backend/app/ws/manager.py** — ConnectionManager, in-memory состояние комнат
2. **backend/app/ws/handler.py** — WS endpoint, dispatch, auth, heartbeat task
3. **backend/app/ws/sync.py** — алгоритм синхронизации, drift detection
4. **frontend/src/hooks/useVideoSync.ts** — применение sync к `<video>`, коррекция drift
5. **frontend/src/utils/fileHash.ts** — частичное хеширование через Web Crypto API

---

## 11. Верификация (как тестировать)

1. `docker compose up` — всё стартует без ошибок
2. Регистрация двух пользователей через UI
3. User1 создаёт комнату, копирует код
4. User2 входит по коду
5. User1 (хост) выбирает видеофайл
6. User2 выбирает тот же файл → "verified", другой → ошибка
7. Хост жмёт play → у обоих воспроизведение
8. Хост pause/seek → синхронно у обоих
9. Чат: сообщения видны обоим в реалтайме
10. Перезагрузка страницы → реконнект, подтягивание к текущей позиции
