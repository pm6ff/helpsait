<?php
// api/publications.php — REST-ресурс «публикации»
require __DIR__ . '/db.php';
require __DIR__ . '/response.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        handle_get($pdo);
    } elseif ($method === 'POST') {
        handle_post($pdo);
    } else {
        header('Allow: GET, POST');
        json_error('Метод не поддерживается', 405);
    }
} catch (PDOException $e) {
    json_error('Внутренняя ошибка сервера', 500);
}

function handle_get(PDO $pdo): void
{
    // GET /api/publications.php?id=1 — одна публикация
    if (isset($_GET['id'])) {
        $id = filter_var($_GET['id'], FILTER_VALIDATE_INT);
        if ($id === false || $id < 1) {
            json_error('Некорректный id', 400);
        }
        $stmt = $pdo->prepare(
            'SELECT id, user_id, title, description, type, category,
                    status, created_at, updated_at
             FROM publications WHERE id = ?'
        );
        $stmt->execute([$id]);
        $publication = $stmt->fetch();
        if (!$publication) {
            json_error('Публикация не найдена', 404);
        }
        json_response($publication);
    }

    // GET /api/publications.php — список всех публикаций
    $stmt = $pdo->query(
        'SELECT id, user_id, title, description, type, category,
                status, created_at, updated_at
         FROM publications ORDER BY created_at DESC, id DESC'
    );
    json_response($stmt->fetchAll());
}

function str_field(array $data, string $key, string $default = ''): string
{
    return isset($data[$key]) && is_string($data[$key])
        ? trim($data[$key]) : $default;
}

function handle_post(PDO $pdo): void
{
    // 1. Заголовок Content-Type должен быть application/json
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') !== 0) {
        json_error('Ожидается Content-Type: application/json', 400);
    }

    // 2. Тело запроса должно быть корректным JSON-объектом
    $data = json_decode(file_get_contents('php://input'), true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        json_error('Некорректный JSON', 400);
    }

    // 3. Валидация полей
    $title       = str_field($data, 'title');
    $description = str_field($data, 'description');
    $category    = str_field($data, 'category', 'Разное');
    $type        = $data['type'] ?? 'exam';
    $userId      = filter_var($data['user_id'] ?? null, FILTER_VALIDATE_INT);

    if ($title === '' || mb_strlen($title) > 100) {
        json_error('Заголовок обязателен (до 100 символов)', 400);
    }
    if ($description === '' || mb_strlen($description) > 1000) {
        json_error('Описание обязательно (до 1000 символов)', 400);
    }
    if (!in_array($type, ['exam', 'help'], true)) {
        json_error('Недопустимый тип публикации', 400);
    }
    if ($userId === false || $userId < 1) {
        json_error('Некорректный user_id', 400);
    }

    $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    if (!$stmt->fetch()) {
        json_error('Пользователь не найден', 400);
    }

    // 4. Сохранение через подготовленный запрос
    $stmt = $pdo->prepare(
        'INSERT INTO publications
            (user_id, title, description, type, category)
         VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([$userId, $title, $description, $type, $category]);
    $id = (int)$pdo->lastInsertId();

    // 5. Ответ 201 Created
    header('Location: /api/publications.php?id=' . $id);
    json_response(['id' => $id, 'message' => 'Публикация создана'], 201);
}
