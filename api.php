<?php
// api.php
session_start();
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', 1);
error_reporting(E_ALL);

// --- Подключение к БД ---
$dbFile = __DIR__ . '/database.sqlite';
$isNew = !file_exists($dbFile);
$pdo = new PDO('sqlite:' . $dbFile);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

// --- Таблицы ---
$pdo->exec("CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    pass TEXT NOT NULL,
    bio TEXT DEFAULT '',
    skills TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    telegram TEXT DEFAULT ''
)");

$pdo->exec("CREATE TABLE IF NOT EXISTS publications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('exam', 'help')),
    category TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed', 'archived')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)");

$pdo->exec("CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER,
    user_id INTEGER,
    text TEXT, telegram TEXT,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (exam_id) REFERENCES publications(id) ON DELETE CASCADE
)");

// --- Демо-данные ---
if ($isNew) {
    $h1 = password_hash('1234', PASSWORD_DEFAULT);
    $h2 = password_hash('1234', PASSWORD_DEFAULT);
    $pdo->prepare("INSERT INTO users (name, email, pass, bio, skills, telegram) VALUES (?,?,?,?,?,?)")
        ->execute(['Анна Петрова', 'anna@mail.ru', $h1, 'Помогаю с математикой', 'математика, физика', '@anna_math']);
    $pdo->prepare("INSERT INTO users (name, email, pass, bio, skills, telegram) VALUES (?,?,?,?,?,?)")
        ->execute(['Иван Сидоров', 'ivan@mail.ru', $h2, 'Программирование', 'js, python', '@ivan_dev']);
    
    $pdo->prepare("INSERT INTO publications (user_id, title, description, type, category) VALUES (?,?,?,?,?)")
        ->execute([1, 'Подготовка к ЕГЭ по математике', 'Разбор задач части С. 11 класс. Онлайн. 1000 ₽. Дата: 2026-06-15', 'exam', 'Математика']);
    $pdo->prepare("INSERT INTO publications (user_id, title, description, type, category) VALUES (?,?,?,?,?)")
        ->execute([2, 'Экзамен по английскому (B2)', 'Разговорная практика. 2 курс. Онлайн. 800 ₽. Дата: 2026-05-20', 'exam', 'Английский']);
}

// --- Хелперы ---
function json_out($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function clean($str, $max = 255) {
    if (!is_string($str)) return '';
    $str = strip_tags($str);
    $str = htmlspecialchars($str, ENT_QUOTES, 'UTF-8');
    return function_exists('mb_substr') ? mb_substr(trim($str), 0, $max) : substr(trim($str), 0, $max);
}

function get_json_input() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

// --- Роутинг ---
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// --- АВТОРИЗАЦИЯ ---
if ($action === 'login' && $method === 'POST') {
    $input = get_json_input();
    $email = clean($input['email'] ?? '');
    $pass = $input['pass'] ?? '';
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if ($user && password_verify($pass, $user['pass'])) {
        $_SESSION['user_id'] = $user['id'];
        unset($user['pass']);
        json_out($user);
    }
    json_out(['error' => 'Неверный email или пароль'], 401);
}

if ($action === 'register' && $method === 'POST') {
    $input = get_json_input();
    $name = clean($input['name'] ?? '', 60);
    $email = clean($input['email'] ?? '', 100);
    $pass = $input['pass'] ?? '';
    $bio = clean($input['bio'] ?? '', 300);
    $skills = clean($input['skills'] ?? '', 200);
    $telegram = clean($input['telegram'] ?? '', 32);

    if (strlen($name) < 2) json_out(['error' => 'Имя слишком короткое'], 400);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Некорректный email'], 400);
    if (strlen($pass) < 4) json_out(['error' => 'Пароль слишком короткий'], 400);

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) json_out(['error' => 'Email уже существует'], 400);

    $hash = password_hash($pass, PASSWORD_DEFAULT);
    $pdo->prepare("INSERT INTO users (name, email, pass, bio, skills, telegram) VALUES (?,?,?,?,?,?)")
        ->execute([$name, $email, $hash, $bio, $skills, $telegram]);
    $_SESSION['user_id'] = $pdo->lastInsertId();
    json_out(['success' => true]);
}

if ($action === 'logout') {
    session_destroy();
    json_out(['success' => true]);
}

if ($action === 'me') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $stmt = $pdo->prepare("SELECT id, name, email, bio, skills, created_at, telegram FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    json_out($stmt->fetch());
}

if ($action === 'update_profile' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $input = get_json_input();
    $id = (int)($input['id'] ?? 0);
    if ($id !== (int)$_SESSION['user_id']) json_out(['error' => 'Доступ запрещен'], 403);

    $name = clean($input['name'] ?? '');
    $bio = clean($input['bio'] ?? '', 300);
    $skills = clean($input['skills'] ?? '', 200);
    $telegram = clean($input['telegram'] ?? '', 32);

    $pdo->prepare("UPDATE users SET name = ?, bio = ?, skills = ?, telegram = ? WHERE id = ?")
        ->execute([$name, $bio, $skills, $telegram, $_SESSION['user_id']]);
    json_out(['success' => true]);
}

if ($action === 'change_password' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $input = get_json_input();
    $oldPass = $input['oldPass'] ?? '';
    $newPass = $input['newPass'] ?? '';

    if (strlen($newPass) < 4) json_out(['error' => 'Пароль слишком короткий'], 400);

    $stmt = $pdo->prepare("SELECT pass FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    if (!password_verify($oldPass, $user['pass'])) json_out(['error' => 'Неверный текущий пароль'], 401);

    $pdo->prepare("UPDATE users SET pass = ? WHERE id = ?")
        ->execute([password_hash($newPass, PASSWORD_DEFAULT), $_SESSION['user_id']]);
    json_out(['success' => true]);
}

// --- CRUD ПУБЛИКАЦИЙ (С ПОИСКОМ И ФИЛЬТРАМИ) ---
if ($action === 'exams' && $method === 'GET') {
    $where = ["p.status = 'open'"]; // Закрытые не показываем
    $params = [];

    // Поиск (title или description)
    $q = trim($_GET['q'] ?? '');
    if ($q !== '') {
        $where[] = "(p.title LIKE ? OR p.description LIKE ?)";
        $params[] = "%{$q}%";
        $params[] = "%{$q}%";
    }

    // Фильтр по типу
    $type = $_GET['type'] ?? '';
    if ($type === 'exam' || $type === 'help') {
        $where[] = "p.type = ?";
        $params[] = $type;
    }

    // Фильтр по категории
    $category = $_GET['category'] ?? '';
    if ($category !== '') {
        $where[] = "p.category = ?";
        $params[] = $category;
    }

    // Безопасная сортировка (белый список)
    $allowedSort = [
        'created_at_desc' => 'p.created_at DESC',
        'created_at_asc'  => 'p.created_at ASC',
        'title_asc'       => 'p.title ASC',
        'title_desc'      => 'p.title DESC'
    ];
    $sort = $_GET['sort'] ?? 'created_at_desc';
    $orderBy = $allowedSort[$sort] ?? 'p.created_at DESC';

    $sql = "SELECT p.*, u.name as author_name, u.telegram as author_telegram 
            FROM publications p 
            JOIN users u ON p.user_id = u.id 
            WHERE " . implode(' AND ', $where) . " 
            ORDER BY $orderBy";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $exams = $stmt->fetchAll();

    foreach ($exams as &$e) {
        $stmtOffers = $pdo->prepare("SELECT o.*, u.name as user_name, u.telegram as user_telegram FROM offers o JOIN users u ON o.user_id = u.id WHERE o.exam_id = ?");
        $stmtOffers->execute([$e['id']]);
        $e['offers'] = $stmtOffers->fetchAll();
        $e['deadline'] = $e['created_at'];
        $e['subject'] = $e['category']; 
    }
    json_out($exams);
}

if ($action === 'get_exam' && isset($_GET['id'])) {
    $stmt = $pdo->prepare("SELECT p.*, u.name as author_name, u.telegram as author_telegram FROM publications p JOIN users u ON p.user_id = u.id WHERE p.id = ?");
    $stmt->execute([$_GET['id']]);
    $pub = $stmt->fetch();
    if (!$pub) json_out(['error' => 'Не найдено'], 404);
    json_out($pub);
}

if ($action === 'create_exam' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $input = get_json_input();

    $title = clean($input['title'] ?? '', 100);
    $description = clean($input['description'] ?? '', 1000);
    $category = clean($input['category'] ?? $input['subject'] ?? 'Разное', 60);
    $type = ($input['type'] ?? '') === 'help' ? 'help' : 'exam';
    
    if (strlen($title) < 2) json_out(['error' => 'Заголовок слишком короткий'], 400);

    $stmt = $pdo->prepare("INSERT INTO publications (user_id, title, description, type, category) VALUES (?,?,?,?,?)");
    $stmt->execute([$_SESSION['user_id'], $title, $description, $type, $category]);
    json_out(['id' => $pdo->lastInsertId()]);
}

if ($action === 'update_exam' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $input = get_json_input();
    $id = (int)($input['id'] ?? 0);

    $stmt = $pdo->prepare("SELECT user_id FROM publications WHERE id = ?");
    $stmt->execute([$id]);
    $pub = $stmt->fetch();
    if (!$pub) json_out(['error' => 'Публикация не найдена'], 404);
    if ($pub['user_id'] !== (int)$_SESSION['user_id']) json_out(['error' => 'Можно редактировать только свои записи'], 403);

    $title = clean($input['title'] ?? '', 100);
    $description = clean($input['description'] ?? '', 1000);
    $category = clean($input['category'] ?? '', 60);
    $status = in_array($input['status'] ?? '', ['open', 'closed', 'archived']) ? $input['status'] : 'open';

    $pdo->prepare("UPDATE publications SET title = ?, description = ?, category = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        ->execute([$title, $description, $category, $status, $id]);
    json_out(['success' => true]);
}

if ($action === 'delete_exam' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $input = get_json_input();
    $id = (int)($input['id'] ?? 0);

    $stmt = $pdo->prepare("SELECT user_id FROM publications WHERE id = ?");
    $stmt->execute([$id]);
    $pub = $stmt->fetch();
    if (!$pub) json_out(['error' => 'Публикация не найдена'], 404);
    if ($pub['user_id'] !== (int)$_SESSION['user_id']) json_out(['error' => 'Можно удалять только свои записи'], 403);

    $pdo->prepare("DELETE FROM publications WHERE id = ?")->execute([$id]);
    json_out(['success' => true]);
}

// --- ОТКЛИКИ И ЗАКРЫТИЕ ---
if ($action === 'create_offer' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $input = get_json_input();
    $pdo->prepare("INSERT INTO offers (exam_id, user_id, text, telegram) VALUES (?,?,?,?)")
        ->execute([
            (int)($input['exam_id'] ?? 0),
            $_SESSION['user_id'],
            clean($input['text'] ?? '', 500),
            clean($input['telegram'] ?? '', 32)
        ]);
    json_out(['id' => $pdo->lastInsertId()]);
}

if ($action === 'update_offer' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $input = get_json_input();
    $status = ($input['status'] ?? '') === 'accepted' ? 'accepted' : 'declined';
    $pdo->prepare("UPDATE offers SET status = ? WHERE id = ?")->execute([$status, (int)($input['offer_id'] ?? 0)]);
    json_out(['success' => true]);
}

if ($action === 'close_exam' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $input = get_json_input();
    $pdo->prepare("UPDATE publications SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        ->execute([(int)($input['exam_id'] ?? 0)]);
    json_out(['success' => true]);
}
 
json_out(['error' => 'Неизвестный запрос'], 404);
