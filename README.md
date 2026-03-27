# ShotOUT

Голосовой ввод для Fedora (GNOME, Wayland). Нажимаешь хоткей — говоришь — нажимаешь снова — текст вставляется в активное поле.

Используется Groq Whisper API (быстро, точно, бесплатный tier есть).

```
┌─────────────────────────────────────────────┐
│  Activities   [App name]        🎤  ···  EN │  ← idle
│  Activities   [App name]       🎙 0:07  ···  │  ← запись
│  Activities   [App name]  ⏳ RECOGNIZING ··· │  ← распознавание
│  Activities   [App name]        ✗  ···  EN  │  ← отмена
└─────────────────────────────────────────────┘
```

## Требования

- Fedora 39+ с GNOME 45+
- Wayland-сессия
- Groq API key (бесплатная регистрация)

## Шаг 0: Получить Groq API key

1. Зайти на [console.groq.com](https://console.groq.com)
2. Зарегистрироваться → API Keys → Create API key
3. Скопировать ключ — он понадобится при установке

## Установка

### Одной командой

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/shotout/main/install.sh)
```

Скрипт:
- Проверит зависимости и подскажет как установить недостающие
- Установит Python-пакет `groq` если нужно
- Спросит Groq API key и сохранит в `~/.config/shotout/key`
- Скопирует файлы в нужные места
- Включит GNOME расширение

### Зависимости (устанавливаются вручную если нет)

```bash
sudo dnf install sox wl-clipboard ydotool python3
sudo systemctl enable --now ydotoold
```

### После установки — обязательно

Включить daemon для симуляции клавиш:
```bash
sudo systemctl enable --now ydotoold
```

Перелогиниться (или перезапустить GNOME Shell), чтобы появился индикатор 🎤 в top bar.

## Назначить хоткей

**GNOME Settings → Keyboard → View and Customize Shortcuts → Custom Shortcuts → +**

| Поле     | Значение                                        |
|----------|-------------------------------------------------|
| Name     | ShotOUT                                         |
| Command  | `/home/YOUR_LINUX_USERNAME/.local/bin/shotout-wrapper` |
| Shortcut | Super+R  (или любой другой)                     |

> Используйте полный путь в Command, а не просто `shotout-wrapper` — GNOME не видит `~/.local/bin` в своём PATH при запуске хоткеев.

## Использование

| Действие | Что происходит |
|----------|----------------|
| Хоткей (первый раз) | Начинает запись. Индикатор: 🎙 0:07 |
| Хоткей (второй раз) | Останавливает запись, отправляет в Whisper, вставляет текст |
| Клик на 🎤 во время записи | Отменяет запись без транскрибации. Индикатор: ✗ |
| Клик на 🎤 в idle | Открывает меню со статистикой |

## Индикатор в top bar

| Иконка | Состояние |
|--------|-----------|
| 🎤 | Ожидание (idle) |
| 🎙 0:07 | Запись, таймер в минутах:секундах |
| 🎙 *оранжевый пульс* | Осталось меньше 10 секунд до лимита |
| ⏳ RECOGNIZING | Идёт распознавание |
| ✗ | Запись отменена (на ~2 секунды) |

Меню (клик в idle): статистика за сегодня и за месяц — количество запросов и суммарное время записи.

## Настройка параметров

Параметры находятся в двух файлах:

### `~/.local/bin/shotout-wrapper` — параметры записи

```python
TAIL_DELAY         = 1.5      # секунды дозаписи после нажатия стоп (чтобы захватить последние слова)
MAX_RECORDING_SECS = 5 * 60  # авто-стоп через это время (секунды)
```

### `~/.local/share/gnome-shell/extensions/shotout@local/extension.js` — параметры индикатора

```javascript
const WARNING_SECS = 10;  // за сколько секунд до лимита начинать оранжевый пульс
```

### Применение изменений

**`shotout-wrapper`** — изменения применяются немедленно, скрипт читается при каждом запуске. Перезапускать ничего не нужно.

**`extension.js`** — GNOME Shell кэширует расширение. После изменения нужно перезагрузить расширение:

```bash
gnome-extensions disable shotout@local
gnome-extensions enable shotout@local
```

На Wayland Alt+F2 не работает, поэтому единственный надёжный способ — перелогиниться.

## Структура файлов

```
~/.local/bin/shotout              — основной скрипт (sox + Groq API)
~/.local/bin/shotout-wrapper      — обёртка (статус, watchdog, статистика)
~/.local/share/gnome-shell/extensions/shotout@local/
    extension.js                  — GNOME Shell расширение
    metadata.json
~/.config/shotout/key             — Groq API key
~/.local/share/shotout/stats.json — статистика
```

## Как работает внутри

1. Хоткей запускает `shotout-wrapper`
2. Wrapper пишет статус в `/tmp/shotout-status` (recording / recognizing / idle)
3. Запускает `shotout` (запись через `sox`) и фоновый watchdog
4. Watchdog следит за `/tmp/shotout-cancel` (клик отмены) и лимитом времени
5. При стопе: TAIL_DELAY секунд дозаписи → `shotout` отправляет аудио в Groq API → `wl-copy` + `ydotool` вставляет текст
6. Расширение читает `/tmp/shotout-status` каждые 500ms и обновляет индикатор

## Обновление

Просто запустить установщик снова — он перезапишет файлы:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/shotout/main/install.sh)
```

API key при этом будет предложено сохранить или оставить старый.
