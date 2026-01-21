const mysql = require('../config/database.js');
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
                    username: user[0].mu_username,
                    role: user[0].mu_role
                  },
                  process.env.JWT_SECRET,
                  { expiresIn:'1h' }
                );

                // Set token as HTTP-only cookie
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 3600000 // 1 hour
                });

                res.json({
                    token,
                    user: {
                        id: user[0].mu_id,
                        username: user[0].mu_username,
                        role: user[0].mu_role
                    }
                });
        } catch (error) {
            res.status(500).json({
                message: "Server Error (500)"
            });
        }
    }

    // POST /auth/register
    static async register(req, res) {
        try {
            const { username, password, email, firstName, lastName, phone } = req.body;

            // Check if username already exists
            const checkUserSql = `
                SELECT * FROM master_user
                WHERE mu_username = ?
                AND mu_status != 'DELETED'
            `;
            const existingUser = await mysql.Query(checkUserSql, [username]);

            if (existingUser.length > 0) {
                return res.status(400).json({
                    message: "Username already exists"
                });
            }

            // Hash password
            const hashedPassword = await bcryptjs.hash(password, 10);

            // Insert new user
            const insertSql = `
                INSERT INTO master_user (
                    mu_username,
                    mu_password,
                    mu_email,
                    mu_firstname,
                    mu_lastname,
                    mu_phonenumber,
                    mu_role,
                    mu_status
                ) VALUES (?, ?, ?, ?, ?, ?, 'MEMBER', 'ACTIVE')
            `;

            await mysql.Query(insertSql, [
                username,
                hashedPassword,
                email,
                firstName,
                lastName,
                phone
            ]);

            res.status(201).json({
                message: "Registration successful. Please login with your credentials."
            });

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({
                message: "Server Error (500)"
            });
        }
    }
}

module.exports = AuthController;