/**
 * Initialize Access Logs Table
 * Run this script once to create the access logs table
 * Usage: node scripts/init-access-logs.js
 */

const mysql = require('../config/database.js');

async function initAccessLogsTable() {
    try {
        console.log('Creating master_access_log table...');

        // Create the access logs table
        await mysql.Query(`
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
                INDEX idx_created_at_status (mal_createdAt, mal_statusCode),
                INDEX idx_user_activity (mal_userId, mal_createdAt),

                FOREIGN KEY (mal_userId) REFERENCES master_user(mu_id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✓ master_access_log table created successfully!');

        // Verify table was created
        const result = await mysql.Query(`SHOW TABLES LIKE 'master_access_log'`);
        if (result.length > 0) {
            console.log('✓ Table verification passed');

            // Show table structure
            const structure = await mysql.Query(`DESCRIBE master_access_log`);
            console.log('\nTable structure:');
            console.table(structure);
        } else {
            console.error('✗ Table verification failed');
        }

        console.log('\n✓ Access logging system is ready to use!');
        process.exit(0);

    } catch (error) {
        console.error('Error initializing access logs table:', error);
        console.error('\nTroubleshooting:');
        console.error('1. Make sure your database connection is configured correctly in .env');
        console.error('2. Verify the master_user table exists (required for foreign key)');
        console.error('3. Check that you have CREATE TABLE permissions');
        process.exit(1);
    }
}

// Run initialization
initAccessLogsTable();
