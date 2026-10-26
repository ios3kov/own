# Own — план разработки и проверки

Дата: 24 октября 2026. Статус приложения: INCOMPLETE. Этот документ задаёт план, а не подтверждает безопасность или готовность сборки.

## 1. Правила и цель

Принятый baseline AS Development Rules: версия 7.0.0, commit `5dbd8f2617cf9d1bf82d2c92eb066703967feb6d`.
Источник: https://github.com/ios3kov/AS-Development-Rules/blob/5dbd8f2617cf9d1bf82d2c92eb066703967feb6d/AI_ENTRYPOINT.md

Scope: application; iOS, React Native и нативные модули. Риск: Critical — пароли, сеть, хранение, разрешения и bridge. Gate: Validation — личная установка через Xcode на iPhone. App Store, TestFlight, публичный выпуск и Android-приёмка в этот этап не входят. По новому указанию пользователя Android-часть удаляется в T18 после текущего блока исправлений; iOS-возможности и общие зависимости сохраняются.

Применимые разделы: PROCESS (SCOPE/STATE/AUTHORITY/REGRESSION/COMPLETE), ENGINEERING, EVIDENCE_LIFECYCLE, IOS, HYBRID для фактического bridge, PRIVACY, CONTENT для AI/assets, ACCESSIBILITY, RELEASE в части Validation, REFERENCE_AUDIT для выбранных функций Ash. WebView-specific требования применяются только при обнаружении WebView; React Native не объявляется website wrapper.

Цель: Own сохраняет возможности принятой открытой основы, работает с локальными моделями и не содержит скрытого сбора/отправки данных исходным разработчикам. Разрешённые внешние сервисы работают явно и по назначению. Абсолютная гарантия «полностью безопасно» не является доказуемым критерием: проверяются конкретные потоки, код и точная установленная сборка.

## 2. Подтверждённые решения и границы

Обновление 24 октября: Apple Foundation Models — основной текстовый ИИ по умолчанию. Используется именно локальная системная модель `SystemLanguageModel.default`, без автоматического перехода на Private Cloud Compute или иной облачный AI. Проверять фактическую availability на старте, при возврате в приложение и перед генерацией. Если недоступна — показать причину и выбор альтернативной модели. Никакого автоматического выбора, переключения или скачивания запасной модели. Загрузка начинается только по явному нажатию пользователем кнопки загрузки; отдельно выбранная пользователем текущая модель сохраняется и не заменяется при следующем запуске. Повторная загрузка/возобновление уже запрошенной загрузки подчиняются сохранённому пользовательскому запросу и явной отмене. Системная загрузка ресурсов Apple Intelligence управляется iOS, а не выдаётся за скачивание приложением. Настройка Apple speech остаётся отдельной, OFF по умолчанию.


- Сохранить текущую React Native/llama.rn/GGUF архитектуру; не переписывать приложение на Flutter.
- Сохранить чат, модели, фоновые загрузки, поиск/чтение страниц, документы и локальный RAG, доступные изображения/генерацию, Whisper и явно настроенные внешние серверы. Состав фактически работающих возможностей уточняется инвентаризацией и проверяется, без молчаливого удаления.
- Google — поиск по умолчанию. Запрос поиска видит Google; запрошенную страницу видит её сервер. Пользовательский внешний AI-сервер получает явно отправленный ему контент.
- Apple speech — отдельная опция, по умолчанию OFF. Whisper остаётся локальным вариантом. Выключение опции отменяет соответствующую активную запись/задачу и исключает новые вызовы Apple speech от приложения. Системный трафик самой iOS учитывается отдельно.
- Сохранить фоновые загрузки. Их ограничения по перенаправлениям исследовать и проверить, не подменять загрузкой только при открытом приложении.
- Имя Own; удалить исходную рекламу и исходное авторство в согласованном пользователем объёме. Пользователь сообщил о договорённости с автором. Лицензии других библиотек, моделей и заимствований Ash сохраняются. Технические домены в защитных правилах не являются рекламой/атрибуцией и остаются читаемыми.
- Закрытые современные Pro/Mesh/MCP отсутствуют в принятой основе. Они не считаются реализованными. Новая озвучка — отдельная задача, а не уже существующая возможность.
- Использовать отдельную ветку; сохранять старые рабочие каталоги и доказательства. Для Own подготовить отдельную чистую историю, не переписывая сохранённый исходный checkout. Не отправлять изменения в main и не выполнять публикацию автоматически.

## 3. Текущее состояние

Проверено чтением файлов и Git 24 октября: активный каталог `work/Own-personal`, ветка `fix/personal-privacy`, основа `47b357a60ca311536fa33f89b64718dd174cebe5`, незакоммиченные изменения.

Есть реализации PBKDF2, сетевых ограничений, Google parser и воспроизводимые patches React Native/RNFS. Это не означает, что они прошли приёмку. Последний сохранённый Release build завершился FAIL на fmt; после исправления нужна новая сборка. Полная проверка приложения и установка Own на телефон — NOT_RUN. Старые результаты отдельных тестов сохраняются как исторические, не переносятся на новый candidate автоматически.

## 4. Требования и наблюдаемая приёмка

| ID | Требование | Проверка готовности |
|---|---|---|
| R01 | Нет скрытой отправки исходным разработчикам | Inventory всех transport/SDK/startup/tasks; трассировка вызовов; unit/integration negative cases; наблюдение трафика точной Release-сборки в перечисленных ниже сценариях. Неизвестные получатели расследованы. Одна blocklist не закрывает R01. |
| R02 | Пароли и локальные данные защищены | Независимые crypto vectors, неверный пароль/коллизии/недоступный bridge; Keychain policy; file protection, backup, logs и восстановление. Старый неподдерживаемый verifier имеет явный безопасный путь, без скрытого сброса данных. |
| R03 | Фоновые загрузки сохранены | Начало, уход в фон, lock/unlock, обрыв/повтор, отмена, возобновление, заполнение диска; redirects/CDN и проверка конечного файла. Отдельно различать system termination и force quit. |
| R04 | Google работает по умолчанию | Реальный безличный запрос; корректные URL/заголовки; consent/CAPTCHA/429/изменённая разметка/нет сети дают понятную ошибку, без выдуманных результатов. |
| R05 | Apple speech только по выбору | Fresh defaults OFF; Whisper работает без Apple speech; opt-in/отказ/отзыв permission/выключение во время записи; поздние callback не меняют новый сеанс. Проверить на физическом iPhone. |
| R06 | Сохранены основные сценарии | Чат/stream/cancel, выбор модели, документы/RAG, изображения и явно настроенные серверы проверены по inventory; offline/error/retry и восстановление без потери данных. |
| R07 | Собственная идентичность Own | Имя/иконка/launch/settings/about/идентификаторы/signing; нет исходной рекламы и атрибуции в согласованном объёме; сторонние notices на месте. |
| R08 | Дополнения по Ash | Каждая выбранная функция имеет pinned reference, границы переноса, лицензию, spec и отдельные unit/integration/runtime checks; заимствование не доказывает безопасность. |
| R10 | Apple Foundation Models по умолчанию, ручная альтернатива | Fresh launch выбирает доступную локальную системную модель; unavailable/deviceNotEligible/AppleIntelligenceNotEnabled/modelNotReady/OS unsupported/error имеют понятное объяснение и выбор. Ни одна ветка availability, retry, foreground и startup не вызывает скачивание альтернативы. Явное нажатие загрузки вызывает только выбранную пользователем загрузку; явная отмена не возобновляется сама. Выбор текущей модели сохраняется. Streaming/cancel, история, tools/RAG и ошибки контекста проверяются через настоящий adapter, затем на iPhone. |
| R11 | Информированная загрузка | До старта показать имя модели и полный размер загрузки (основная модель + обязательные дополнительные файлы, если они есть), рекомендацию Wi-Fi. Если полный размер неизвестен, прямо указать это, попытаться получить метаданные и не выдавать размер основного файла за полный. При обнаруженном мобильном интернете отдельно подтвердить продолжение; если тип сети неизвестен — честное предупреждение без заявления о Wi-Fi. Отмена не создаёт download task. Apple Foundation Models не показывать как скачиваемый Own файл. Unit/integration + UI/device checks для Wi-Fi/mobile/unknown/cancel/low storage и составных моделей. |
| R09 | Проверяемая установка | Clean revision, lockfiles, версии инструментария, Bundle ID/team/version/build; соответствие build и установленного приложения; core smoke на телефоне и инструкция восстановления. |

## 5. Порядок задач

| Задача | Связь | Работа / результат | Зависимости и проверка |
|---|---|---|---|
| T01 | R01–R09 | Сохранить текущие изменения, проверить воспроизводимость patches, завести в активном проекте spec/tasks/verification с этими ID. Зафиксировать baseline правил и candidate inputs. | Первая. Чтение diff, clean dependency setup в отдельном каталоге; исходные изменения не теряются. |
| T15 | R03,R10,R11 | Единое подтверждение загрузки для GGUF/vision, Whisper и изображений: имя, полный размер, Wi-Fi, явное действие. Переиспользовать существующий network API либо проверить необходимость малого native adapter; не добавлять аналитический SDK. Перечислить все download entry points, исключить обход подтверждения. | После inventory; до T12/T13. Tests до реализации, metadata/failure cases; повторно проверять мобильную сеть при фактическом старте, при этом не ломать явно запрошенное фоновое продолжение. |
| T14 | R01,R06,R09,R10 | Добавить native Foundation Models adapter с availability/stream/cancel и provider routing. До реализации проверить API установленного SDK, tool calling и context limits. Обновить startup, выбор модели, чат, историю и labels; исключить автоматическую загрузку и скрытый fallback. | После T01/inventory; до окончательной T12/T13. Unit + integration для selection/download policy, native compile, runtime unavailable/available и физический iPhone. Существующий RAG/tools не отключать молча. |
| T02 | R01,R02,R06 | Inventory сети, SDK, storage, background jobs, логов и всех функций; карта «данные → цель → получатель → хранение/удаление → согласие». Threat model по OWASP MASVS/MASTG. | T01; до окончательного решения по защитам. Показать неизвестные границы, не считать их N/A. |
| T03 | R01,R03 | Закончить сетевую защиту и политику источников моделей; исследовать Apple URLSession и CDN redirects; сохранить background. Проверить все transport, credentials, URL schemes и TLS downgrade. | T02. Unit/integration + реальный фон и трафик. Нельзя обещать универсальный запрет redirects по невызываемому background delegate. |
| T04 | R02 | Закончить пароль/Keychain/локальное хранение и безопасную обработку старого состояния. | T02. Independent vectors, negative tests, реальные native adapter и lock/relaunch/recovery. |
| T05 | R04,R06 | Закончить Google и интеграцию tools; проверить параметры, разметку результатов, ошибки и read_url. | T02; отдельно от T04. Fixtures + integration dispatcher + реальный запрос. |
| T06 | R05 | Добавить реальный переключатель Apple speech и подключить его к микрофону чата, с отменой и Whisper по умолчанию. | T02; unit/integration до изменения поведения, затем устройство. |
| T07 | R01,R06,R09 | Разобрать dependency advisories по reachability; исправить совместимо, сохранить lockfiles и patches. Убрать ложный успех из lint/test scripts, не обходить hooks. Исправить сборку. | T01/T02; native build последовательно с установкой зависимостей. Аудит без force, lint/types/tests, Release build. |
| T08 | R07 | Own branding, разрешения/purpose strings, честное описание privacy, удаление vendor promotion, свой signing. | После inventory; не затрагивать сторонние licenses. Проверить поиск по source/resources и внешний вид в приложении. |
| T09 | R08,R03 | Из Ash: понятный прогресс и ETA загрузки. Скорость/ETA сглажены; при недостатке данных нет выдуманного времени; retry/resume/background актуализируют состояние. | R03/T03; pinned Ash audit до переноса. Unit/integration + реальные обрывы/фон. |
| T10 | R08,R05 | Из Ash: управление голосом и озвучка по предложениям, очистка Markdown/служебных блоков, остановка при микрофоне/новом ответе. Сначала проверить доступный локальный TTS путь и ресурсы iPhone; не вводить облачный TTS молча. | T06/T07; выбор движка по исследованию до implementation. Cancellation/races/audio interruptions и память на устройстве. |
| T11 | R08,R06 | Из Ash: ссылки на фрагменты документов и индикатор контекста. Источники открывают правильный документ/фрагмент; context учитывает tokenizer, system prompt, tools, документы и резерв ответа. Если оценка приблизительная — это видно. | Inventory RAG/token API; независимы от T10, общий state меняется согласованно. Parser/token tests + UI/runtime. |
| T12 | R01–R09 | Объединённая regression, UI/accessibility review и отдельный итоговый проход по spec/diff, с исправлением найденного. | Все входящие функции соответствующего candidate. Повторять затронутые checks после исправлений. |
| T13 | R09 | Clean candidate, signing, установка на iPhone, финальные device/network checks, краткая инструкция и известные ограничения. | T12 и обязательные Validation gates. Никакого автоматического App Store upload. |

Работа ведётся проверяемыми срезами. Сначала базовые T01–T08 и обязательные T14–T15 (Apple Foundation Models и подтверждение загрузки), затем дополнения T09–T11, затем общая приёмка. Базовая пробная сборка может быть отдельным milestone; её нельзя объявлять завершением всех дополнений. T09: собственная реализация скорости/приблизительного ETA готова на уровне исходников, 47 целевых тестов прошли; реальные фоновые загрузки на телефоне ещё не проверены. Проверен Ash commit `868ca385c7546a81190699ce937794c59e9f269e`; код Ash не копировался. T10, T11 и T17 реализованы; состояние проверок и оставшиеся ограничения приведены в актуальном checkpoint ниже. T18 — заключительная очистка Android-части по новому указанию пользователя.

Независимые чтения/проверки выполняются параллельно, если не меняют общие inputs. Установка зависимостей, генерация patches, native build и signing выполняются последовательно. Один владелец интеграции — текущий агент; дополнительные агенты не требуются. Перед совместными изменениями voice/store/download фиксируются границы файлов. Ресурсные бюджеты по конкретной модели/телефону задаются до performance acceptance после baseline-измерений; процент и ETA разработки без измеримой основы не выдаются за факт.

## 6. Проверки и Evidence

До значимых изменений: тесты для новых правил; для significant features — unit и integration по действующему AGENTS.md. Проверить реальные scripts до запуска. Ранее обнаруженное маскирование ошибок в lint/test wrappers исправлено. Push hook останавливается при ошибке; сценарий с искусственной ошибкой lint проверен. Apple actual-model probe запускается явно через `test:ios:apple`; его ошибка 1026 на текущем host не считается PASS.

Для каждого check записывать ID, REQ, scope, commit + dirty snapshot/config/dependency identity, дату UTC, среду, команду/процедуру, результат, logs/xcresult/screenshots/trace. Для Validation требуется clean revision. Исторические журналы не переписывать. Статусы: PASS, FAIL, BLOCKED, NOT_RUN, NOT_APPLICABLE с причиной.

Обязательные группы:

1. Статические проверки: TypeScript, ESLint, SwiftLint в затронутом scope, secrets/logs/SDK/license/dependency review. Native crypto и network tests. Полные применимые unit/integration и native tests; open handles расследовать.
2. Сборка: воспроизводимый setup, проверка patches; Release simulator build и подписанная device build. Проверить architectures/resources/manifests, entitlements/team/Bundle ID. Simulator не заменяет iPhone.
3. Функции: fresh/cold/warm launch, чат/stream/cancel, модели/download/background/retry, Google/read_url, документы/RAG, изображения, local voice, optional Apple, выбранные Ash-функции, внешние серверы по scope.
4. Privacy: startup/idle, локальный чат offline, поиск, чтение URL, документы, голос OFF/ON, загрузка/redirect/background/relaunch. Synthetic content; отдельно app/OS traffic. Сопоставить trace с source paths/SDK, определить пределы наблюдения при TLS. Отсутствие пакетов в одном прогоне не доказывает отсутствие всех возможных отправок.
5. Состояние: denied/revoked permissions, lock/unlock, interruption, late callbacks, network loss, low storage, ошибка модели; данные не сбрасываются скрыто. Не удалять пользовательский контейнер или Keychain ради теста.
6. UI и доступность: реальные экраны Own, маленький/большой доступный simulator, физический iPhone, safe areas/keyboard/large text/VoiceOver/contrast/Reduce Motion. Loading/empty/error/offline/denied состояния и понятные тексты; build PASS не доказывает визуальное качество.
7. Производительность: Release на конкретном iPhone и моделях; cold/warm launch, first token, voice latency, memory/thermal/energy, UI responsiveness. Фиксировать модель/config/условия; не сравнивать debug с Release.
8. Отдельный финальный review: contract coverage, code quality, privacy assumptions, storage/recovery, races/permissions, source fidelity и licenses. Исправление findings → повтор affected checks. Независимый второй агент не обязателен и не выдаётся за выполненный review.

## 7. Что блокирует завершение

- Неуспешная сборка, непроверенные обязательные функции, неизвестные сетевые получатели, воспроизводимый обход согласия, потеря данных или значимые доступные уязвимости.
- Неустановленная идентичность подписанной/установленной сборки или отсутствие фактической проверки на телефоне.
- Нерешённая несовместимость фоновых загрузок с требованием отсутствия скрытой отправки. Найти технический путь и проверить; если требования окажутся несовместимы, остановить только зависимую ветвь и вынести конкретный выбор, не менять поведение молча.
- Новое существенное продуктовое решение: например, если локальный TTS не подходит и требуется платный/облачный сервис. Исследовать факты самостоятельно; согласовывать только реальное изменение продукта, не внутренние детали.

Validation завершена, когда применимые обязательные проверки конкретного candidate имеют PASS либо обоснованный NOT_APPLICABLE, нет unresolved blockers, Own установлен и core flows/трафик проверены на iPhone. FAIL = NOT_READY; отсутствующий обязательный check = INCOMPLETE. Инструкция должна объяснять загрузку моделей, внешние обращения, Apple opt-in/off и восстановление. Подписание и срок работы личной установки зависят от фактического Apple account/channel и проверяются перед передачей.

## 8. Следующий блок

Актуальный следующий блок: завершить T07 и T12 — native/UI checks, совместимые dependency fixes, проверка точной сборки и трафика. T14/T15 реализованы частично: проверки на физическом iPhone остаются обязательными. После onboarding и при повторном запуске открывать Main даже без загруженных моделей, сохраняя выбор Apple; альтернативу выбирает пользователь. Обратная связь удалена полностью.

### R12 / T16 — Own identity throughout delivery

The delivered app and owned source must contain no retired app branding, original developer or company identity. This includes filenames, native modules, bundle metadata, URLs, assets, documentation and published Git history. Keep unrelated third-party licenses. Preserve recovery material outside the delivery tree. Acceptance: inspect source paths and contents including binary metadata, inspect built bundle and launcher/UI, verify renamed native build. Static source checks alone do not establish runtime acceptance.


### R13 / T17 — Understandable model settings (final feature)

User request: configure response length, wording variety and how much conversation is considered without technical knowledge. Provide built-in presets and saved custom profiles; short explanations of effects on answers, speed and memory; show only settings supported by the selected model; warn about likely memory pressure; save a working setup and reset changes in one action; retain a separate advanced section.

Sequence: implement after the existing core development work, then repeat affected T12 regression and complete T13 phone acceptance. This feature must be included before calling development finished; it does not replace unresolved privacy, Apple generation, download or device gates.

Acceptance:
- Simple controls use everyday labels for answer length, wording variety and conversation history. Explanations distinguish a hard limit from a model preference or an estimate; do not promise speed or memory savings unsupported by the backend.
- A capability matrix covers Apple Foundation Models, local GGUF and explicitly configured remote providers. Unsupported parameters are hidden; switching models does not silently send unsupported advanced values. Apple model context size is not falsely presented as a configurable system-model memory allocation.
- Built-in profiles have stable defaults. Custom profiles can be created, named, saved and selected; they survive relaunch. Profiles retain only applicable settings with a clear outcome when the model changes.
- Unsaved changes can be reset in one action to the active profile. Built-in profiles stay recoverable. Changing settings never downloads or switches a model without an explicit user choice.
- Memory warnings use available device/model information, state uncertainty when necessary and do not claim to prevent all out-of-memory failures.
- The advanced section exposes supported technical parameters and explains how they relate to simple controls; conflicting settings have one authoritative value.
- Unit checks cover mapping, capability filtering, defaults/reset and persistence. Integration checks cover model switching and profile application. UI/device checks cover saving/selecting/resetting a custom profile, relaunch, small screens, large text and memory-warning states.

Implemented profiles use the existing model settings and local persistence. The per-engine capability contract and selected-profile reset baseline are covered by unit/integration tests. No additional engine or analytics SDK is introduced for profiles.


### Current implementation checkpoint (2026-10-24)
T09-T11 and T17 are implemented; T18 iOS-only cleanup is complete in the host source. The full iOS-only JavaScript run passed 5,329 tests in 202 suites (82.41% branch coverage). The literal-percent import correction also passed 167 focused tests and 15 document integration tests. Push and CI checks remain separate. Native tests passed 58 cases, including the Release logging guard. Actual simulator source opening and CPU Llama generation passed: 32 saved tokens, with a measured 20% context display. Settings profile/relaunch/reset/removal passed in normal/light and dark/accessibility-extra-large text; screenshots were inspected. Clean installation, four retained patches, Pods, resolved dependency APIs and live npm audit (0 advisories) passed. A signed Release iPhone build passed deep/strict verification, including changed-bundle and restored-source incremental signing regressions. The earlier explicit Apple-model probe failed on this host with error 1026; actual supported-device generation remains unverified. Phone installation, traffic, real background transfers, Files providers, permissions, audio interruptions, memory/performance and external review-service gates remain open. No release-ready claim. See verification.md and docs/privacy-and-phone-checks.md for exact evidence and limits.


## R14 — iOS-only source and delivery (T18)

The user explicitly requests Android removal after the current repair block. This supersedes earlier Android preservation. Acceptance: no owned Android target/native assets, platform-only branches, LiteRT/MNN/QNN implementations, obsolete patches, Android build/test/release commands or direct platform CLI dependency. Keep Apple Foundation Models, Llama/GGUF and vision, Core ML images, local/optional speech, Files import, RAG, remote providers, privacy guards and iOS background downloads. Shared upstream packages and their licenses remain intact. Keep recovery material and Git history; do not erase user data.

Verify supported-model filtering and safe import targets, clean dependency installation, iOS autolinking/Pods, types/lint, retained unit/integration coverage, native build/tests and representative simulator UI. Review the actual diff and scan owned source for remaining platform-only imports/configuration. Old platform tests are removed only with their unsupported implementation, never used to hide an iOS regression. Physical device acceptance stays separate.
