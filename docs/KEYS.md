# Что понадобится от владельца

Пока ничего не нужно: приложение работает в демо-режиме без ключей. Этот список — на этап 8 и дальше. Claude дополняет его по ходу работы и пишет по-простому, куда нажать.

| Что | Зачем | Где взять | Куда положить |
|---|---|---|---|
| Аккаунт Supabase | Настоящие пользователи, чаты, события | supabase.com → New project (регион Frankfurt) | URL и anon key — в переменные облачной среды Claude Code; service role key — только в секреты GitHub Actions |
| Ключ Anthropic API | ИИ-разбор постов и афиш | console.anthropic.com → API Keys | Секреты GitHub Actions (`ANTHROPIC_API_KEY`) |
| Google Cloud OAuth | Вход через Google | console.cloud.google.com → Credentials | Supabase → Auth → Google |
| Apple Developer ($99/год) | Вход через Apple, публикация в App Store | developer.apple.com | Supabase → Auth → Apple; EAS |
| Google Play Console ($25) | Публикация в Google Play | play.google.com/console | EAS |
| Аккаунт Expo | Сборки для телефона, пуши | expo.dev | Токен `EXPO_TOKEN` — в переменные облачной среды |
| SMS-шлюз (Mobizon.kz или SMSC.kz) | Коды по SMS | Договор, имя отправителя, шаблон OTP | Секреты Supabase |

Ключи **никогда** не отправляй в чат и не клади в код. Только в перечисленные места.
