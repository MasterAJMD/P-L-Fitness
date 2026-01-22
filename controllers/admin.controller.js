const mysql = require('../config/database.js');
const bcryptjs = require('bcryptjs');

class AdminController {
    // GET /admin/ DASHBOARD PAGE
    static getDashboard(req, res) {
        res.render("admin", {title: "Admin"});
    }


    // POST /admin/seed-admin
    static async seedAdmin(req, res) {
        try {
            
            if (process.env.NODE_ENV === 'production') {
                return res.status(403).json({
                    message: "Seed disabled in production"
                });
            }

            const password = await bcryptjs.hash('admin123', 10);

            await mysql.Query(`
                INSERT IGNORE INTO master_user
                    (mu_username,
                    mu_password,
                    mu_firstName,
                    mu_lastName,
                    mu_role,
                    mu_status)
                VALUES (?, ?, 'Admin', 'USER', 'ADMIN', 'ACTIVE')
                `, ["admin", password]);

                res.status(200).json({
                    message: "Admin created: admin/admin123"
                });

        } catch (error) {
            console.error("AdminController.seedAdmin: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // GET /admin/load
    static async loadUsers(req,res) {
        try {
            
            const sql =`
            SELECT
                mu.mu_id,
                mu.mu_email,
                mu.mu_username,
                mu.mu_firstName,
                mu.mu_lastName,
                mu.mu_phoneNumber,
                mu.mu_role,
                mu.mu_specialty,
                mu.mu_status,
                mu.mu_createdAt,
                mu.mu_updatedAt,

                c.mu_firstName AS createdByName,
                u.mu_firstName AS updatedByName,
                d.mu_firstName AS deletedByName

            FROM master_user mu
            LEFT JOIN master_user c ON mu.mu_createdById = c.mu_id
            LEFT JOIN master_user u ON mu.mu_updatedById = u.mu_id
            LEFT JOIN master_user d ON mu.mu_deletedById = d.mu_id
            WHERE mu.mu_status != 'DELETED' -- delete this comment to see DELETED status
            ORDER BY mu.mu_createdAt DESC
            `;

            const result = await mysql.Query(sql);
            res.status(200).json({
                message: "Success",
                data: result
            });

        } catch (error) {
            console.error("AdminController.loadUsers: ", error);
            res.status(500).json({
                message: "Error fetching users",
                data: error
            });
        }
    }


    // POST /admin/insert
    static async createUser(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Admin authentication required (Bearer token)"
                });
            }

            const { email, username, password,
                firstName, lastName, phoneNumber,
                role, specialty, status
            } = req.body;

            // PASSWORD VALIDATION
            if (!password || typeof password !== "string" || password.trim().length < 8) {
                return res.status(400).json({
                    message: "Password required and must be at least 8 characters"
                });
            }

            // PASSWORD HASHING
            const hashedPassword = await bcryptjs.hash(password.trim(), 12)

            // CHECK UNIQUE EMAIL
            const emailSqlExist =`
            SELECT 1 FROM master_user
            WHERE mu_email = ?`;
            let emailSqlResult = await mysql.Query(emailSqlExist, [email]);
            if (emailSqlResult.length > 0) {
                return res.status(409).json({
                    message: "Email already exists"
                });
            }

            // CHECK UNIQUE USERNAME
            const usernameSqlExist =`
            SELECT 1 FROM master_user
            WHERE mu_username = ?`;
            let usernameSqlResult = await mysql.Query(usernameSqlExist, [username]);
            if (usernameSqlResult.length > 0) {
                return res.status(409).json({
                    message: "Username already exist"
                });
            }

            const sql =`
            INSERT INTO master_user
                (mu_email,
                mu_username,
                mu_password,
                mu_firstName,
                mu_lastName,
                mu_phoneNumber,
                mu_role,
                mu_specialty,
                mu_status,
                mu_createdById)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const result = await mysql.Query(sql, [email, username,
                hashedPassword, firstName, lastName, phoneNumber, role,
                specialty, status, req.user.id
            ]);

            res.status(201).json({
                message: "User created successfully",
                userId: result.insertId,
                data: result
            });

        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Duplicated Email or Username",
                    data: error
                });
            }
            console.error("AdminController.createUser: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // PUT /admin/update
    static async updateUser(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Admin authentication required (Bearer token)"
                });
            }

            const { id, email, username, password,
                firstName, lastName, phoneNumber,
                role, specialty, status
             } = req.body;

            // ID VALIDATION
            if (!id || isNaN(id)) {
                return res.status(400).json({
                    message: "Valid ID required"
                });
            }

            // PASSWORD VALIDATION
            let hashedPassword;
            if (password && password.trim().length >= 8) {
                hashedPassword = await bcryptjs.hash(password.trim(), 12);
            } else {
                const user = await mysql.Query(`SELECT mu_password FROM master_user WHERE mu_id = ?`, [id]);
                if (!user.length) return res.status(404).json({ message: "User not found" });
                hashedPassword = user[0].mu_password;
            }

            // CHECK UNIQUE EMAIL
            const emailSqlExist =`
            SELECT 1 FROM master_user
            WHERE mu_email = ?
            AND mu_id != ?`;
            let emailSqlResult = await mysql.Query(emailSqlExist, [email, id]);
            if (emailSqlResult.length > 0) {
                return res.status(409).json({
                    message: "Email already exist"
                });
            }

            // CHECK UNIQUE USERNAME
            const usernameSqlExist =`
            SELECT 1 FROM master_user
            WHERE mu_username = ?
            AND mu_id != ?`;
            let usernameSqlResult = await mysql.Query(usernameSqlExist, [username, id]);
            if (usernameSqlResult.length > 0) {
                return res.status(409).json({
                    message: "Username already exist"
                });
            }

            const sql =`
            UPDATE master_user
            SET
                mu_email = ?,
                mu_username = ?,
                mu_password = ?,
                mu_firstName = ?,
                mu_lastName = ?,
                mu_phoneNumber = ?,
                mu_role = ?,
                mu_specialty = ?,
                mu_status = ?,
                mu_deletedById = NULL,
                mu_updatedById = ?
            WHERE mu_id = ?`;

            const result = await mysql.Query(sql, [email, username, hashedPassword,
                firstName, lastName, phoneNumber, role, specialty, status, req.user.id, id
            ]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "User not found"
                });
            }

            res.status(200).json({
                message: "User updated successfully",
                affectedRows: result.affectedRows,
                data: result
            });

        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Duplicated Email or Username"
                });
            }
            console.error("AdminController.updateUser: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // PUT /admin/delete
    static async deleteUser(req, res) {
        try {

            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Admin authentication required (Bearer token)"
                });
            }

            const { id } = req.body;

            // ID VALIDATION
            if (!id || isNaN(id)) {
                return res.status(400).json({
                    message: "Valid ID required"
                });
            }

            const sql =`
            UPDATE master_user
            SET
                mu_email = CONCAT('DELETED_', mu_id, '@deleted.com'),
                mu_username = CONCAT('DELETED_', mu_id),
                mu_password = 'DELETED',
                mu_firstName = 'DELETED',
                mu_lastName = 'DELETED',
                mu_phoneNumber = 'DELETED',
                mu_role = 'DELETED',
                mu_specialty = 'DELETED',
                mu_status = 'DELETED',
                mu_deletedById = ?,
                mu_deletedAt = NOW()
            WHERE mu_id = ?`;

            const result = await mysql.Query(sql, [req.user.id, id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "User not found"
                });
            }

            res.status(200).json({
                message: "User has been soft deleted",
                affectedRows: result.affectedRows
            });

        } catch (error) {
            console.error("AdminController.deleteUser: ", error);
            res.status(500).json({
                message: "Server Error (500)"
            });
        }
    }


    // PUT /admin/bulk-delete
    static async bulkDeleteUsers(req, res) {
        try {

            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Admin authentication required (Bearer token)"
                });
            }

            const { ids } = req.body;

            // IDS VALIDATION
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({
                    message: "Valid array of IDs required"
                });
            }

            // Validate all IDs are numbers
            if (ids.some(id => isNaN(id))) {
                return res.status(400).json({
                    message: "All IDs must be valid numbers"
                });
            }

            const placeholders = ids.map(() => '?').join(',');
            const sql =`
            UPDATE master_user
            SET
                mu_email = CONCAT('DELETED_', mu_id, '@deleted.com'),
                mu_username = CONCAT('DELETED_', mu_id),
                mu_password = 'DELETED',
                mu_firstName = 'DELETED',
                mu_lastName = 'DELETED',
                mu_phoneNumber = 'DELETED',
                mu_role = 'DELETED',
                mu_specialty = 'DELETED',
                mu_status = 'DELETED',
                mu_deletedById = ?,
                mu_deletedAt = NOW()
            WHERE mu_id IN (${placeholders})`;

            const result = await mysql.Query(sql, [req.user.id, ...ids]);

            res.status(200).json({
                message: `${result.affectedRows} user(s) have been soft deleted`,
                affectedRows: result.affectedRows
            });

        } catch (error) {
            console.error("AdminController.bulkDeleteUsers: ", error);
            res.status(500).json({
                message: "Server Error (500)"
            });
        }
    }


    // PUT /admin/bulk-update
    static async bulkUpdateUsers(req, res) {
        try {

            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Admin authentication required (Bearer token)"
                });
            }

            const { ids, updates } = req.body;

            // IDS VALIDATION
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({
                    message: "Valid array of IDs required"
                });
            }

            // Validate all IDs are numbers
            if (ids.some(id => isNaN(id))) {
                return res.status(400).json({
                    message: "All IDs must be valid numbers"
                });
            }

            // UPDATES VALIDATION
            if (!updates || typeof updates !== 'object') {
                return res.status(400).json({
                    message: "Updates object required"
                });
            }

            // Build dynamic SQL based on provided updates
            const allowedFields = {
                role: 'mu_role',
                status: 'mu_status',
                specialty: 'mu_specialty'
            };

            const updateFields = [];
            const updateValues = [];

            for (const [key, dbField] of Object.entries(allowedFields)) {
                if (updates[key] !== undefined) {
                    updateFields.push(`${dbField} = ?`);
                    updateValues.push(updates[key]);
                }
            }

            if (updateFields.length === 0) {
                return res.status(400).json({
                    message: "No valid update fields provided"
                });
            }

            // Add updatedById
            updateFields.push('mu_updatedById = ?');
            updateValues.push(req.user.id);

            const placeholders = ids.map(() => '?').join(',');
            const sql = `
            UPDATE master_user
            SET ${updateFields.join(', ')}
            WHERE mu_id IN (${placeholders})`;

            const result = await mysql.Query(sql, [...updateValues, ...ids]);

            res.status(200).json({
                message: `${result.affectedRows} user(s) have been updated`,
                affectedRows: result.affectedRows
            });

        } catch (error) {
            console.error("AdminController.bulkUpdateUsers: ", error);
            res.status(500).json({
                message: "Server Error (500)"
            });
        }
    }


    // POST /admin/send-email
    static async sendEmail(req, res) {
        try {

            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Admin authentication required (Bearer token)"
                });
            }

            const { userIds, subject, message } = req.body;

            // VALIDATION
            if (!Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({
                    message: "Valid array of user IDs required"
                });
            }

            if (!subject || !message) {
                return res.status(400).json({
                    message: "Subject and message are required"
                });
            }

            // Get user emails
            const placeholders = userIds.map(() => '?').join(',');
            const users = await mysql.Query(
                `SELECT mu_email, mu_firstName FROM master_user WHERE mu_id IN (${placeholders})`,
                userIds
            );

            if (users.length === 0) {
                return res.status(404).json({
                    message: "No users found with provided IDs"
                });
            }

            // In a production environment, you would integrate with an email service here
            // For now, we'll just log the email details
            console.log(`Email would be sent to ${users.length} users:`);
            console.log(`Subject: ${subject}`);
            console.log(`Message: ${message}`);
            console.log(`Recipients:`, users.map(u => u.mu_email));

            // TODO: Integrate with email service (e.g., SendGrid, Nodemailer, etc.)
            // Example with Nodemailer:
            // const transporter = nodemailer.createTransport({ ... });
            // await transporter.sendMail({ ... });

            res.status(200).json({
                message: `Email prepared for ${users.length} user(s)`,
                recipients: users.length,
                note: "Email service integration required for actual sending"
            });

        } catch (error) {
            console.error("AdminController.sendEmail: ", error);
            res.status(500).json({
                message: "Server Error (500)"
            });
        }
    }


    // POST /admin/import-csv
    static async importUsersFromCSV(req, res) {
        try {

            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Admin authentication required (Bearer token)"
                });
            }

            const { users } = req.body;

            // VALIDATION
            if (!Array.isArray(users) || users.length === 0) {
                return res.status(400).json({
                    message: "Valid array of users required"
                });
            }

            let successCount = 0;
            let errorCount = 0;
            const errors = [];

            for (let i = 0; i < users.length; i++) {
                const user = users[i];

                try {
                    // Validate required fields
                    if (!user.username || !user.password || !user.email ||
                        !user.firstName || !user.lastName || !user.phoneNumber) {
                        errors.push({ row: i + 1, error: "Missing required fields" });
                        errorCount++;
                        continue;
                    }

                    // PASSWORD HASHING
                    const hashedPassword = await bcryptjs.hash(user.password.trim(), 12);

                    // Check if username or email already exists
                    const existingUser = await mysql.Query(
                        `SELECT 1 FROM master_user WHERE mu_username = ? OR mu_email = ?`,
                        [user.username, user.email]
                    );

                    if (existingUser.length > 0) {
                        errors.push({ row: i + 1, error: "Username or email already exists" });
                        errorCount++;
                        continue;
                    }

                    // Insert user
                    const sql = `
                    INSERT INTO master_user
                        (mu_email, mu_username, mu_password, mu_firstName, mu_lastName,
                        mu_phoneNumber, mu_role, mu_specialty, mu_status, mu_createdById)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

                    await mysql.Query(sql, [
                        user.email,
                        user.username,
                        hashedPassword,
                        user.firstName,
                        user.lastName,
                        user.phoneNumber,
                        user.role || 'MEMBER',
                        user.specialty || '',
                        user.status || 'ACTIVE',
                        req.user.id
                    ]);

                    successCount++;
                } catch (err) {
                    errors.push({ row: i + 1, error: err.message });
                    errorCount++;
                }
            }

            res.status(200).json({
                message: `Import completed: ${successCount} success, ${errorCount} failed`,
                successCount,
                errorCount,
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            console.error("AdminController.importUsersFromCSV: ", error);
            res.status(500).json({
                message: "Server Error (500)"
            });
        }
    }


    // GET /admin/dashboard-analytics
    static async getDashboardAnalytics(req, res) {
        try {

            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Admin authentication required (Bearer token)"
                });
            }

            // Get total members count and growth
            // Note: TiDB converts column names to lowercase, so we use lowercase here
            const totalMembersResult = await mysql.Query(`
                SELECT COUNT(*) as total,
                COALESCE(SUM(CASE WHEN mu_createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END), 0) as newThisMonth
                FROM master_user
                WHERE mu_status != 'DELETED'
            `);

            // Get active members today (safe query)
            let activeTodayResult = [{ activeToday: 0 }];
            try {
                activeTodayResult = await mysql.Query(`
                    SELECT COUNT(DISTINCT ma_userId) as activeToday
                    FROM master_attendance
                    WHERE DATE(ma_checkInTime) = CURDATE()
                `);
            } catch (err) {
                console.log("Attendance table may not exist:", err.message);
            }

            // Get revenue stats (safe query)
            let revenueResult = [{ monthlyRevenue: 0, lastMonthRevenue: 0 }];
            try {
                revenueResult = await mysql.Query(`
                    SELECT
                        COALESCE(SUM(CASE WHEN MONTH(mp_createdAt) = MONTH(NOW()) THEN mp_amount ELSE 0 END), 0) as monthlyRevenue,
                        COALESCE(SUM(CASE WHEN MONTH(mp_createdAt) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH)) THEN mp_amount ELSE 0 END), 0) as lastMonthRevenue
                    FROM master_payment
                    WHERE mp_status = 'PAID'
                    AND YEAR(mp_createdAt) = YEAR(NOW())
                `);
            } catch (err) {
                console.log("Payment table may not exist:", err.message);
            }

            // Get sessions/classes stats (safe query)
            let sessionsResult = [{ totalSessions: 0, activeSessions: 0 }];
            try {
                sessionsResult = await mysql.Query(`
                    SELECT
                        COUNT(*) as totalSessions,
                        COALESCE(SUM(CASE WHEN ms_status = 'ACTIVE' THEN 1 ELSE 0 END), 0) as activeSessions
                    FROM master_session
                `);
            } catch (err) {
                console.log("Session table may not exist:", err.message);
            }

            // Get status breakdown
            const statusBreakdown = await mysql.Query(`
                SELECT
                    mu_status as status,
                    COUNT(*) as count
                FROM master_user
                WHERE mu_status != 'DELETED'
                GROUP BY mu_status
            `);

            // Get role breakdown
            const roleBreakdown = await mysql.Query(`
                SELECT
                    mu_role as role,
                    COUNT(*) as count
                FROM master_user
                WHERE mu_status != 'DELETED'
                GROUP BY mu_role
            `);

            // Get monthly revenue trend (safe query)
            let revenueTrend = [];
            try {
                revenueTrend = await mysql.Query(`
                    SELECT
                        DATE_FORMAT(mp_createdAt, '%b') as month,
                        COALESCE(SUM(mp_amount), 0) as revenue,
                        COUNT(DISTINCT mp_userId) as members
                    FROM master_payment
                    WHERE mp_status = 'PAID'
                    AND mp_createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                    GROUP BY YEAR(mp_createdAt), MONTH(mp_createdAt)
                    ORDER BY YEAR(mp_createdAt), MONTH(mp_createdAt)
                `);
            } catch (err) {
                console.log("Payment table may not exist for revenue trend:", err.message);
            }

            // Get weekly attendance (safe query)
            let weeklyAttendance = [];
            try {
                weeklyAttendance = await mysql.Query(`
                    SELECT
                        DATE_FORMAT(ma_checkInTime, '%a') as day,
                        COUNT(*) as attendance
                    FROM master_attendance
                    WHERE ma_checkInTime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                    GROUP BY DATE(ma_checkInTime), DATE_FORMAT(ma_checkInTime, '%a')
                    ORDER BY DATE(ma_checkInTime)
                `);
            } catch (err) {
                console.log("Attendance table may not exist for weekly data:", err.message);
            }

            // Get recent activity
            const recentActivity = await mysql.Query(`
                SELECT
                    mu_id as id,
                    CONCAT(mu_firstName, ' ', mu_lastName) as name,
                    mu_email as email,
                    mu_createdAt as createdAt,
                    mu_role as role,
                    'USER_CREATED' as activityType
                FROM master_user
                WHERE mu_status != 'DELETED'
                ORDER BY mu_createdAt DESC
                LIMIT 10
            `);

            // Calculate growth percentages
            const totalMembers = totalMembersResult[0].total || 0;
            const newThisMonth = totalMembersResult[0].newThisMonth || 0;
            const memberGrowth = totalMembers > 0 ? ((newThisMonth / totalMembers) * 100).toFixed(1) : 0;

            const monthlyRevenue = parseFloat(revenueResult[0].monthlyRevenue) || 0;
            const lastMonthRevenue = parseFloat(revenueResult[0].lastMonthRevenue) || 0;
            const revenueGrowth = lastMonthRevenue > 0
                ? (((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
                : 0;

            res.status(200).json({
                message: "Dashboard analytics loaded successfully",
                data: {
                    overview: {
                        totalMembers,
                        newThisMonth,
                        memberGrowth: parseFloat(memberGrowth),
                        monthlyRevenue,
                        revenueGrowth: parseFloat(revenueGrowth),
                        activeToday: activeTodayResult[0].activeToday || 0,
                        totalSessions: sessionsResult[0].totalSessions || 0,
                        activeSessions: sessionsResult[0].activeSessions || 0
                    },
                    statusBreakdown: statusBreakdown || [],
                    roleBreakdown: roleBreakdown || [],
                    revenueTrend: revenueTrend || [],
                    weeklyAttendance: weeklyAttendance || [],
                    recentActivity: recentActivity || []
                }
            });

        } catch (error) {
            console.error("AdminController.getDashboardAnalytics Error: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                error: error.message
            });
        }
    }


    // GET /admin/advanced-analytics
    static async getAdvancedAnalytics(req, res) {
        try {

            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Admin authentication required (Bearer token)"
                });
            }

            // Member Acquisition & Growth Metrics
            const memberGrowthData = await mysql.Query(`
                SELECT
                    DATE_FORMAT(mu_createdAt, '%Y-%m') as month,
                    COUNT(*) as newMembers,
                    SUM(COUNT(*)) OVER (ORDER BY DATE_FORMAT(mu_createdAt, '%Y-%m')) as cumulativeMembers
                FROM master_user
                WHERE mu_status != 'DELETED'
                AND mu_createdAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
                GROUP BY DATE_FORMAT(mu_createdAt, '%Y-%m')
                ORDER BY month
            `);

            // Churn Analysis
            let churnData = [];
            try {
                churnData = await mysql.Query(`
                    SELECT
                        DATE_FORMAT(mu_updatedAt, '%Y-%m') as month,
                        COUNT(*) as churnedMembers,
                        mu_status as status
                    FROM master_user
                    WHERE mu_status IN ('INACTIVE', 'SUSPENDED')
                    AND mu_updatedAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
                    GROUP BY DATE_FORMAT(mu_updatedAt, '%Y-%m'), mu_status
                    ORDER BY month
                `);
            } catch (err) {
                console.log("Churn data query error:", err.message);
            }

            // Revenue Forecasting (12 months trend + 3 months projection)
            let revenueForecast = [];
            try {
                const historicalRevenue = await mysql.Query(`
                    SELECT
                        DATE_FORMAT(mp_createdAt, '%Y-%m') as month,
                        COALESCE(SUM(mp_amount), 0) as revenue,
                        COUNT(DISTINCT mp_userId) as payingMembers,
                        COALESCE(AVG(mp_amount), 0) as avgTransactionValue
                    FROM master_payment
                    WHERE mp_status = 'PAID'
                    AND mp_createdAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
                    GROUP BY DATE_FORMAT(mp_createdAt, '%Y-%m')
                    ORDER BY month
                `);

                // Calculate simple linear regression for forecasting
                if (historicalRevenue.length >= 3) {
                    const revenues = historicalRevenue.map(r => parseFloat(r.revenue));
                    const avgGrowth = revenues.length > 1
                        ? revenues.slice(-3).reduce((acc, val, idx, arr) => {
                            if (idx === 0) return 0;
                            return acc + ((val - arr[idx - 1]) / arr[idx - 1]);
                        }, 0) / 2
                        : 0;

                    const lastRevenue = revenues[revenues.length - 1];
                    revenueForecast = historicalRevenue.map(r => ({ ...r, type: 'actual' }));

                    // Add 3 months forecast
                    for (let i = 1; i <= 3; i++) {
                        const forecastDate = new Date();
                        forecastDate.setMonth(forecastDate.getMonth() + i);
                        const forecastMonth = forecastDate.toISOString().slice(0, 7);
                        const forecastRevenue = lastRevenue * Math.pow(1 + avgGrowth, i);

                        revenueForecast.push({
                            month: forecastMonth,
                            revenue: Math.round(forecastRevenue),
                            payingMembers: 0,
                            avgTransactionValue: 0,
                            type: 'forecast'
                        });
                    }
                } else {
                    revenueForecast = historicalRevenue.map(r => ({ ...r, type: 'actual' }));
                }
            } catch (err) {
                console.log("Revenue forecast error:", err.message);
            }

            // Cohort Analysis - Retention by signup month
            let cohortAnalysis = [];
            try {
                cohortAnalysis = await mysql.Query(`
                    SELECT
                        DATE_FORMAT(u.mu_createdAt, '%Y-%m') as cohort,
                        COUNT(DISTINCT u.mu_id) as cohortSize,
                        COUNT(DISTINCT CASE WHEN a.ma_checkInTime >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN u.mu_id END) as activeNow,
                        ROUND(COUNT(DISTINCT CASE WHEN a.ma_checkInTime >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN u.mu_id END) * 100.0 / COUNT(DISTINCT u.mu_id), 2) as retentionRate
                    FROM master_user u
                    LEFT JOIN master_attendance a ON u.mu_id = a.ma_userId
                    WHERE u.mu_status != 'DELETED'
                    AND u.mu_createdAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
                    GROUP BY DATE_FORMAT(u.mu_createdAt, '%Y-%m')
                    ORDER BY cohort DESC
                    LIMIT 12
                `);
            } catch (err) {
                console.log("Cohort analysis error:", err.message);
            }

            // Attendance Patterns & Peak Hours
            let attendancePatterns = [];
            try {
                attendancePatterns = await mysql.Query(`
                    SELECT
                        HOUR(ma_checkInTime) as hour,
                        DATE_FORMAT(ma_checkInTime, '%a') as dayOfWeek,
                        COUNT(*) as checkIns,
                        COUNT(DISTINCT ma_userId) as uniqueMembers
                    FROM master_attendance
                    WHERE ma_checkInTime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    GROUP BY HOUR(ma_checkInTime), DATE_FORMAT(ma_checkInTime, '%a')
                    ORDER BY dayOfWeek, hour
                `);
            } catch (err) {
                console.log("Attendance patterns error:", err.message);
            }

            // Member Lifetime Value (LTV)
            let memberLTV = [];
            try {
                memberLTV = await mysql.Query(`
                    SELECT
                        u.mu_role as memberType,
                        COUNT(DISTINCT u.mu_id) as totalMembers,
                        COALESCE(AVG(revenue.totalSpent), 0) as avgLifetimeValue,
                        COALESCE(AVG(DATEDIFF(NOW(), u.mu_createdAt)), 0) as avgMembershipDays,
                        COALESCE(AVG(attendance.totalVisits), 0) as avgVisits
                    FROM master_user u
                    LEFT JOIN (
                        SELECT mp_userId, SUM(mp_amount) as totalSpent
                        FROM master_payment
                        WHERE mp_status = 'PAID'
                        GROUP BY mp_userId
                    ) revenue ON u.mu_id = revenue.mp_userId
                    LEFT JOIN (
                        SELECT ma_userId, COUNT(*) as totalVisits
                        FROM master_attendance
                        GROUP BY ma_userId
                    ) attendance ON u.mu_id = attendance.ma_userId
                    WHERE u.mu_status != 'DELETED'
                    GROUP BY u.mu_role
                `);
            } catch (err) {
                console.log("Member LTV error:", err.message);
            }

            // Payment Method Distribution
            let paymentMethods = [];
            try {
                paymentMethods = await mysql.Query(`
                    SELECT
                        mp_method as method,
                        COUNT(*) as transactionCount,
                        COALESCE(SUM(mp_amount), 0) as totalAmount,
                        COALESCE(AVG(mp_amount), 0) as avgAmount
                    FROM master_payment
                    WHERE mp_status = 'PAID'
                    AND mp_createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                    GROUP BY mp_method
                `);
            } catch (err) {
                console.log("Payment methods error:", err.message);
            }

            // Session Popularity & Utilization
            let sessionAnalytics = [];
            try {
                sessionAnalytics = await mysql.Query(`
                    SELECT
                        ms_name as sessionName,
                        ms_type as sessionType,
                        ms_capacity as capacity,
                        COUNT(a.ma_id) as totalAttendance,
                        COUNT(DISTINCT a.ma_userId) as uniqueAttendees,
                        ROUND(COUNT(a.ma_id) * 100.0 / NULLIF(ms_capacity, 0), 2) as utilizationRate
                    FROM master_session s
                    LEFT JOIN master_attendance a ON s.ms_id = a.ma_sessionId
                        AND a.ma_checkInTime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    WHERE s.ms_status = 'ACTIVE'
                    GROUP BY s.ms_id, ms_name, ms_type, ms_capacity
                    ORDER BY totalAttendance DESC
                `);
            } catch (err) {
                console.log("Session analytics error:", err.message);
            }

            // Member Engagement Score
            let memberEngagement = [];
            try {
                memberEngagement = await mysql.Query(`
                    SELECT
                        u.mu_id as memberId,
                        CONCAT(u.mu_firstName, ' ', u.mu_lastName) as memberName,
                        u.mu_email as email,
                        COALESCE(visitCount.visits, 0) as totalVisits,
                        COALESCE(paymentCount.payments, 0) as totalPayments,
                        COALESCE(revenueSum.revenue, 0) as totalRevenue,
                        DATEDIFF(NOW(), MAX(a.ma_checkInTime)) as daysSinceLastVisit,
                        CASE
                            WHEN COALESCE(visitCount.visits, 0) >= 20 THEN 'High'
                            WHEN COALESCE(visitCount.visits, 0) >= 10 THEN 'Medium'
                            ELSE 'Low'
                        END as engagementLevel
                    FROM master_user u
                    LEFT JOIN master_attendance a ON u.mu_id = a.ma_userId
                    LEFT JOIN (
                        SELECT ma_userId, COUNT(*) as visits
                        FROM master_attendance
                        WHERE ma_checkInTime >= DATE_SUB(NOW(), INTERVAL 90 DAY)
                        GROUP BY ma_userId
                    ) visitCount ON u.mu_id = visitCount.ma_userId
                    LEFT JOIN (
                        SELECT mp_userId, COUNT(*) as payments
                        FROM master_payment
                        WHERE mp_status = 'PAID'
                        GROUP BY mp_userId
                    ) paymentCount ON u.mu_id = paymentCount.mp_userId
                    LEFT JOIN (
                        SELECT mp_userId, SUM(mp_amount) as revenue
                        FROM master_payment
                        WHERE mp_status = 'PAID'
                        GROUP BY mp_userId
                    ) revenueSum ON u.mu_id = revenueSum.mp_userId
                    WHERE u.mu_status = 'ACTIVE'
                    GROUP BY u.mu_id, u.mu_firstName, u.mu_lastName, u.mu_email,
                             visitCount.visits, paymentCount.payments, revenueSum.revenue
                    ORDER BY totalVisits DESC, totalRevenue DESC
                    LIMIT 50
                `);
            } catch (err) {
                console.log("Member engagement error:", err.message);
            }

            // Calculate key metrics
            const totalActive = await mysql.Query(`
                SELECT COUNT(*) as count FROM master_user WHERE mu_status = 'ACTIVE'
            `);

            res.status(200).json({
                message: "Advanced analytics loaded successfully",
                data: {
                    memberGrowth: memberGrowthData || [],
                    churnAnalysis: churnData || [],
                    revenueForecast: revenueForecast || [],
                    cohortAnalysis: cohortAnalysis || [],
                    attendancePatterns: attendancePatterns || [],
                    memberLTV: memberLTV || [],
                    paymentMethods: paymentMethods || [],
                    sessionAnalytics: sessionAnalytics || [],
                    memberEngagement: memberEngagement || [],
                    summary: {
                        totalActiveMembers: totalActive[0]?.count || 0,
                        avgRetentionRate: cohortAnalysis.length > 0
                            ? (cohortAnalysis.reduce((acc, c) => acc + parseFloat(c.retentionRate || 0), 0) / cohortAnalysis.length).toFixed(2)
                            : 0,
                        avgMemberLTV: memberLTV.length > 0
                            ? (memberLTV.reduce((acc, m) => acc + parseFloat(m.avgLifetimeValue || 0), 0) / memberLTV.length).toFixed(2)
                            : 0
                    }
                }
            });

        } catch (error) {
            console.error("AdminController.getAdvancedAnalytics Error: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                error: error.message
            });
        }
    }
}

module.exports = AdminController;