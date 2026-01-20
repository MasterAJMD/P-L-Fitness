const mysql = require('../config/database');

/**
 * Access Logging Middleware
 * Logs all API requests to master_access_log table
 * Captures request details, response status, timing, and user information
 */

const accessLogger = async (req, res, next) => {
    const startTime = Date.now();

    // Store original methods
    const originalSend = res.send;
    const originalJson = res.json;

    // Capture response data
    let responseBody = null;
    let statusCode = null;

    // Override res.send
    res.send = function(data) {
        responseBody = data;
        statusCode = res.statusCode;
        res.send = originalSend;
        return originalSend.call(this, data);
    };

    // Override res.json
    res.json = function(data) {
        responseBody = data;
        statusCode = res.statusCode;
        res.json = originalJson;
        return originalJson.call(this, data);
    };

    // Wait for response to finish
    res.on('finish', async () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        try {
            // Extract user info from JWT token if available
            const userId = req.user?.id || null;
            const username = req.user?.username || null;

            // Get IP address
            const ipAddress = req.ip ||
                            req.headers['x-forwarded-for'] ||
                            req.connection.remoteAddress ||
                            null;

            // Get user agent
            const userAgent = req.headers['user-agent'] || null;

            // Determine action and category from endpoint
            const endpoint = req.originalUrl || req.url;
            const method = req.method;
            const { action, resourceType, resourceId, category } = parseEndpoint(endpoint, method);

            // Determine severity based on status code
            const severity = getSeverity(statusCode);

            // Get response message if available
            let responseMessage = null;
            if (responseBody) {
                try {
                    const parsedBody = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
                    responseMessage = parsedBody.message || parsedBody.error || null;
                } catch (err) {
                    responseMessage = null;
                }
            }

            // Sanitize request body (remove passwords)
            let requestBody = null;
            if (req.body && Object.keys(req.body).length > 0) {
                const sanitized = { ...req.body };
                if (sanitized.password) sanitized.password = '[REDACTED]';
                requestBody = JSON.stringify(sanitized);
            }

            // Insert log entry
            const sql = `
                INSERT INTO master_access_log (
                    mal_userId,
                    mal_username,
                    mal_action,
                    mal_resourceType,
                    mal_resourceId,
                    mal_method,
                    mal_endpoint,
                    mal_statusCode,
                    mal_responseTime,
                    mal_ipAddress,
                    mal_userAgent,
                    mal_requestBody,
                    mal_responseMessage,
                    mal_severity,
                    mal_category
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await mysql.Query(sql, [
                userId,
                username,
                action,
                resourceType,
                resourceId,
                method,
                endpoint,
                statusCode || res.statusCode,
                responseTime,
                ipAddress,
                userAgent,
                requestBody,
                responseMessage,
                severity,
                category
            ]);
        } catch (error) {
            // Log error but don't break the request flow
            console.error('Access logging error:', error.message);
        }
    });

    next();
};

/**
 * Parse endpoint to extract action, resource type, and category
 */
function parseEndpoint(endpoint, method) {
    let action = method.toUpperCase();
    let resourceType = 'UNKNOWN';
    let resourceId = null;
    let category = 'SYSTEM';

    // Extract resource ID if present
    const idMatch = endpoint.match(/\/(\d+)(?:\/|$)/);
    if (idMatch) {
        resourceId = parseInt(idMatch[1]);
    }

    // Determine action and category from endpoint
    if (endpoint.includes('/auth/login')) {
        action = 'LOGIN';
        resourceType = 'AUTH';
        category = 'AUTH';
    } else if (endpoint.includes('/auth/register')) {
        action = 'REGISTER';
        resourceType = 'AUTH';
        category = 'AUTH';
    } else if (endpoint.includes('/auth/logout')) {
        action = 'LOGOUT';
        resourceType = 'AUTH';
        category = 'AUTH';
    } else if (endpoint.includes('/users')) {
        resourceType = 'USER';
        category = 'USER';
        if (method === 'GET') action = 'VIEW_USER';
        else if (method === 'PUT') action = 'UPDATE_USER';
        else if (method === 'POST') action = 'CREATE_USER';
        else if (method === 'DELETE') action = 'DELETE_USER';
    } else if (endpoint.includes('/admin')) {
        category = 'ADMIN';
        if (endpoint.includes('/bulk-delete')) {
            action = 'BULK_DELETE_USERS';
            resourceType = 'USER';
        } else if (endpoint.includes('/bulk-update')) {
            action = 'BULK_UPDATE_USERS';
            resourceType = 'USER';
        } else if (endpoint.includes('/send-email')) {
            action = 'SEND_EMAIL';
            resourceType = 'NOTIFICATION';
        } else if (endpoint.includes('/import-csv')) {
            action = 'IMPORT_USERS';
            resourceType = 'USER';
        } else if (endpoint.includes('/dashboard-analytics')) {
            action = 'VIEW_ANALYTICS';
            resourceType = 'ANALYTICS';
        } else if (endpoint.includes('/advanced-analytics')) {
            action = 'VIEW_ADVANCED_ANALYTICS';
            resourceType = 'ANALYTICS';
        } else if (endpoint.includes('/load')) {
            action = 'LIST_USERS';
            resourceType = 'USER';
        } else {
            resourceType = 'ADMIN';
        }
    } else if (endpoint.includes('/sessions')) {
        resourceType = 'SESSION';
        category = 'SESSION';
        if (method === 'GET') action = 'VIEW_SESSIONS';
        else if (method === 'POST') action = 'CREATE_SESSION';
        else if (method === 'PUT') action = 'UPDATE_SESSION';
        else if (method === 'DELETE') action = 'DELETE_SESSION';
    } else if (endpoint.includes('/attendance')) {
        resourceType = 'ATTENDANCE';
        category = 'ATTENDANCE';
        if (endpoint.includes('/checkin')) action = 'CHECK_IN';
        else if (endpoint.includes('/checkout')) action = 'CHECK_OUT';
        else if (method === 'GET') action = 'VIEW_ATTENDANCE';
    } else if (endpoint.includes('/payments') || endpoint.includes('/payment')) {
        resourceType = 'PAYMENT';
        category = 'PAYMENT';
        if (method === 'GET') action = 'VIEW_PAYMENTS';
        else if (method === 'POST') action = 'CREATE_PAYMENT';
        else if (method === 'PUT') action = 'UPDATE_PAYMENT';
    } else if (endpoint.includes('/memberships')) {
        resourceType = 'MEMBERSHIP';
        category = 'USER';
        if (method === 'GET') action = 'VIEW_MEMBERSHIPS';
        else if (method === 'POST') action = 'CREATE_MEMBERSHIP';
        else if (method === 'PUT') action = 'UPDATE_MEMBERSHIP';
    }

    return { action, resourceType, resourceId, category };
}

/**
 * Determine log severity based on HTTP status code
 */
function getSeverity(statusCode) {
    if (statusCode >= 500) return 'CRITICAL';
    if (statusCode >= 400) return 'ERROR';
    if (statusCode >= 300) return 'WARNING';
    return 'INFO';
}

module.exports = accessLogger;
