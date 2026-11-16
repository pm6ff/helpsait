<?php
class RequestModel {
    public function __construct(private PDO $pdo) {}

    public function create(int $offerId, int $senderId, int $receiverId, string $message): bool {
        try {
            $stmt = $this->pdo->prepare("INSERT INTO requests (offer_id, sender_id, receiver_id, message) VALUES (?,?,?,?)");
            return $stmt->execute([$offerId, $senderId, $receiverId, $message]);
        } catch (PDOException $e) {
            return false; // Дубликат
        }
    }

    public function getMyRequests(int $userId): array {
        $outgoing = $this->pdo->prepare("SELECT r.*, p.title, u.name as receiver_name FROM requests r JOIN publications p ON r.offer_id = p.id JOIN users u ON r.receiver_id = u.id WHERE r.sender_id = ? ORDER BY r.created_at DESC");
        $outgoing->execute([$userId]);

        $incoming = $this->pdo->prepare("SELECT r.*, p.title, u.name as sender_name, u.telegram as sender_telegram FROM requests r JOIN publications p ON r.offer_id = p.id JOIN users u ON r.sender_id = u.id WHERE r.receiver_id = ? ORDER BY r.created_at DESC");
        $incoming->execute([$userId]);

        return ['outgoing' => $outgoing->fetchAll(), 'incoming' => $incoming->fetchAll()];
    }

    public function getById(int $id): ?array {
        $stmt = $this->pdo->prepare("SELECT * FROM requests WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function updateStatus(int $id, string $status): bool {
        $stmt = $this->pdo->prepare("UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        return $stmt->execute([$status, $id]);
    }

    public function closeOffer(int $offerId): bool {
        $stmt = $this->pdo->prepare("UPDATE publications SET status = 'closed' WHERE id = ?");
        return $stmt->execute([$offerId]);
    }
}