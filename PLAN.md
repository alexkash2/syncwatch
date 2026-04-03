# SyncWatch — План реализации

## Контекст

Университетский проект: веб-приложение для синхронного просмотра видео. Пользователи создают комнаты, каждый воспроизводит **локальный** файл со своего устройства (ничего не загружается на сервер). Приложение проверяет идентичность файлов через частичный хеш и синхронизирует воспроизведение через WebSocket.

**Стек**: FastAPI + WebSocket (backend), React + TypeScript + Tailwind CSS (frontend), PostgreSQL, Docker Compose.

**Решения**: Tailwind CSS для стилизации. Хост покидает комнату → комната закрывается для всех (с grace period на реконнект).

### Архитектурные ограничения

- **1 backend instance, 1 uvicorn worker** — всё realtime-состояние (комнаты, подключения, playback) хранится in-memory в `ConnectionManager`. Горизонтальное масштабирование (Redis pub/sub) — вне скоупа MVP.
- **Одна вкладка на пользователя на комнату** — при повторном подключении с того же user_id старый WebSocket принудительно закрывается. Множественные вкладки не поддерживаются.
- **Все временные значения в протоколе — integer milliseconds** (не float seconds). Это устраняет двусмысленность и ошибки округления.
- **WS-аутентификация через одноразовый ws-ticket** (не JWT в query string). Ticket выдаётся через REST, живёт 30 секунд, одноразовый.

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
│   │   │   ├── auth.py          # /api/auth/* (register, login, refresh, me, ws-ticket)
│   │   │   └── rooms.py         # /api/rooms/*
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
│       ├── conftest.py
│       ├── test_auth_service.py
│       ├── test_sync_math.py
│       ├── test_seq_ordering.py
│       ├── test_room_service.py
│       ├── test_ws_lifecycle.py
│       ├── test_room_flow.py
│       ├── test_file_verify.py
│       └── test_chat.py
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
| room_code | VARCHAR(8), UNIQUE | 8 символов, uppercase A-Z + 0-9. Генерация: `''.join(secrets.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') for _ in range(8))`. При коллизии — retry (до 3 попыток) |
| host_id | UUID, FK -> users | создатель и хост |
| is_active | BOOLEAN, default true | |
| max_participants | INTEGER, default 10 | enforcement: проверка при join REST и WS connect |
| file_hash | VARCHAR(128), NULLABLE | SHA-256 частичного хеша |
| file_size | BIGINT, NULLABLE | |
| file_duration | INTEGER, NULLABLE | миллисекунды |
| file_name | VARCHAR(500), NULLABLE | для отображения |
| file_version | INTEGER, default 0 | инкрементируется при каждой смене файла хостом |
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

### WS Ticket (`/api/auth`)
| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| POST | /ws-ticket | `{room_id}` → `{ticket}`. Одноразовый, TTL 30 сек, привязан к user_id и room_id | Да |

### Chat (`/api/rooms/{room_id}/messages`)
| Метод | Путь | Описание |
|-------|------|----------|
| GET | / | `?cursor=<created_at>:<message_id>&limit=50` — курсорная пагинация по `(created_at, id)`. Первый запрос без cursor = последние 50 |

---

## 4. WebSocket-протокол

### Подключение
`wss://<host>/ws/{room_id}?ticket=<ws_ticket>` (dev: `ws://`).

1. Сервер валидирует ws-ticket (одноразовый, TTL 30с, привязан к user_id + room_id).
2. Проверяет, что user_id — участник комнаты, и `max_participants` не превышен (reconnect пользователя, который уже в комнате в статусе DISCONNECTED, проходит без этой проверки).
3. Если у этого user_id уже есть активный WebSocket в этой комнате — **старый принудительно закрывается** (одна вкладка).
4. Генерирует уникальный `connection_id` (UUID) для этого соединения.
5. Добавляет в ConnectionManager, шлёт `room_state`.

### Формат сообщений (envelope)

Каждое WS-сообщение — JSON-объект с общей обёрткой:

```json
{
  "type": "play",
  "request_id": "uuid-optional",
  "seq": 42,
  "file_version": 1,
  "server_time": 1712160000123,
  ...payload
}
```

| Поле | Описание |
|------|----------|
| type | Обязательно. Тип сообщения |
| request_id | Опционально, C→S. Клиент генерирует UUID, сервер эхом возвращает в ответе для корреляции |
| seq | Автоинкремент на сервере (глобальный на комнату). Клиент отбрасывает сообщения с seq ≤ `last_seen_seq` (единый счётчик, НЕ per-type). Гарантирует глобальный порядок всех серверных событий |
| file_version | Текущая версия эталонного файла. При смене файла хостом — инкрементируется. Клиент игнорирует sync-команды с file_version ≠ своему |
| server_time | Integer ms (unix epoch). Проставляется сервером на исходящих сообщениях |

### ConnectionManager (в памяти)
```python
class ConnectionManager:
    rooms: dict[str, dict[str, WebSocket]]      # room_id -> {user_id -> ws}
    connections: dict[str, str]                  # connection_id -> user_id
    room_states: dict[str, RoomState]            # room_id -> полное состояние
    participant_statuses: dict[str, dict[str, str]]  # room_id -> {user_id -> status}
    disconnect_timers: dict[str, dict[str, asyncio.Task]]  # room_id -> {user_id -> grace timer}
    seq_counters: dict[str, int]                 # room_id -> текущий seq

@dataclass
class RoomState:
    room_status: str = "waiting_file"    # waiting_file|waiting_ready|paused|playing|closing
    is_playing: bool = False
    current_time_ms: int = 0             # позиция в миллисекундах
    last_update_epoch: float = 0.0       # server monotonic time (внутренний)
    playback_rate: float = 1.0
    file_version: int = 0
    grace_deadline: float | None = None  # monotonic time, когда closing → closed
```

Сервер broadcast-ит `participant_status` при каждом изменении статуса участника (полученном из `sync_report.playback_status`, `playback_error`, `ready`, `not_ready`, connect/disconnect). Это позволяет всем клиентам отображать актуальные статусы в participant list.

### Типы сообщений

**Синхронизация:**
| Тип | Направление | Payload | Описание |
|-----|-------------|---------|----------|
| file_verify_request | C→S | `{file_hash, file_size, file_duration_ms}` | участник отправляет хеш |
| file_verify_response | S→C | `{match, reason?, file_version}` | результат проверки |
| ready | C→S | `{file_version}` | файл загружен, готов, подтверждаю версию |
| not_ready | C→S | `{}` | сброс готовности (сменил файл, ошибка и т.д.) |
| play | C→S | `{current_time_ms}` | хост нажал play |
| pause | C→S | `{current_time_ms}` | хост нажал pause |
| seek | C→S | `{current_time_ms}` | хост перемотал |
| sync_state | S→C | `{is_playing, current_time_ms, server_time, file_version}` | broadcast после play/pause/seek |
| sync_check | S→C | `{current_time_ms, server_time, is_playing}` | heartbeat каждые 3 сек |
| sync_report | C→S | `{current_time_ms, is_playing, buffer_health_ms, playback_status}` | ответ клиента |
| sync_correction | S→C | `{target_time_ms, action}` | сервер корректирует позицию |
| playback_error | C→S | `{error_code, detail}` | play() rejected, unsupported codec и т.д. |

`playback_status` в sync_report: `"playing"`, `"paused"`, `"buffering"`, `"error"`, `"waiting_interaction"`.

`error_code` в playback_error: `"autoplay_blocked"`, `"codec_unsupported"`, `"media_error"`.

**Присутствие и lifecycle:**
| Тип | Направление | Payload |
|-----|-------------|---------|
| reconnect | C→S | `{last_seq, file_version}` | клиент отправляет сразу после WS-подключения при реконнекте |
| user_joined | S→C | `{user_id, username, connection_id}` |
| user_left | S→C | `{user_id, username, reason}` |
| participant_ready | S→C | `{user_id, is_ready, file_version}` |
| participant_status | S→C | `{user_id, status, detail?}` | broadcast при смене runtime-статуса участника |
| room_state | S→C | `{participants[], playback_state, file_info, file_version, room_status}` |
| file_changed | S→C | `{file_hash, file_size, file_duration_ms, file_name, file_version}` |
| room_closed | S→C | `{reason}` |
| host_disconnected | S→C | `{grace_period_ms}` |
| host_reconnected | S→C | `{}` |

`status` в participant_status: `"joined"`, `"verifying"`, `"verified"`, `"ready"`, `"buffering"`, `"error"`, `"waiting_interaction"`, `"disconnected"`.

`room_status` в room_state: `"waiting_file"`, `"waiting_ready"`, `"paused"`, `"playing"`, `"closing"`.

`reason` в user_left: `"leave"`, `"disconnect"`, `"kicked"`.
`reason` в room_closed: `"host_left"`, `"host_timeout"`, `"deleted"`.

**Контракт reconnect:**
1. Клиент подключается по ws-ticket, сразу отправляет `{type: "reconnect", last_seq: N, file_version: M}`.
2. Сервер проверяет: user_id был в DISCONNECTED состоянии (внутри grace period)?
   - Да + file_version совпадает → восстанавливаем предыдущий статус (READY если был ready), отправляем `room_state`.
   - Да + file_version не совпадает → статус = JOINED, отправляем `room_state`.
   - Нет (не был disconnected, или grace period истёк) → обычный новый join.
3. `last_seq` используется только для определения: отправлять ли текущий `sync_state` немедленно (если `last_seq < current_seq`, значит клиент пропустил обновления → сервер сразу шлёт актуальный `sync_state`). Replay-буфер НЕ нужен.

**Дедупликация вкладок:**
При подключении нового WebSocket для user_id, у которого уже есть **активное** соединение:
1. Старому сокету отправляется `error {code: "tab_replaced"}`.
2. Старый сокет закрывается.
3. Новый сокет становится активным.
4. Это НЕ disconnect: `user_left` НЕ broadcast-ится, статус участника сохраняется.

**Чат:**
| Тип | Направление | Payload |
|-----|-------------|---------|
| chat_send | C→S | `{content}` |
| chat_message | S→C | `{id, user_id, username, content, created_at}` |

**Ошибки:**
| Тип | Направление | Payload |
|-----|-------------|---------|
| error | S→C | `{code, message, request_id?}` |

Коды: `not_host`, `not_ready`, `invalid_message`, `file_mismatch`, `room_closed`, `rate_limited`, `file_version_mismatch`.

**Права:** только хост может отправлять play/pause/seek. Остальные получают `error {code: "not_host"}`.

**Маппинг REST → room_closed.reason:**
- `POST /{room_id}/leave` от хоста → `room_closed {reason: "host_left"}` (немедленное закрытие, без grace period — это намеренный уход).
- `DELETE /{room_id}` от хоста → `room_closed {reason: "deleted"}`.
- Хост disconnect (обрыв WS) → CLOSING + grace period → при timeout: `room_closed {reason: "host_timeout"}`.

---

## 5. Алгоритм синхронизации

### Каноническое время на сервере
```python
def get_current_time_ms(state: RoomPlaybackState) -> int:
    if not state.is_playing:
        return state.current_time_ms
    elapsed_s = time.monotonic() - state.last_update_epoch
    return state.current_time_ms + int(elapsed_s * 1000 * state.playback_rate)
```

### Play
1. Хост → `{type: "play", current_time_ms: 120500}`
2. Сервер проверяет: sender == host, file_version актуален.
3. Сервер: `is_playing=True, current_time_ms=120500, last_update_epoch=now()`, seq++.
4. Broadcast `sync_state` всем (включая хоста).
5. Клиенты: проверяют `seq > last_seq` и `file_version == my_file_version`.
6. `video.currentTime = 120.5; video.play().catch(handleAutoplayBlock)`.

### Pause / Seek — аналогично, обновляется `RoomPlaybackState`, broadcast.

### Heartbeat (каждые 3 сек)
Сервер → `sync_check` с каноническим временем → клиент сравнивает со своим:
- **|drift| < 300ms** — ничего не делаем
- **300ms–2000ms** — nudge: `playbackRate = 1.05` (догоняем) или `0.95` (притормаживаем)
- **>2000ms** — hard seek на каноническое время

Сервер анализирует `sync_report` от клиентов:
- Если `playback_status == "buffering"` и `buffer_health_ms < 500` — не корректируем, ждём.
- Если `playback_status == "error"` или `"waiting_interaction"` — не корректируем, показываем в participant list.

### Обработка play() failure
Браузер может заблокировать `video.play()` из-за autoplay policy (пользователь не взаимодействовал со страницей):
1. Клиент ловит rejected Promise от `play()`.
2. Отправляет `playback_error {error_code: "autoplay_blocked"}`.
3. Показывает оверлей: "Нажмите чтобы начать воспроизведение" с кнопкой.
4. При клике — `video.play()`, при успехе — `sync_report` с актуальной позицией.
5. Сервер не блокирует остальных участников — они продолжают смотреть.

Аналогично для `codec_unsupported`: клиент показывает "Формат не поддерживается браузером", отправляет `playback_error`.

### Вход посреди просмотра
Новый участник получает `room_state` → выбирает файл → верифицирует → `ready` → подтягивается к текущей позиции (вычисленной сервером на момент ready).

### Смена файла хостом
1. Хост отправляет `PUT /file-info` с новым хешем.
2. Сервер: `file_version++`, обновляет file_info в rooms, сбрасывает `is_ready=false` у **всех** участников.
3. Сервер broadcast: `file_changed {file_hash, file_size, file_duration_ms, file_name, file_version}`.
4. Сервер: `RoomPlaybackState` сбрасывается: `is_playing=false, current_time_ms=0`.
5. Все клиенты видят "Хост выбрал новый файл" → должны заново выбрать и верифицировать файл.

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

## 7. State Machines

### Состояния комнаты
```
WAITING_FILE → WAITING_READY → PAUSED ⇄ PLAYING → CLOSING → CLOSED
                  ↑                                    ↑
                  └──── (file_changed) ←───────────────┘
```

| Состояние | Описание | Переходы |
|-----------|----------|----------|
| WAITING_FILE | Комната создана, хост ещё не выбрал файл | → WAITING_READY (хост set file-info) |
| WAITING_READY | Файл выбран, ждём ready от участников | → PAUSED (хотя бы хост ready) |
| PAUSED | Видео на паузе | → PLAYING (host play) |
| PLAYING | Видео воспроизводится | → PAUSED (host pause/seek) |
| CLOSING | Grace period — хост disconnect, ждём реконнект. Playback автоматически ставится на паузу | → предыдущий статус до disconnect: WAITING_FILE / WAITING_READY / PAUSED (host reconnected), → CLOSED (timeout) |
| CLOSED | Комната закрыта | терминальное состояние |

При `file_changed`: любое состояние кроме CLOSED → WAITING_READY + reset playback.

### Состояния участника (в контексте комнаты)
```
JOINED → VERIFYING → VERIFIED → READY ⇄ BUFFERING
                                  ↕
                                ERROR
(любое) → DISCONNECTED → (reconnect) → восстановление предыдущего статуса
```

| Состояние | Описание |
|-----------|----------|
| JOINED | Подключился, файл не выбран |
| VERIFYING | Выбрал файл, идёт хеширование/проверка |
| VERIFIED | Файл совпал, но клиент ещё не загрузил в плеер |
| READY | Плеер готов к воспроизведению |
| BUFFERING | Плеер буферизирует (из READY, временно) |
| ERROR | play() rejected, codec unsupported (из READY, требует действия пользователя) |
| DISCONNECTED | Потеря соединения (из любого, внутри grace period). При reconnect → восстановление предыдущего |

При `file_changed` от сервера: любое состояние → JOINED (нужно заново выбирать файл).

---

## 8. Reconnect Policy

### Общий механизм
- При обрыве WebSocket клиент переподключается с exponential backoff: 1с, 2с, 4с, 8с, max 30с.
- При реконнекте клиент запрашивает новый ws-ticket через REST (если access token ещё валиден) или сначала refresh.
- При подключении клиент отправляет `{type: "reconnect", last_seq: N, file_version: M}`.
- Сервер проверяет: если `file_version` совпадает, восстанавливает участника в статус READY (если был ready до disconnect). Если не совпадает — участник начинает с JOINED.

### Grace period для хоста
- Когда хост теряет соединение, сервер **не закрывает комнату сразу**.
- Комната переходит в состояние CLOSING, всем broadcast: `host_disconnected {grace_period_ms: 30000}`.
- Фронтенд показывает: "Хост потерял соединение. Ожидание реконнекта: 0:30".
- Playback ставится на паузу автоматически.
- Если хост реконнектится в течение 30 секунд → `host_reconnected`, комната восстанавливает статус, который был до disconnect (WAITING_FILE / WAITING_READY / PAUSED — не PLAYING, т.к. playback ставится на паузу при уходе хоста).
- Если timeout истёк → `room_closed {reason: "host_timeout"}`, все сокеты закрываются.

### Grace period для участников
- Обычный участник disconnect → сервер помечает его как DISCONNECTED, broadcast `user_left {reason: "disconnect"}`.
- Если реконнектится в течение 60 секунд → восстанавливается, broadcast `user_joined`.
- Если timeout → `left_at` записывается в БД, участник полностью удаляется.

---

## 9. Фазы реализации

### Фаза 1: Скаффолдинг + Auth
- docker-compose (postgres, backend, frontend)
- FastAPI скелет, config, database (async + asyncpg)
- Модель User, Alembic, первая миграция
- Эндпоинты auth: register, login, refresh, me, **ws-ticket**
- Frontend: Vite + React + TS + Tailwind, AuthContext, LoginPage, RegisterPage
- Axios с JWT interceptor, ProtectedRoute
- **Тесты**: unit — хеширование паролей, JWT create/verify, ws-ticket expiry
- **Результат**: регистрация, логин, защищённая главная страница

### Фаза 2: Комнаты
- Модели Room, RoomParticipant + миграция (включая file_version, max_participants enforcement)
- CRUD комнат, генерация room_code (A-Z0-9, retry при коллизии), join/leave
- Проверка max_participants при join
- Frontend: создание/вход в комнату, список комнат, RoomPage скелет
- **Тесты**: integration — создание комнаты, join, leave, max_participants rejection
- **Результат**: создание комнаты, вход по коду, список участников

### Фаза 3: WebSocket + Чат
- ConnectionManager с connection_id, seq_counters, дедупликацией вкладок
- WS endpoint `/ws/{room_id}?ticket=<ws_ticket>` с валидацией ticket
- Envelope: type, request_id, seq, file_version, server_time
- user_joined/user_left (с reason), room_state при подключении
- ChatMessage модель + миграция, chat_send/chat_message
- REST для истории чата (курсор `created_at:id`)
- Frontend: useWebSocket (с reconnect + exponential backoff), ChatPanel, ParticipantList
- **Тесты**: integration — WS connect/disconnect, tab replacement, chat send/receive
- **Результат**: реалтайм чат, видно кто в комнате, дедупликация вкладок работает

### Фаза 4: Выбор файла + Верификация
- fileHash.ts — частичное хеширование (integer ms для duration)
- FileSelector: выбор файла, хеширование, извлечение duration
- WS: file_verify_request/response, ready/not_ready, file_changed
- PUT /file-info для хоста (с file_version increment, reset is_ready у всех)
- Participant state machine: JOINED → VERIFYING → VERIFIED → READY
- **Тесты**: unit — fileHash (mock File API), file_version reset logic
- **Результат**: проверка идентичности файлов работает, смена файла хостом сбрасывает ready

### Фаза 5: Видеоплеер + Синхронизация
- VideoPlayer с `<video>`, PlaybackControls (только хост)
- useVideoSync: применение sync_state к видео, проверка seq и file_version
- Серверный heartbeat (3 сек), drift detection, коррекция
- Обработка play() failure (autoplay_blocked → оверлей), codec_unsupported → ошибка
- playback_error событие, sync_report с playback_status и buffer_health_ms
- Обработка входа посреди просмотра
- Независимая громкость
- **Тесты**: unit — sync math (get_current_time_ms, drift calculation), seq ordering
- **Результат**: синхронный просмотр работает, drift < 500ms

### Фаза 6: Reconnect + Lifecycle
- Клиентский reconnect с exponential backoff (1с→30с)
- Grace period: хост 30с, участник 60с
- host_disconnected / host_reconnected / room_closed broadcast
- Room state machine: WAITING_FILE → WAITING_READY → PAUSED ⇄ PLAYING → CLOSING → CLOSED
- При disconnect хоста: autopause + таймер
- **Тесты**: integration — reconnect flow, host disconnect grace period, room_closed
- **Результат**: потеря связи не ломает комнату, graceful degradation

### Фаза 7: Полировка + Docker
- Rate limiting чата (5 msg / 10 сек)
- Валидация на всех уровнях (pydantic + frontend form validation)
- Error boundaries в React
- Dockerfiles (backend: 1 uvicorn worker, frontend: nginx)
- nginx.conf: SPA + reverse proxy `/api` и `/ws` → backend:8000 (http/ws внутри Docker network; TLS терминируется на nginx/Traefik снаружи)
- .env.example, README
- **Тесты**: e2e — полный сценарий на двух клиентах (регистрация → комната → файл → play → чат)
- **Результат**: `docker compose up` — всё работает

---

## 10. Скоуп MVP vs. на потом

### В MVP
- Регистрация/логин (email + пароль), JWT + ws-ticket
- Комнаты: создание, вход по коду, закрытие, max_participants enforcement
- Верификация файлов через частичный хеш + file_version
- Синхронное воспроизведение (play/pause/seek) с seq-ordering
- Heartbeat 3с + drift correction
- Независимая громкость
- Текстовый чат с курсорной пагинацией
- Список участников + state machine статусов
- Reconnect с grace period (хост 30с, участник 60с)
- Дедупликация вкладок
- Обработка play() failure и codec errors
- Смена файла хостом с reset ready
- Автотесты (unit + integration + e2e)
- Docker Compose (1 worker)

### Отложено
- Вход по прямой ссылке `/join/CODE`
- Передача роли хоста
- "Пауза для всех при буферизации"
- Пароль на комнату
- Аватары, OAuth
- Плейлисты / очередь видео
- Синхронизация субтитров
- Мобильная адаптация
- Telegram-уведомления
- Redis для горизонтального масштабирования
- Ping/pong RTT-based latency estimation
- Refresh token revocation (DB-stored)

---

## 11. Ключевые зависимости

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
pytest>=8.0.0
pytest-asyncio>=0.23.0
httpx>=0.27.0
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

## 12. Критические файлы (наибольшая сложность)

1. **backend/app/ws/manager.py** — ConnectionManager, in-memory состояние комнат
2. **backend/app/ws/handler.py** — WS endpoint, dispatch, auth, heartbeat task
3. **backend/app/ws/sync.py** — алгоритм синхронизации, drift detection
4. **frontend/src/hooks/useVideoSync.ts** — применение sync к `<video>`, коррекция drift
5. **frontend/src/utils/fileHash.ts** — частичное хеширование через Web Crypto API

---

## 13. Верификация (как тестировать)

### Автотесты

**Unit (pytest):**
- `test_sync_math.py` — get_current_time_ms при разных состояниях, drift calculation
- `test_auth_service.py` — JWT create/verify, ws-ticket create/validate/expire/one-time-use
- `test_room_service.py` — room_code generation, collision retry, file_version increment + ready reset
- `test_seq_ordering.py` — seq auto-increment, client-side old-seq rejection

**Integration (pytest + httpx + websockets):**
- `test_ws_lifecycle.py` — connect, disconnect, tab replacement, reconnect with last_seq
- `test_room_flow.py` — create room, join, max_participants rejection, leave, host leave → room_closed
- `test_file_verify.py` — file_verify match/mismatch, file_changed broadcast, ready reset
- `test_chat.py` — send/receive, cursor pagination, rate limiting

**E2E (manual или Playwright):**
1. `docker compose up` — всё стартует без ошибок
2. Регистрация двух пользователей через UI
3. User1 создаёт комнату, копирует код
4. User2 входит по коду
5. User1 (хост) выбирает видеофайл
6. User2 выбирает тот же файл → "verified", другой файл → ошибка
7. Хост жмёт play → у обоих воспроизведение
8. Хост pause/seek → синхронно у обоих
9. Чат: сообщения видны обоим в реалтайме
10. Перезагрузка страницы → реконнект, подтягивание к текущей позиции
11. Хост закрывает вкладку → "host disconnected" + таймер 30с → room_closed
12. Открытие второй вкладки → первая вкладка получает "tab_replaced"
13. Хост меняет файл → все участники получают file_changed, ready сброшен
14. Участник с заблокированным autoplay → видит оверлей, может нажать play вручную
