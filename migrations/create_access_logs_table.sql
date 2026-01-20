-- Create Access Logs Table for comprehensive system logging
CREATE TABLE IF NOT EXISTS master_access_log (
    mal_id INT AUTO_INCREMENT PRIMARY KEY,
    mal_userId INT NULL,
    mal_username VARCHAR(100) NULL,
    mal_action VARCHAR(100) NOT NULL,
    mal_resourceType VARCHAR(50) NOT NULL,
    mal_resourceId INT NULL,
    mal_method VARCHAR(10) NOT NULL,
    mal_endpoint VARCHAR(255) NOT NULL,
    mal_statusCode INT NOT NULL,
    mal_responseTime INT NULL COMMENT 'Response time in milliseconds',
    mal_ipAddress VARCHAR(45) NULL,
    mal_userAgent TEXT NULL,
    mal_requestBody TEXT NULL,
    mal_responseMessage TEXT NULL,
    mal_severity ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL') DEFAULT 'INFO',
    mal_category ENUM('AUTH', 'USER', 'SESSION', 'PAYMENT', 'ATTENDANCE', 'ADMIN', 'SYSTEM') DEFAULT 'SYSTEM',
    mal_createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_userId (mal_userId),
    INDEX idx_action (mal_action),
    INDEX idx_category (mal_category),
    INDEX idx_severity (mal_severity),
    INDEX idx_createdAt (mal_createdAt),
    INDEX idx_statusCode (mal_statusCode),

    FOREIGN KEY (mal_userId) REFERENCES master_user(mu_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create index for fast log retrieval by date range
CREATE INDEX idx_created_at_status ON master_access_log(mal_createdAt, mal_statusCode);

-- Create index for user activity tracking
CREATE INDEX idx_user_activity ON master_access_log(mal_userId, mal_createdAt);
