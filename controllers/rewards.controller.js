const mysql = require('../config/database.js');

class RewardsController {
    // GET /rewards/ DASHBOARD PAGE
    static getDashboard(req, res) {
        res.render("rewards", {title: "Rewards"});
    }

    // GET /rewards/load
    static async loadRewards(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const userId = req.user.id

            const sql =`
            SELECT COALESCE(SUM(mrp_pointsadded), 0) AS totalRewardPoints
            FROM master_reward_point mrp
            WHERE mrp.mrp_userid = ?
            AND mrp_status = 'ACTIVE'`;

            const totalResult = await mysql.Query(sql, [userId]);

            // RECENT REWARD HISTORY
            const sqlHistory =`
            SELECT
                mrp.mrp_id,
                mrp.mrp_pointsadded,
                mrp.mrp_status,
                mrp.mrp_source,
                mrp.mrp_dateearned,
                ma.ma_duration,
                mv.mv_code,
                CONCAT(mu.mu_firstname, " ", mu.mu_lastname) AS memberName
            FROM master_reward_point mrp
            LEFT JOIN master_attendance ma ON mrp.mrp_attendanceid = ma.ma_id
            LEFT JOIN master_voucher mv ON mrp.mrp_voucherid = mv.mv_id
            LEFT JOIN master_user mu ON mrp.mrp_userid = mu.mu_id
            WHERE mrp.mrp_userid = ?
            ORDER BY mrp_dateearned DESC LIMIT 10`;

            const historyResult = await mysql.Query(sqlHistory, [req.user.id]);

            res.status(200).json({
                message: "Success",
                data: {
                    totalRewardPoints: totalResult[0]?.totalRewardPoints || 0,
                    history: historyResult
                }
            });

        } catch (error) {
            console.error("RewardsController.loadRewards: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // GET /rewards/admin-load - ADMIN DASHBOARD
    static async adminLoad(req, res) {
        try {
            
            if (!req.user?.id || req.user.role !== "ADMIN") {
                return res.status(401).json({
                    message: "Admin authentication required (Bearer token)"
                });
            }

            const sql =`
            SELECT
                mrp.mrp_userid,
                CONCAT(mu.mu_firstname, " ", mu.mu_lastname) AS memberName,
                COALESCE(SUM(mrp.mrp_pointsadded), 0) AS totalPoints,
                COUNT(mrp.mrp_id) AS transactions,
                MAX(mrp.mrp_dateearned) AS lastActivity
            FROM master_reward_point mrp
            LEFT JOIN master_user mu ON mrp.mrp_userid = mu.mu_id
            WHERE mrp.mrp_status = 'ACTIVE'
            GROUP BY mrp.mrp_userid
            ORDER BY totalPoints DESC`;

            const result = await mysql.Query(sql);
            res.status(200).json({
                message: "Success",
                data: result
            });

        } catch (error) {
            console.error("RewardsController.adminLoad: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // POST /rewards/convert-attendance
    static async convertAttendance(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { ma_id } = req.body;

            if (!ma_id) {
                return res.status(400).json({
                    message: "ma_id required"
                });
            }

            // CHECK ATTENDANCE + POINTS
            const attendance = await mysql.Query(`
                SELECT
                    ma_userid,
                    ma_pointsearned
                FROM master_attendance
                WHERE ma_id = ?
                AND ma_checkout IS NOT NULL
                AND ma_deleted = 0`, [ma_id]);

            if (!attendance.length) {
                return res.status(404).json({
                    message: "Attendance not found or not checked out"
                });
            }

            const { ma_userid: attendanceUserId, ma_pointsearned } = attendance[0];

            if(!ma_pointsearned || ma_pointsearned <= 0) {
                return res.status(400).json({
                    message: "No points earned from this attendance"
                });
            }

            // CHECK IF ALREADY CONVERTED
            const alreadyConverted = await mysql.Query(`
                SELECT 1 FROM master_reward_point
                WHERE mrp_attendanceid = ?`, [ma_id]);

            if (alreadyConverted.length > 0) {
                return res.status(409).json({
                    message: "Attendance points already converted"
                });
            }

            // INSERT REWARD POINT
            const sql =`
            INSERT INTO master_reward_point
                (mrp_userid,
                mrp_attendanceid,
                mrp_pointsadded,
                mrp_source)
            VALUES (?, ?, ?, 'ATTENDANCE')`;

            const result = await mysql.Query(sql, [attendanceUserId, ma_id, ma_pointsearned]);

            res.status(201).json({
                message: "Attendance points converted successfully",
                data: {
                    ma_id,
                    userId: attendanceUserId,
                    pointsConverted: ma_pointsearned,
                    rewardId: result.insertId
                }
            });

        } catch (error) {
            console.error("RewardsController.convertAttendance: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // POST /rewards/redeem-voucher
    static async redeemVoucher(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { voucherId } = req.body;

            if (!voucherId) {
                return res.status(400).json({
                    message: "voucherId required"
                });
            }

            const userId = req.user.id;

            // CHECK USER POINT BALANCE
            const pointsCheck = await mysql.Query(`
                SELECT COALESCE(SUM(mrp_pointsadded), 0) AS totalPoints
                FROM master_reward_point
                WHERE mrp_userid = ?
                AND mrp_status = 'ACTIVE'`, [userId]);

            const userPoints = pointsCheck[0].totalPoints;

            // GET VOUCHER DETAILS
            const voucher = await mysql.Query(`
                SELECT
                    mv_code,
                    mv_pointsrequired,
                    mv_status,
                    mv_maxuses,
                    mv_usecount
                FROM master_voucher
                WHERE mv_id = ?`, [voucherId]);

            // VALIDATION
            if (!voucher.length) {
                return res.status(404).json({
                    message: "Voucher not found"
                });
            }

            const { mv_code, mv_pointsrequired, mv_status,
                mv_maxuses, mv_usecount } = voucher[0];


            // VOUCHER VALIDATIONS
            if (mv_status != "ACTIVE") {
                return res.status(400).json({
                    message: "Voucher inactive"
                });
            }

            if (mv_usecount >= mv_maxuses) {
                return res.status(400).json({
                    message: "Maximum redemption reached"
                });
            }

            if (userPoints < mv_pointsrequired) {
                return res.status(400).json({
                    message: `Need ${mv_pointsrequired} points. You have ${userPoints}.`
                });
            }

            // ATOMIC TRANSACTION: MARK POINTS  REDEEMED + CLAIM VOUCHER
            await mysql.Query(`
                UPDATE master_reward_point
                SET
                    mrp_status = 'REDEEMED'
                WHERE mrp_userid = ?
                AND mrp_status = 'ACTIVE'
                LIMIT ?`, [userId, mv_pointsrequired]);

            // CLAIM
            const voucherResult = await mysql.Query(`
                UPDATE master_voucher
                SET
                    mv_usecount = mv_usecount + 1,
                    mv_userid = ?
                WHERE mv_id = ?`, [userId, voucherId]);

            res.status(200).json({
                message: "Voucher redeemed successfully",
                data: {
                    voucherId,
                    voucherCode: mv_code,
                    pointsSpent: mv_pointsrequired,
                    remainingPoints: userPoints - mv_pointsrequired
                }
            });

        } catch (error) {
            console.error("RewardsController.redeemVoucher: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }
}

module.exports = RewardsController