<?php
class OfferModel {
    public function __construct(private PDO $pdo) {}

    public function getActive(array $filters = []): array {
        $where = ["p.status = 'open'"]; 
        $params = [];
        
        if (!empty($filters['q'])) {
            $where[] = "(p.title LIKE ? OR p.description LIKE ?)";
            $params[] = "%{$filters['q']}%"; 
            $params[] = "%{$filters['q']}%";
        }
        if (!empty($filters['type'])) { 
            $where[] = "p.type = ?"; 
            $params[] = $filters['type']; 
        }
        if (!empty($filters['category'])) { 
            $where[] = "p.category = ?"; 
            $params[] = $filters['category']; 
        }

        $allowedSort = [
            'created_at_desc' => 'p.created_at DESC', 
            'created_at_asc' => 'p.created_at ASC', 
            'title_asc' => 'p.title ASC', 
            'title_desc' => 'p.title DESC'
        ];
        $orderBy = $allowedSort[$filters['sort'] ?? 'created_at_desc'] ?? 'p.created_at DESC';

        $sql = "SELECT p.*, u.name as author_name, u.telegram as author_telegram 
                FROM publications p 
                JOIN users u ON p.user_id = u.id 
                WHERE " . implode(' AND ', $where) . " 
                ORDER BY $orderBy";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function getById(int $id): ?array {
        $stmt = $this->pdo->prepare("SELECT p.*, u.name as author_name, u.telegram as author_telegram FROM publications p JOIN users u ON p.user_id = u.id WHERE p.id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function create(int $userId, string $title, string $desc, string $type, string $cat): int {
        $stmt = $this->pdo->prepare("INSERT INTO publications (user_id, title, description, type, category) VALUES (?,?,?,?,?)");
        $stmt->execute([$userId, $title, $desc, $type, $cat]);
        return (int)$this->pdo->lastInsertId();
    }

    public function update(int $id, string $title, string $desc, string $cat, string $status): bool {
        $stmt = $this->pdo->prepare("UPDATE publications SET title = ?, description = ?, category = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        return $stmt->execute([$title, $desc, $cat, $status, $id]);
    }

    public function delete(int $id): bool {
        $stmt = $this->pdo->prepare("DELETE FROM publications WHERE id = ?");
        return $stmt->execute([$id]);
    }

    public function getSmartMatch(int $userId, array $skills): ?array {
        $sql = "SELECT p.*, u.name as author_name FROM publications p JOIN users u ON p.user_id = u.id 
                WHERE p.status = 'open' AND p.user_id != ? 
                AND p.id NOT IN (SELECT offer_id FROM requests WHERE sender_id = ?)";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$userId, $userId]);
        $exams = $stmt->fetchAll();

        if (!$exams) return null;

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
        return $bestMatch;
    }
}