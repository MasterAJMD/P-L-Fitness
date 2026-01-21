const mysql = require('../config/database.js');

class SessionsController {
    // GET /sessions/ - DASHBOARD PAGE
    static getDashboard(req, res) {
        res.render("sessions", {title: "Sessions"});
    }


    // GET /sessions/load
    static async loadSessions(req, res) {
        try {
            
            const sql =`
            SELECT
                ms.ms_id,
                ms.ms_userid,
                CONCAT(mu.mu_firstname, ' ', mu.mu_lastname) as coachName,
                ms.ms_sessionname,
                ms.ms_datetime,
                ms.ms_capacity,
                ms.ms_status
            FROM master_session ms
            LEFT JOIN master_user mu ON ms.ms_userid = mu.mu_id
            -- WHERE mu.mu_status != 'DELETED' -- delete this to see 'DELETED' status
            -- AND mu.mu_status != 'DELETED' -- delete this to see 'DELETED' status
            ORDER BY ms.ms_datetime ASC`;

            const result = await mysql.Query(sql);
            res.status(200).json({
                message: "Success",
                data: result
            });

        } catch (error) {
            console.error("SessionsController.loadSessions: ", error);
            res.status(500).json({
                message: "Error fetching sessions",
                data: error
            });
        }
    }


    // POST /sessions/insert
    static async createSession(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { userId, sessionName, datetime, capacity } = req.body;

            // VALIDATION
            if (!userId || !sessionName || !datetime || !capacity) {
                return res.status(400).json({
                    message: "userId, sessionName, datetime, capacity required"
                });
            }

            const sql =`
            INSERT INTO master_session
                (ms_userid,
                ms_sessionname,
                ms_datetime,
                ms_capacity,
                ms_status)
            VALUES (?, ?, ?, ?, 'ACTIVE')`;

            const result = await mysql.Query(sql, [userId, sessionName, datetime, capacity]);

            res.status(201).json({
                message: "Session created successfully",
                data: {
                    ms_id: result.insertId
                }
            });

        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Duplicated Entry",
                    data: error
                });
            }
            console.error("SessionsController.createSession: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // PUT /sessions/update
    static async updateSession(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { id, sessionName, datetime, capacity, status } = req.body;

            // VALIDATION
            if (!id || !sessionName || !datetime || !capacity) {
                return res.status(400).json({
                    message: "id, sessionName, datetime, capacity required"
                });
            }

            const sql =`
            UPDATE master_session
            SET
                ms_sessionname = ?,
                ms_datetime = ?,
                ms_capacity = ?,
                ms_status = COALESCE(?, ms_status)
            WHERE ms_id = ?`;

            const result = await mysql.Query(sql, [sessionName, datetime, capacity, status, id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Session not found"
                });
            }

            res.status(200).json({
                message: "Session has been updated",
                affectedRows: result.affectedRows,
                data: result
            });

        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Duplicated Entry",
                    data: error
                });
            }
            console.error("SessionsController.updateSession: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // PUT /sessions/delete
    static async deleteSession(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { id } = req.body;

            // VALIDATION
            if (!id || isNaN(id)) {
                return res.status(400).json({
                    message: "Valid ID required"
                });
            }

            const sql =`
            UPDATE master_session
            SET ms_status = 'CANCELLED'
            WHERE ms_id = ?`;

            const result = await mysql.Query(sql, [id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Session not found"
                });
            }

            res.status(200).json({
                message: "Session has been soft deleted",
                affectedRows: result.affectedRows,
                data: result
            });

        } catch (error) {
            console.error("SessionsController.deleteSession: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }
}

module.exports = SessionsController;