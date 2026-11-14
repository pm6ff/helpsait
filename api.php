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
    name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, pass TEXT NOT NULL,
    bio TEXT DEFAULT '', skills TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, telegram TEXT DEFAULT ''
)");

$pdo->exec("CREATE TABLE IF NOT EXISTS publications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    title TEXT NOT NULL, description TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('exam', 'help')),
    category TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed', 'archived')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)");

$pdo->exec("CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id INTEGER NOT NULL, sender_id INTEGER NOT NULL, receiver_id INTEGER NOT NULL,
    message TEXT, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (offer_id) REFERENCES publications(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (offer_id, sender_id)
)");

$pdo->exec("CREATE TABLE IF NOT EXISTS global_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)");

// --- Демо-данные ---
if ($isNew) {
    $h1 = password_hash('1234', PASSWORD_DEFAULT);
    $h2 = password_hash('1234', PASSWORD_DEFAULT);
    $pdo->prepare("INSERT INTO users (name, email, pass, telegram, skills) VALUES (?,?,?,?,?)")
        ->execute(['Анна Петрова', 'anna@mail.ru', $h1, '@anna_math', 'математика, физика']);
    $pdo->prepare("INSERT INTO users (name, email, pass, telegram, skills) VALUES (?,?,?,?,?)")
        ->execute(['Иван Сидоров', 'ivan@mail.ru', $h2, '@ivan_dev', 'программирование, английский']);
    
    $pdo->prepare("INSERT INTO publications (user_id, title, description, type, category) VALUES (?,?,?,?,?)")
        ->execute([1, 'Подготовка к ЕГЭ по математике', 'Разбор задач части С.', 'exam', 'Математика']);
    $pdo->prepare("INSERT INTO publications (user_id, title, description, type, category) VALUES (?,?,?,?,?)")
        ->execute([2, 'Помощь с Python', 'Объясню ООП и работу с библиотеками.', 'help', 'Программирование']);
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
function get_json_input() { return json_decode(file_get_contents('php://input'), true) ?: []; }

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
    $telegram = clean($input['telegram'] ?? '', 32);

    if (strlen($name) < 2) json_out(['error' => 'Имя слишком короткое'], 400);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Некорректный email'], 400);
    if (strlen($pass) < 4) json_out(['error' => 'Пароль слишком короткий'], 400);

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) json_out(['error' => 'Email уже существует'], 400);

    $hash = password_hash($pass, PASSWORD_DEFAULT);
    $pdo->prepare("INSERT INTO users (name, email, pass, telegram) VALUES (?,?,?,?)")
        ->execute([$name, $email, $hash, $telegram]);
    $_SESSION['user_id'] = $pdo->lastInsertId();
    json_out(['success' => true]);
}

if ($action === 'logout') { session_destroy(); json_out(['success' => true]); }

if ($action === 'me') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $stmt = $pdo->prepare("SELECT id, name, email, bio, skills, created_at, telegram FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    json_out($stmt->fetch());
}

if ($action === 'update_profile' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $input = get_json_input();
    if ((int)($input['id'] ?? 0) !== (int)$_SESSION['user_id']) json_out(['error' => 'Доступ запрещен'], 403);

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

// --- КАТАЛОГ ---
if ($action === 'exams' && $method === 'GET') {
    $where = ["p.status = 'open'"]; $params = [];
    if (!empty($_GET['q'])) {
        $where[] = "(p.title LIKE ? OR p.description LIKE ?)";
        $params[] = "%{$_GET['q']}%"; $params[] = "%{$_GET['q']}%";
    }
    if (!empty($_GET['type'])) { $where[] = "p.type = ?"; $params[] = $_GET['type']; }
    if (!empty($_GET['category'])) { $where[] = "p.category = ?"; $params[] = $_GET['category']; }

    $allowedSort = ['created_at_desc' => 'p.created_at DESC', 'created_at_asc' => 'p.created_at ASC', 'title_asc' => 'p.title ASC', 'title_desc' => 'p.title DESC'];
    $orderBy = $allowedSort[$_GET['sort'] ?? 'created_at_desc'] ?? 'p.created_at DESC';

    $sql = "SELECT p.*, u.name as author_name, u.telegram as author_telegram FROM publications p JOIN users u ON p.user_id = u.id WHERE " . implode(' AND ', $where) . " ORDER BY $orderBy";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    json_out($stmt->fetchAll());
}

if ($action === 'get_exam' && isset($_GET['id'])) {
    $stmt = $pdo->prepare("SELECT p.*, u.name as author_name, u.telegram as author_telegram FROM publications p JOIN users u ON p.user_id = u.id WHERE p.id = ?");
    $stmt->execute([$_GET['id']]);
    json_out($stmt->fetch());
}

if ($action === 'create_exam' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $input = get_json_input();
    $title = clean($input['title'] ?? '', 100);
    $description = clean($input['description'] ?? '', 1000);
    $category = clean($input['category'] ?? 'Разное', 60);
    $type = ($input['type'] ?? '') === 'help' ? 'help' : 'exam';
    if (strlen($title) < 2) json_out(['error' => 'Заголовок слишком короткий'], 400);

    $pdo->prepare("INSERT INTO publications (user_id, title, description, type, category) VALUES (?,?,?,?,?)")
        ->execute([$_SESSION['user_id'], $title, $description, $type, $category]);
    json_out(['id' => $pdo->lastInsertId()]);
}

if ($action === 'update_exam' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $input = get_json_input(); $id = (int)($input['id'] ?? 0);

    $stmt = $pdo->prepare("SELECT user_id FROM publications WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->fetch()['user_id'] !== (int)$_SESSION['user_id']) json_out(['error' => 'Только свои записи'], 403);

    $pdo->prepare("UPDATE publications SET title = ?, description = ?, category = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        ->execute([clean($input['title']), clean($input['description']), clean($input['category']), $input['status'], $id]);
    json_out(['success' => true]);
}

if ($action === 'delete_exam' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $id = (int)(get_json_input()['id'] ?? 0);
    $stmt = $pdo->prepare("SELECT user_id FROM publications WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->fetch()['user_id'] !== (int)$_SESSION['user_id']) json_out(['error' => 'Только свои записи'], 403);

    $pdo->prepare("DELETE FROM publications WHERE id = ?")->execute([$id]);
    json_out(['success' => true]);
}

// --- ЗАЯВКИ ---
if ($action === 'create_request' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $input = get_json_input();
    $offer_id = (int)($input['offer_id'] ?? 0);
    $message = clean($input['message'] ?? '', 500);

    $stmt = $pdo->prepare("SELECT user_id FROM publications WHERE id = ?");
    $stmt->execute([$offer_id]);
    $pub = $stmt->fetch();
    if (!$pub) json_out(['error' => 'Публикация не найдена'], 404);

    if ($pub['user_id'] === (int)$_SESSION['user_id']) json_out(['error' => 'Нельзя откликаться на свою публикацию'], 403);

    try {
        $pdo->prepare("INSERT INTO requests (offer_id, sender_id, receiver_id, message) VALUES (?,?,?,?)")
            ->execute([$offer_id, $_SESSION['user_id'], $pub['user_id'], $message]);
        json_out(['success' => true]);
    } catch (PDOException $e) {
        json_out(['error' => 'Вы уже отправляли заявку на эту публикацию'], 400);
    }
}

if ($action === 'my_requests' && $method === 'GET') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $uid = $_SESSION['user_id'];

    $outgoing = $pdo->prepare("SELECT r.*, p.title, u.name as receiver_name FROM requests r JOIN publications p ON r.offer_id = p.id JOIN users u ON r.receiver_id = u.id WHERE r.sender_id = ? ORDER BY r.created_at DESC");
    $outgoing->execute([$uid]);

    $incoming = $pdo->prepare("SELECT r.*, p.title, u.name as sender_name, u.telegram as sender_telegram FROM requests r JOIN publications p ON r.offer_id = p.id JOIN users u ON r.sender_id = u.id WHERE r.receiver_id = ? ORDER BY r.created_at DESC");
    $incoming->execute([$uid]);

    json_out(['outgoing' => $outgoing->fetchAll(), 'incoming' => $incoming->fetchAll()]);
}

if ($action === 'update_request_status' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $input = get_json_input();
    $id = (int)($input['request_id'] ?? 0);
    $new_status = $input['status'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM requests WHERE id = ?");
    $stmt->execute([$id]);
    $req = $stmt->fetch();
    if (!$req) json_out(['error' => 'Заявка не найдена'], 404);

    if ($new_status === 'cancelled') {
        if ($req['sender_id'] !== (int)$_SESSION['user_id']) json_out(['error' => 'Только отправитель может отменить'], 403);
        if ($req['status'] !== 'pending') json_out(['error' => 'Отменить можно только ожидающую заявку'], 400);
    } else if ($new_status === 'accepted' || $new_status === 'rejected') {
        if ($req['receiver_id'] !== (int)$_SESSION['user_id']) json_out(['error' => 'Только получатель может принять/отклонить'], 403);
        if ($req['status'] !== 'pending') json_out(['error' => 'Действие доступно только для ожидающих'], 400);
    } else {
        json_out(['error' => 'Неверный статус'], 400);
    }

    $pdo->prepare("UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$new_status, $id]);
    if ($new_status === 'accepted') {
        $pdo->prepare("UPDATE publications SET status = 'closed' WHERE id = ?")->execute([$req['offer_id']]);
    }
    json_out(['success' => true]);
}

// --- УМНЫЙ ПОДБОР ---
if ($action === 'smart_match' && $method === 'GET') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    
    $stmt = $pdo->prepare("SELECT skills FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    $skills = array_filter(array_map('trim', explode(',', mb_strtolower($user['skills'] ?? ''))));
    
    $sql = "SELECT p.*, u.name as author_name FROM publications p JOIN users u ON p.user_id = u.id 
            WHERE p.status = 'open' AND p.user_id != ? 
            AND p.id NOT IN (SELECT offer_id FROM requests WHERE sender_id = ?)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$_SESSION['user_id'], $_SESSION['user_id']]);
    $exams = $stmt->fetchAll();

    if (!$exams) json_out(['error' => 'Все идеальные заявки уже разобраны!'], 404);

    $bestMatch = null; $maxScore = -1;
    foreach ($exams as $exam) {
        $score = 0;
        $examText = mb_strtolower($exam['category'] . ' ' . $exam['title']);
        foreach ($skills as $skill) {
            if (!empty($skill) && mb_strpos($examText, $skill) !== false) $score += 10;
        }
        $score += rand(0, 5);
        if ($score > $maxScore) { $maxScore = $score; $bestMatch = $exam; }
    }
    json_out($bestMatch);
}

// --- ОБЩИЙ ЧАТ ---
if ($action === 'send_global_msg' && $method === 'POST') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $text = clean(get_json_input()['text'] ?? '', 500);
    if (!$text) json_out(['error' => 'Пустое сообщение'], 400);

    $pdo->prepare("INSERT INTO global_messages (user_id, text) VALUES (?,?)")->execute([$_SESSION['user_id'], $text]);
    json_out(['success' => true]);
}

if ($action === 'get_global_msgs' && $method === 'GET') {
    if (empty($_SESSION['user_id'])) json_out(['error' => 'Не авторизован'], 401);
    $stmt = $pdo->query("
        SELECT m.*, u.name as author, u.id as author_id 
        FROM global_messages m JOIN users u ON m.user_id = u.id 
        ORDER BY m.created_at ASC LIMIT 100
    ");
    json_out($stmt->fetchAll());
}

json_out(['error' => 'Неизвестный запрос'], 404);
