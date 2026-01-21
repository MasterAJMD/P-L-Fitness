const mysql = require('../config/database.js');

class AccessLogController {
    // GET /access-logs/load - Get access logs with filtering and pagination
    static async loadAccessLogs(req, res) {
        try {
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Admin authentication required (Bearer token)"
                });
            }

            // Check if table exists
            try {
                await mysql.Query(`SELECT 1 FROM master_access_log LIMIT 1`);
            } catch (err) {
                // Table doesn't exist
                return res.status(200).json({
                    message: "Access logs table not initialized. Run: node scripts/init-access-logs.js",
                    data: {
                        logs: [],
                        pagination: {
                            page: 1,
                            limit: 50,
                            total: 0,
                            totalPages: 0
                        },
                        tableNotInitialized: true
                    }
                });
            }

            const {
                page = 1,
                limit = 50,
                category = 'all',
                severity = 'all',
                action = 'all',
                userId = null,
                startDate = null,
                endDate = null,
                search = ''
            } = req.query;

            const offset = (page - 1) * limit;

            // Build WHERE clause
            let whereConditions = [];
            let params = [];

            if (category !== 'all') {
                whereConditions.push('mal_category = ?');
                params.push(category);
            }

            if (severity !== 'all') {
                whereConditions.push('mal_severity = ?');
                params.push(severity);
            }

            if (action !== 'all') {
                whereConditions.push('mal_action = ?');
                params.push(action);
            }

            if (userId) {
                whereConditions.push('mal_userid = ?');
                params.push(userId);
            }

            if (startDate) {
                whereConditions.push('mal_createdat >= ?');
                params.push(startDate);
            }

            if (endDate) {
                whereConditions.push('mal_createdat <= ?');
                params.push(endDate);
            }

            if (search) {
                whereConditions.push('(mal_username LIKE ? OR mal_endpoint LIKE ? OR mal_responsemessage LIKE ?)');
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern, searchPattern);
            }

            const whereClause = whereConditions.length > 0
                ? 'WHERE ' + whereConditions.join(' AND ')
                : '';

            // Get total count
            const countSql = `
                SELECT COUNT(*) as total
                FROM master_access_log
                ${whereClause}
            `;
            const countResult = await mysql.Query(countSql, params);
            const total = countResult[0].total;

            // Get logs with pagination
            const sql = `
                SELECT
                    mal_id as id,
                    mal_userid as userId,
                    mal_username as username,
                    mal_action as action,
                    mal_resourcetype as resourceType,
                    mal_resourceid as resourceId,
                    mal_method as method,
                    mal_endpoint as endpoint,
                    mal_statuscode as statusCode,
                    mal_responsetime as responseTime,
                    mal_ipaddress as ipAddress,
                    mal_useragent as userAgent,
                    mal_requestbody as requestBody,
                    mal_responsemessage as responseMessage,
                    mal_severity as severity,
                    mal_category as category,
                    mal_createdat as createdAt
                FROM master_access_log
                ${whereClause}
                ORDER BY mal_createdat DESC
                LIMIT ? OFFSET ?
            `;

            const logs = await mysql.Query(sql, [...params, parseInt(limit), offset]);

            res.status(200).json({
                message: "Access logs loaded successfully",
                data: {
                    logs,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        totalPages: Math.ceil(total / limit)
                    }
                }
            });

        } catch (error) {
            console.error("AccessLogController.loadAccessLogs: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                error: error.message
            });
        }
    }

    // GET /access-logs/analytics - Get access log analytics and statistics
    static async getAnalytics(req, res) {
        try {
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Admin authentication required (Bearer token)"
                });
            }

            // Check if table exists
            try {
                await mysql.Query(`SELECT 1 FROM master_access_log LIMIT 1`);
            } catch (err) {
                // Table doesn't exist, return empty analytics
                return res.status(200).json({
                    message: "Access logs table not initialized",
                    data: {
                        summary: { totalRequests: 0, period: '24h' },
                        statusBreakdown: [],
                        categoryBreakdown: [],
                        severityBreakdown: [],
                        topUsers: [],
                        topActions: [],
                        responseTimeTrend: [],
                        errorRateTrend: [],
                        recentErrors: [],
                        peakHours: [],
                        topEndpoints: [],
                        tableNotInitialized: true
                    }
                });
            }

            const { period = '24h' } = req.query;

            // Determine time range
            let timeCondition = '';
            switch (period) {
                case '1h':
                    timeCondition = 'mal_createdat >= DATE_SUB(NOW(), INTERVAL 1 HOUR)';
                    break;
                case '24h':
                    timeCondition = 'mal_createdat >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
                    break;
                case '7d':
                    timeCondition = 'mal_createdat >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
                    break;
                case '30d':
                    timeCondition = 'mal_createdat >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
                    break;
                default:
                    timeCondition = 'mal_createdat >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
            }

            // Total requests
            const totalRequests = await mysql.Query(`
                SELECT COUNT(*) as total
                FROM master_access_log
                WHERE ${timeCondition}
            `);

            // Requests by status code category
            const statusBreakdown = await mysql.Query(`
                SELECT
                    CASE
                        WHEN mal_statuscode >= 500 THEN '5xx Server Errors'
                        WHEN mal_statuscode >= 400 THEN '4xx Client Errors'
                        WHEN mal_statuscode >= 300 THEN '3xx Redirects'
                        WHEN mal_statuscode >= 200 THEN '2xx Success'
                        ELSE 'Other'
                    END as statusCategory,
                    COUNT(*) as count
                FROM master_access_log
                WHERE ${timeCondition}
                GROUP BY statusCategory
            `);

            // Requests by category
            const categoryBreakdown = await mysql.Query(`
                SELECT
                    mal_category as category,
                    COUNT(*) as count
                FROM master_access_log
                WHERE ${timeCondition}
                GROUP BY mal_category
                ORDER BY count DESC
            `);

            // Requests by severity
            const severityBreakdown = await mysql.Query(`
                SELECT
                    mal_severity as severity,
                    COUNT(*) as count
                FROM master_access_log
                WHERE ${timeCondition}
                GROUP BY mal_severity
            `);

            // Top users by activity
            const topUsers = await mysql.Query(`
                SELECT
                    mal_userid as userId,
                    mal_username as username,
                    COUNT(*) as requestCount,
                    AVG(mal_responsetime) as avgResponseTime
                FROM master_access_log
                WHERE ${timeCondition}
                AND mal_userid IS NOT NULL
                GROUP BY mal_userid, mal_username
                ORDER BY requestCount DESC
                LIMIT 10
            `);

            // Top actions
            const topActions = await mysql.Query(`
                SELECT
                    mal_action as action,
                    COUNT(*) as count
                FROM master_access_log
                WHERE ${timeCondition}
                GROUP BY mal_action
                ORDER BY count DESC
                LIMIT 10
            `);

            // Average response time trend
            const responseTimeTrend = await mysql.Query(`
                SELECT
                    DATE_FORMAT(mal_createdat, '%Y-%m-%d %H:00:00') as hour,
                    AVG(mal_responsetime) as avgResponseTime,
                    MAX(mal_responsetime) as maxResponseTime,
                    MIN(mal_responsetime) as minResponseTime,
                    COUNT(*) as requestCount
                FROM master_access_log
                WHERE ${timeCondition}
                GROUP BY DATE_FORMAT(mal_createdat, '%Y-%m-%d %H:00:00')
                ORDER BY hour
            `);

            // Error rate over time
            const errorRateTrend = await mysql.Query(`
                SELECT
                    DATE_FORMAT(mal_createdat, '%Y-%m-%d %H:00:00') as hour,
                    COUNT(*) as totalRequests,
                    SUM(CASE WHEN mal_statuscode >= 400 THEN 1 ELSE 0 END) as errorCount,
                    ROUND(SUM(CASE WHEN mal_statuscode >= 400 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as errorRate
                FROM master_access_log
                WHERE ${timeCondition}
                GROUP BY DATE_FORMAT(mal_createdat, '%Y-%m-%d %H:00:00')
                ORDER BY hour
            `);

            // Recent errors
            const recentErrors = await mysql.Query(`
                SELECT
                    mal_id as id,
                    mal_username as username,
                    mal_action as action,
                    mal_endpoint as endpoint,
                    mal_statuscode as statusCode,
                    mal_responsemessage as message,
                    mal_severity as severity,
                    mal_createdat as createdAt
                FROM master_access_log
                WHERE ${timeCondition}
                AND mal_statuscode >= 400
                ORDER BY mal_createdat DESC
                LIMIT 20
            `);

            // Peak hour analysis
            const peakHours = await mysql.Query(`
                SELECT
                    HOUR(mal_createdat) as hour,
                    COUNT(*) as requestCount,
                    AVG(mal_responsetime) as avgResponseTime
                FROM master_access_log
                WHERE ${timeCondition}
                GROUP BY HOUR(mal_createdat)
                ORDER BY hour
            `);

            // Most accessed endpoints
            const topEndpoints = await mysql.Query(`
                SELECT
                    mal_endpoint as endpoint,
                    mal_method as method,
                    COUNT(*) as count,
                    AVG(mal_responsetime) as avgResponseTime
                FROM master_access_log
                WHERE ${timeCondition}
                GROUP BY mal_endpoint, mal_method
                ORDER BY count DESC
                LIMIT 15
            `);

            res.status(200).json({
                message: "Access log analytics loaded successfully",
                data: {
                    summary: {
                        totalRequests: totalRequests[0].total,
                        period: period
                    },
                    statusBreakdown,
                    categoryBreakdown,
                    severityBreakdown,
                    topUsers,
                    topActions,
                    responseTimeTrend,
                    errorRateTrend,
                    recentErrors,
                    peakHours,
                    topEndpoints
                }
            });

        } catch (error) {
            console.error("AccessLogController.getAnalytics: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                error: error.message
            });
        }
    }

    // GET /access-logs/user-activity/:userId - Get specific user's activity log
    static async getUserActivity(req, res) {
        try {
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Admin authentication required (Bearer token)"
                });
            }

            const { userId } = req.params;
            const { limit = 50 } = req.query;

            const sql = `
                SELECT
                    mal_id as id,
                    mal_action as action,
                    mal_resourcetype as resourceType,
                    mal_endpoint as endpoint,
                    mal_statuscode as statusCode,
                    mal_responsetime as responseTime,
                    mal_ipaddress as ipAddress,
                    mal_category as category,
                    mal_createdat as createdAt
                FROM master_access_log
                WHERE mal_userid = ?
                ORDER BY mal_createdat DESC
                LIMIT ?
            `;

            const activity = await mysql.Query(sql, [userId, parseInt(limit)]);

            res.status(200).json({
                message: "User activity loaded successfully",
                data: activity
            });

        } catch (error) {
            console.error("AccessLogController.getUserActivity: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                error: error.message
            });
        }
    }

    // DELETE /access-logs/cleanup - Clean up old logs (admin only)
    static async cleanupOldLogs(req, res) {
        try {
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Admin authentication required (Bearer token)"
                });
            }

            const { days = 90 } = req.body;

            const sql = `
                DELETE FROM master_access_log
                WHERE mal_createdat < DATE_SUB(NOW(), INTERVAL ? DAY)
            `;

            const result = await mysql.Query(sql, [days]);

            res.status(200).json({
                message: `Deleted ${result.affectedRows} log entries older than ${days} days`,
                deletedCount: result.affectedRows
            });

        } catch (error) {
            console.error("AccessLogController.cleanupOldLogs: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                error: error.message
            });
        }
    }
}

module.exports = AccessLogController;
