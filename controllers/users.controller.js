const mysql = require('../services/dbconnect.js');
const bcryptjs = require('bcryptjs');


class UserController {
    // GET /users/ DASHBOARD PAGE
    static getDashboard(req, res) {
        res.render("users", {title: "Users"});
    }


    // GET /users/profile
    static async getProfile(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const user = await mysql.Query(`
                SELECT
                    mu_username,
                    mu_firstName,
                    mu_lastName,
                    mu_phoneNumber,
                    mu_email,
                    mu_role
                FROM master_user
                WHERE mu_id = ?
                `, [req.user.id]);


                if (!user.length || !user[0]) {
                    return res.status(404).json({
                        message: "User profile not found"
                    });
                }

                res.status(200).json({
                    message: "Profile loaded",
                    data: user[0]
                });

        } catch (error) {
            console.error("UserController.getProfile: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // PUT /users/profile
    static async updateProfile(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { phoneNumber, email, password } = req.body;

            // PASSWORD VALIDATION
            if (password && (typeof password !== 'string' || password.trim().length < 8)) {
                return res.status(400).json({
                    message: "Password must be at least 8 characters"
                });
            }

            // PASSWORD HASHING
            let hashedPassword = null;
            if (password && password.trim().length >= 8) {
                hashedPassword = await bcryptjs.hash(password.trim(), 12);
            }

            // CHECK UNIQUE EMAIL
            const emailSqlExist =`
            SELECT 1 FROM master_user
            WHERE mu_email = ?
            AND mu_id != ?`;
            let emailSqlResult = await mysql.Query(emailSqlExist, [email, req.user.id]);

            if (emailSqlResult.length > 0) {
                return res.status(409).json({
                    message: "Email already exists"
                });
            }

            // UPDATE PROFILE
            const sql =`
            UPDATE master_user
            SET
                mu_phoneNumber = ?,
                mu_email = ?,
                mu_password = ?,
                mu_updatedById = ?
            WHERE mu_id = ?`;

            const result = await mysql.Query(sql, [phoneNumber,
                email, hashedPassword || null, req.user.id, req.user.id
            ]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "User not found"
                });
            }

            res.status(200).json({
                message: "Profile updated successfully",
                affectedRows: result.affectedRows
            });

        } catch (error) {

            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Duplicated Email",
                    data: error
                });
            }

            console.error("UserController.updateProfile: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // GET /users/points
    static async getPoints(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const points = await mysql.Query(`
                SELECT * FROM master_reward_point
                WHERE mr_userId = ?
                ORDER BY mr_dateEarned DESC
                `, [req.user.id]);

                res.status(200).json({
                    message: "Points history loaded",
                    data: points
                });

        } catch (error) {
            
            console.error("UserController.getPoints: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }
}

module.exports = UserController;