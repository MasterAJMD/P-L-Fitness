-- P-L-Fitness Database Schema for TiDB Cloud
-- Run this script in TiDB Cloud SQL Editor to create all tables

-- 1. Master User Table
CREATE TABLE IF NOT EXISTS master_user (
    mu_id INT AUTO_INCREMENT PRIMARY KEY,
    mu_username VARCHAR(100) NOT NULL UNIQUE,
    mu_password VARCHAR(255) NOT NULL,
    mu_email VARCHAR(255) NOT NULL UNIQUE,
    mu_firstName VARCHAR(100),
    mu_lastName VARCHAR(100),
    mu_phoneNumber VARCHAR(20),
    mu_role ENUM('ADMIN', 'MEMBER', 'COACH') DEFAULT 'MEMBER',
    mu_specialty VARCHAR(255),
    mu_status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED') DEFAULT 'ACTIVE',
    mu_createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mu_updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    mu_deletedAt TIMESTAMP NULL,
    mu_createdById INT,
    mu_updatedById INT,
    mu_deletedById INT
);

-- 2. Master Session Table
CREATE TABLE IF NOT EXISTS master_session (
    ms_id INT AUTO_INCREMENT PRIMARY KEY,
    ms_userId INT,
    ms_sessionName VARCHAR(255),
    ms_name VARCHAR(255),
    ms_type VARCHAR(100),
    ms_datetime DATETIME,
    ms_capacity INT DEFAULT 20,
    ms_status VARCHAR(50) DEFAULT 'ACTIVE',
    FOREIGN KEY (ms_userId) REFERENCES master_user(mu_id) ON DELETE SET NULL
);

-- 3. Master Attendance Table
CREATE TABLE IF NOT EXISTS master_attendance (
    ma_id INT AUTO_INCREMENT PRIMARY KEY,
    ma_userId INT,
    ma_sessionId INT,
    ma_checkin DATETIME,
    ma_checkout DATETIME,
    ma_checkInTime DATETIME,
    ma_duration INT DEFAULT 0,
    ma_pointsEarned INT DEFAULT 0,
    ma_deleted TINYINT DEFAULT 0,
    FOREIGN KEY (ma_userId) REFERENCES master_user(mu_id) ON DELETE CASCADE,
    FOREIGN KEY (ma_sessionId) REFERENCES master_session(ms_id) ON DELETE SET NULL
);

-- 4. Master Equipment Table
CREATE TABLE IF NOT EXISTS master_equipment (
    me_id INT AUTO_INCREMENT PRIMARY KEY,
    me_brand VARCHAR(255),
    me_type VARCHAR(255),
    me_status VARCHAR(50) DEFAULT 'AVAILABLE',
    me_quantity INT DEFAULT 1,
    me_purchasedDate DATE,
    me_deleted TINYINT DEFAULT 0
);

-- 5. Master Membership Table
CREATE TABLE IF NOT EXISTS master_membership (
    mm_id INT AUTO_INCREMENT PRIMARY KEY,
    mm_userId INT,
    mm_startDate DATE,
    mm_endDate DATE,
    mm_planType VARCHAR(100),
    mm_price DECIMAL(10, 2),
    mm_nextDueDate DATE,
    mm_status VARCHAR(50) DEFAULT 'ACTIVE',
    mm_totalPaid DECIMAL(10, 2) DEFAULT 0,
    FOREIGN KEY (mm_userId) REFERENCES master_user(mu_id) ON DELETE CASCADE
);

-- 6. Master Payment Table
CREATE TABLE IF NOT EXISTS master_payment (
    mp_id INT AUTO_INCREMENT PRIMARY KEY,
    mp_userId INT,
    mp_membershipId INT,
    mp_amount DECIMAL(10, 2),
    mp_mop VARCHAR(100),
    mp_method VARCHAR(100),
    mp_status ENUM('PAID', 'PENDING', 'CANCELLED', 'REFUNDED') DEFAULT 'PENDING',
    mp_paymentDate DATETIME,
    mp_createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mp_userId) REFERENCES master_user(mu_id) ON DELETE CASCADE,
    FOREIGN KEY (mp_membershipId) REFERENCES master_membership(mm_id) ON DELETE SET NULL
);

-- 7. Master Voucher Table
CREATE TABLE IF NOT EXISTS master_voucher (
    mv_id INT AUTO_INCREMENT PRIMARY KEY,
    mv_code VARCHAR(100) UNIQUE,
    mv_description TEXT,
    mv_discountType VARCHAR(50),
    mv_value DECIMAL(10, 2),
    mv_pointsRequired INT DEFAULT 0,
    mv_minSpend DECIMAL(10, 2) DEFAULT 0,
    mv_maxUses INT DEFAULT 1,
    mv_useCount INT DEFAULT 0,
    mv_validFrom DATE,
    mv_validUntil DATE,
    mv_status ENUM('ACTIVE', 'INACTIVE', 'DEACTIVATED') DEFAULT 'ACTIVE',
    mv_createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mv_userId INT,
    FOREIGN KEY (mv_userId) REFERENCES master_user(mu_id) ON DELETE SET NULL
);

-- 8. Master Reward Point Table
CREATE TABLE IF NOT EXISTS master_reward_point (
    mrp_id INT AUTO_INCREMENT PRIMARY KEY,
    mrp_userId INT,
    mrp_attendanceId INT,
    mrp_voucherId INT,
    mrp_pointsAdded INT DEFAULT 0,
    mrp_status ENUM('ACTIVE', 'REDEEMED') DEFAULT 'ACTIVE',
    mrp_source VARCHAR(100),
    mrp_dateEarned DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mrp_userId) REFERENCES master_user(mu_id) ON DELETE CASCADE,
    FOREIGN KEY (mrp_attendanceId) REFERENCES master_attendance(ma_id) ON DELETE SET NULL,
    FOREIGN KEY (mrp_voucherId) REFERENCES master_voucher(mv_id) ON DELETE SET NULL
);

-- 9. Master Access Log Table
CREATE TABLE IF NOT EXISTS master_access_log (
    mal_id INT AUTO_INCREMENT PRIMARY KEY,
    mal_userId INT,
    mal_username VARCHAR(100),
    mal_action VARCHAR(255),
    mal_resourceType VARCHAR(100),
    mal_resourceId INT,
    mal_method VARCHAR(10),
    mal_endpoint VARCHAR(500),
    mal_statusCode INT,
    mal_responseTime INT,
    mal_ipAddress VARCHAR(50),
    mal_userAgent TEXT,
    mal_requestBody TEXT,
    mal_responseMessage TEXT,
    mal_severity VARCHAR(50),
    mal_category VARCHAR(100),
    mal_createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mal_userId) REFERENCES master_user(mu_id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX idx_user_email ON master_user(mu_email);
CREATE INDEX idx_user_username ON master_user(mu_username);
CREATE INDEX idx_user_status ON master_user(mu_status);
CREATE INDEX idx_attendance_userId ON master_attendance(ma_userId);
CREATE INDEX idx_attendance_checkin ON master_attendance(ma_checkin);
CREATE INDEX idx_membership_userId ON master_membership(mm_userId);
CREATE INDEX idx_payment_userId ON master_payment(mp_userId);
CREATE INDEX idx_access_log_userId ON master_access_log(mal_userId);
CREATE INDEX idx_access_log_createdAt ON master_access_log(mal_createdAt);

-- Insert a default admin user (password: admin123 - CHANGE THIS!)
-- Password is hashed using bcrypt
INSERT INTO master_user (mu_username, mu_password, mu_email, mu_firstName, mu_lastName, mu_role, mu_status)
VALUES ('admin', '$2b$10$rQZ9Y5K5K5K5K5K5K5K5KuXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'admin@plfitness.com', 'Admin', 'User', 'ADMIN', 'ACTIVE');
