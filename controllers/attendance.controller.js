const mysql = require('../services/dbconnect.js');

class AttendanceController {
    // GET /attendance/ DASHBOARD PAGE
    static getDashboard(req, res) {
        res.render("attendance", {title: "Attendance"});
    }

    // GET /attendance/load
    static async loadAttendance(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const sql =`
            SELECT
                ma.ma_id,
                ma.ma_userId,
                CONCAT(mu.mu_firstName, ' ', mu.mu_lastName) AS memberName,
                ma.ma_sessionId,
                ms.ms_sessionName,
                COALESCE(CONCAT(coach.mu_firstName, ' ', coach.mu_lastName), 'FREE WORKOUT') AS coachName,
                ma.ma_checkin,
                ma.ma_checkout,
                ma.ma_duration,
                ma.ma_pointsEarned
            FROM master_attendance ma
            LEFT JOIN master_user mu ON ma.ma_userId = mu.mu_id
            LEFT JOIN master_session ms ON ma.ma_sessionId = ms.ms_id
            LEFT JOIN master_user coach ON ms.ms_userId = coach.mu_id
            WHERE ma.ma_deleted = 0
            ORDER BY ma.ma_checkin DESC`;

            const result = await mysql.Query(sql);
            res.status(200).json({
                message: "Success",
                data: result
            });

        } catch (error) {
            console.error("AttendanceController.loadAttendance: ", error);
            res.status(500).json({
                message: "Error fetching attendance",
                data: error
            });
        }
    }


    // POST /attendance/checkin
    static async checkin(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { userId, sessionId } = req.body;

            // VALIDATION
            if (!userId) {
                return res.status(400).json({
                    message: "userId required"
                });
            }

            const sql =`
            INSERT INTO master_attendance
                (ma_userId,
                ma_sessionId,
                ma_checkin)
            VALUES (?, ?, NOW())`;

            const result = await mysql.Query(sql, [userId, sessionId || null]);
            res.status(201).json({
                message: "Checkin success",
                data: {
                    ma_id: result.insertId
                }
            });

        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Member already checked in",
                    data: error
                });
            }
            console.error("AttendanceController.checkin: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // PUT /attendance/checkout
    static async checkout(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { ma_id } = req.body;

            // VALIDATION
            if (!ma_id) {
                return res.status(400).json({
                    message: "ma_id required"
                });
            }

            // FETCH USER ID FROM ATTENDANCE ID
            const attendance = await mysql.Query(`
                SELECT ma_userId FROM master_attendance
                WHERE ma_id = ?`, [ma_id]);
            const userId = attendance[0]?.ma_userId;
            if (!userId) {
                return res.status(404).json({
                    message: "Attendance not found"
                });
            }

            // CALCULATE DURATION
            const durationRow = await mysql.Query(`
                SELECT TIMESTAMPDIFF(MINUTE, ma_checkin, NOW())
                AS duration FROM master_attendance
                WHERE ma_id = ?`, [ma_id]);
            const duration = durationRow[0]?.duration;

            // DEBUG
            if (duration === null || duration === undefined) {
                res.status(404).json({
                    message: "Invalid attendance record"
                });
            }

            // CHECK TODAYS POINTS FROM USER
            const todayTotal = await mysql.Query(`
                SELECT COALESCE(SUM(ma_pointsEarned), 0) AS totalToday
                FROM master_attendance
                WHERE ma_userId = ?
                AND ma_checkout IS NOT NULL
                AND DATE(ma_checkout) = CURDATE()
                AND ma_deleted = 0`, [userId]);
            const pointsEarnedToday = todayTotal[0]?.totalToday;
            const remainingPoints = 120 - pointsEarnedToday;

            if (remainingPoints <= 0) {
                return res.status(403).json({
                    message: "Daily points cap (120) reached",
                    data: {
                        pointsToday: pointsEarnedToday
                    }
                });
            }

            // CHECK WEEKLY POINTS
            const weekTotal = await mysql.Query(`
                SELECT COALESCE(SUM(ma_pointsEarned), 0) AS totalWeek
                FROM master_attendance
                WHERE ma_userId = ?
                AND ma_checkout IS NOT NULL
                AND YEARWEEK(ma_checkout) = YEARWEEK(NOW())
                AND ma_deleted = 0`, [userId]);
            const pointsEarnedWeek = weekTotal[0]?.totalWeek;
            const weeklyRemaining = 600 - pointsEarnedWeek;

            if (weeklyRemaining <= 0) {
                return res.status(403).json({
                    message: "Weekly points cap (600) reached",
                    data: {
                        pointsThisWeek: pointsEarnedWeek
                    }
                });
            }

            // CALCULATE POINTS
            const pointsThisWorkout = Math.min(duration, remainingPoints, weeklyRemaining, 120);

            // UPDATE ATTENDANCE
            const sql =`
            UPDATE master_attendance
            SET
                ma_checkout = NOW(),
                ma_duration = ?,
                ma_pointsEarned = ?
            WHERE ma_id = ?`;

            const result = await mysql.Query(sql, [duration, pointsThisWorkout, ma_id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Attendance not found"
                });
            }

            res.status(200).json({
                message: "Checkout success",
                affectedRows: result.affectedRows,
                data: {
                    ma_id,
                    duration_minutes: duration,
                    points_earned: pointsThisWorkout,
                    points_today: pointsEarnedToday + pointsThisWorkout,
                    daily_remaining: remainingPoints - pointsThisWorkout,
                    points_this_week: pointsEarnedWeek,
                    weekly_remaining: weeklyRemaining
                }
            });

        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Duplicated Entry",
                    data:error
                });
            }
            console.error("AttendanceController.checkout: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // PUT /attendance/delete
    static async deleteAttendance(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { id } = req.body;

            if (!id) {
                return res.status(400).json({
                    message: "id required"
                });
            }

            const sql =`
            UPDATE master_attendance
            SET ma_deleted = 1
            WHERE ma_id = ?`;

            const result = await mysql.Query(sql, [id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Attendance not found"
                });
            }

            res.status(200).json({
                message: "Attendance deleted successfully",
                data: {id}
            });

        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Duplicated Entry",
                    data: error
                });
            }
            console.error("AttendanceController.deleteAttendance: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }
}

module.exports = AttendanceController;