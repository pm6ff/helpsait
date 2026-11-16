<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>Каталог MVC</title></head>
<body>
    <h1>Каталог публикаций (Классический MVC)</h1>
    <?php foreach ($offers as $offer): ?>
        <article>
            <h2><?= htmlspecialchars($offer['title']) ?></h2>
            <p>Категория: <?= htmlspecialchars($offer['category']) ?></p>
        </article>
    <?php endforeach; ?>
</body>
</html>