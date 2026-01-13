const mysql = require('../services/dbconnect.js');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthController {
    // GET /auth/ -- PAGE
    static getDashboard(req, res) {
        res.render("auth", {title: "Auth"});
    }

    // POST /auth/login
    static async login(req, res) {
        try {
            
            const { username, password } = req.body;

            const sql =`
            SELECT * FROM master_user
            WHERE mu_username = ?
            AND mu_status != 'DELETED'`;

            const user = await mysql.Query(sql, [username]);

            // VALIDATE CREDENTIALS
            if (!user.length || !await bcryptjs.compare(password, user[0].mu_password)) {
                return res.status(401).json({
                    message: "INVALID CREDENTIALS"
                });
            }

            // GENERATE JsonWebToken (JWT)
            const token = jwt.sign(
                  { id: user[0].mu_id,
                    role: user[0].mu_role
                  },
                  process.env.JWT_SECRET,
                  { expiresIn:'1h' }
                );
                res.json({
                    token,
                    user: {
                        id: user[0].mu_id,
                        role: user[0].mu_role
                    }
                });
        } catch (error) {
            res.status(500).json({
                message: "Server Error (500)"
            });
        }
    }
}

module.exports = AuthController;