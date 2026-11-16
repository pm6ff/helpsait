<?php
class UserModel {
    public function __construct(private PDO $pdo) {}

    public function findByEmail(string $email): ?array {
        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        return $stmt->fetch() ?: null;
    }

    public function getProfile(int $id): ?array {
        $stmt = $this->pdo->prepare("SELECT id, name, email, bio, skills, created_at, telegram FROM users WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function updateProfile(int $id, string $name, string $bio, string $skills, string $telegram): bool {
        $stmt = $this->pdo->prepare("UPDATE users SET name = ?, bio = ?, skills = ?, telegram = ? WHERE id = ?");
        return $stmt->execute([$name, $bio, $skills, $telegram, $id]);
    }

    public function create(string $name, string $email, string $hash, string $telegram): bool {
        $stmt = $this->pdo->prepare("INSERT INTO users (name, email, pass, telegram) VALUES (?,?,?,?)");
        return $stmt->execute([$name, $email, $hash, $telegram]);
    }

    public function updatePassword(int $id, string $newHash): bool {
        $stmt = $this->pdo->prepare("UPDATE users SET pass = ? WHERE id = ?");
        return $stmt->execute([$newHash, $id]);
    }
}