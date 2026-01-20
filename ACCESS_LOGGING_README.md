# Enterprise Access Logging System

## Overview
A comprehensive, production-ready access logging system that tracks all API requests, user activities, and system events in real-time. This system provides enterprise-level audit trails, security monitoring, and performance analytics.

## Features

### 1. **Automatic Request Logging**
- All API requests are automatically logged via middleware
- Captures request and response details
- Records timing, status codes, and user information
- Sanitizes sensitive data (passwords are redacted)

### 2. **Comprehensive Data Capture**
Each log entry includes:
- **User Information**: User ID, username
- **Request Details**: HTTP method, endpoint, request body
- **Response Details**: Status code, response time, message
- **Network Information**: IP address, user agent
- **Classification**: Action type, resource type, category, severity
- **Timestamp**: Precise time of the request

### 3. **Intelligent Categorization**
Logs are automatically categorized by:
- **Category**: AUTH, USER, SESSION, PAYMENT, ATTENDANCE, ADMIN, SYSTEM
- **Severity**: INFO, WARNING, ERROR, CRITICAL (based on HTTP status code)
- **Action Type**: LOGIN, LOGOUT, CREATE_USER, UPDATE_USER, etc.

### 4. **Advanced Analytics**
The system provides real-time analytics including:
- Total request counts
- Success/error rate trends
- Response time analysis (avg, min, max)
- Error rate over time
- Peak hour identification
- Most active users
- Most accessed endpoints
- Request distribution by category and status

### 5. **Powerful Filtering & Search**
- Filter by category, severity, action, user
- Date range selection
- Full-text search across logs
- Pagination for large datasets

### 6. **Visual Dashboard**
Interactive dashboard with:
- Real-time statistics cards
- Response time trend charts
- Error rate visualization
- Status code distribution
- Category breakdowns
- Top users and endpoints
- Recent error tracking

## Database Schema

### master_access_log Table
```sql
CREATE TABLE master_access_log (
    mal_id INT PRIMARY KEY AUTO_INCREMENT,
    mal_userId INT NULL,
    mal_username VARCHAR(100) NULL,
    mal_action VARCHAR(100) NOT NULL,
    mal_resourceType VARCHAR(50) NOT NULL,
    mal_resourceId INT NULL,
    mal_method VARCHAR(10) NOT NULL,
    mal_endpoint VARCHAR(255) NOT NULL,
    mal_statusCode INT NOT NULL,
    mal_responseTime INT NULL,
    mal_ipAddress VARCHAR(45) NULL,
    mal_userAgent TEXT NULL,
    mal_requestBody TEXT NULL,
    mal_responseMessage TEXT NULL,
    mal_severity ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL'),
    mal_category ENUM('AUTH', 'USER', 'SESSION', 'PAYMENT', 'ATTENDANCE', 'ADMIN', 'SYSTEM'),
    mal_createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Indexes for fast querying
    INDEX idx_userId (mal_userId),
    INDEX idx_action (mal_action),
    INDEX idx_category (mal_category),
    INDEX idx_severity (mal_severity),
    INDEX idx_createdAt (mal_createdAt),
    FOREIGN KEY (mal_userId) REFERENCES master_user(mu_id)
);
```

## API Endpoints

### 1. Load Access Logs
**GET** `/api/access-logs/load`

Query Parameters:
- `page` (number): Page number (default: 1)
- `limit` (number): Results per page (default: 50)
- `category` (string): Filter by category
- `severity` (string): Filter by severity
- `action` (string): Filter by action type
- `userId` (number): Filter by user ID
- `startDate` (string): Start date filter
- `endDate` (string): End date filter
- `search` (string): Search query

Response:
```json
{
  "message": "Access logs loaded successfully",
  "data": {
    "logs": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1234,
      "totalPages": 25
    }
  }
}
```

### 2. Get Analytics
**GET** `/api/access-logs/analytics?period=24h`

Query Parameters:
- `period`: `1h`, `24h`, `7d`, `30d`

Response: Comprehensive analytics data including trends, breakdowns, and statistics.

### 3. Get User Activity
**GET** `/api/access-logs/user-activity/:userId?limit=50`

Returns specific user's activity history.

### 4. Cleanup Old Logs (Admin Only)
**DELETE** `/api/access-logs/cleanup`

Body:
```json
{
  "days": 90
}
```

Deletes logs older than specified days.

## Setup Instructions

### 1. Database Migration
Run the SQL migration script:
```bash
mysql -u your_user -p your_database < migrations/create_access_logs_table.sql
```

### 2. Middleware Integration
The access logging middleware is automatically enabled for all `/api/*` routes in `app.js`.

### 3. Frontend Access
Navigate to Admin Dashboard → Access Logs tab to view the logging interface.

## Usage Examples

### Viewing Logs
1. Go to Admin Dashboard
2. Click on "Access Logs" tab
3. Use filters to narrow down results:
   - Select category (e.g., AUTH for login attempts)
   - Choose severity level
   - Search by username or endpoint
4. View detailed information for each request

### Analyzing Trends
1. Navigate to "Analytics" tab
2. Select time period (1h, 24h, 7d, 30d)
3. Review:
   - Response time trends
   - Error rate changes
   - Peak usage hours
   - Top users and endpoints

### Monitoring Errors
1. Go to "Errors" tab
2. View all recent errors with:
   - Error details
   - Stack traces (if available)
   - User information
   - Timestamp

### Exporting Logs
Click the "Export" button to download logs as CSV file for external analysis or compliance reporting.

## Security Considerations

### Data Privacy
- Passwords are automatically redacted from request bodies
- Sensitive data can be configured to be excluded
- IP addresses and user agents are logged for security auditing

### Access Control
- All access log endpoints require authentication
- Only administrators can view access logs
- Only administrators can cleanup old logs

### Performance
- Logging is asynchronous and non-blocking
- Indexes optimize query performance
- Configurable retention policies prevent database bloat

## Maintenance

### Log Retention
Implement a cleanup policy to manage database size:
- Keep last 30 days for active monitoring
- Archive 30-90 days for compliance
- Delete logs older than 90 days (configurable)

### Monitoring
Monitor the logging system itself:
- Check disk space usage
- Monitor query performance
- Set up alerts for critical errors

### Performance Tuning
- Adjust indexes based on query patterns
- Consider partitioning for large datasets
- Implement archiving for historical data

## Troubleshooting

### Logs Not Appearing
1. Check if middleware is properly loaded in app.js
2. Verify database table exists
3. Check database connection

### Slow Performance
1. Add additional indexes for frequently filtered fields
2. Implement log cleanup for old entries
3. Consider database partitioning

### Missing Data
1. Check middleware order in app.js
2. Verify all routes use the correct base path
3. Check for errors in middleware error handling

## Future Enhancements

Potential improvements:
- Real-time log streaming via WebSocket
- Anomaly detection and alerting
- Geographic IP mapping
- Custom dashboard widgets
- Integration with external monitoring tools (Datadog, New Relic)
- Machine learning for pattern detection
- Advanced correlation between related requests

## Support

For issues or questions:
1. Check the error logs in the browser console
2. Review server logs for backend errors
3. Verify database connectivity
4. Ensure proper authentication tokens
