const mysql = require('../config/database.js');

class VouchersController {
    // GET /vouchers/ DASHBOARD PAGE
    static getDashboard(req, res) {
        res.render("vouchers", {title: "Vouchers"});
    }


    // GET /vouchers/load
    static async loadVouchers(req, res) {
        try {
            
            const sql =`
            SELECT
                mv.mv_id,
                mv.mv_code,
                mv.mv_description,
                mv.mv_discounttype,
                mv.mv_value,
                mv.mv_pointsrequired,
                mv.mv_minspend,
                mv.mv_maxuses,
                mv.mv_usecount,
                mv.mv_validfrom,
                mv.mv_validuntil,
                mv.mv_status,
                mv.mv_createdat,
                CONCAT(mu.mu_firstname, ' ', mu.mu_lastname) as usedByName
            FROM master_voucher mv
            LEFT JOIN master_user mu ON mv.mv_userid = mu.mu_id
            -- WHERE mv_status != 'DEACTIVATED' -- delete to see deleted status
            ORDER BY mv.mv_id DESC`;

            const result = await mysql.Query(sql);
            res.status(200).json({
                message: "Success",
                data: result
            });

        } catch (error) {
            console.error("VouchersController.loadVouchers: ", error);
            res.status(500).json({
                message: "Error fetching vouchers",
                data: error
            });
        }
    }


    // POST /vouchers/insert
    static async createVoucher(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { code, description, discountType, value,
                minSpend, maxUses, useCount, validFrom, validUntil, status } = req.body;

            
            // VALIDATION
            if (!code || !discountType || !value || !validFrom || !validUntil || !status) {
                return res.status(400).json({
                    message: "code, discountType, value, validFrom, validUntil, status required"
                });
            }

            const sql =`
            INSERT INTO master_voucher
                (mv_code,
                mv_description,
                mv_discounttype,
                mv_value,
                mv_minspend,
                mv_maxuses,
                mv_usecount,
                mv_validfrom,
                mv_validuntil,
                mv_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const result = await mysql.Query(sql, [code, description || null,
                discountType, value, minSpend || 0, maxUses || 1, useCount || 0,
                validFrom, validUntil, status || "ACTIVE"]);

            res.status(201).json({
                message: "Voucher created successfully",
                data: {
                    mv_id: result.insertId
                }
            });

        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Duplicated Entry",
                    data: error
                });
            }
            console.error("VouchersController.createVoucher: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // PUT /vouchers/update
    static async updateVoucher(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { id, code, description, discountType, value,
                minSpend, maxUses, useCount, validFrom, validUntil, status } = req.body;


            // VALIDATION
            if (!id || !code || !discountType || !value || !validFrom || !validUntil || !status) {
                return res.status(400).json({
                    message: "id, code, discountType, value, validFrom, validUntil, status required"
                });
            }

            // UNIQUE CODE CHECKING
            const existing = await mysql.Query(`
                SELECT 1 FROM master_voucher
                WHERE mv_code = ?
                AND mv_id != ?`, [code, id]);
            if (existing.length > 0) {
                return res.status(409).json({
                    message: "Voucher code already exists"
                });
            }

            const sql =`
            UPDATE master_voucher
            SET
                mv_code = ?,
                mv_description = ?,
                mv_discounttype = ?,
                mv_value = ?,
                mv_minspend = ?,
                mv_maxuses = ?,
                mv_usecount = ?,
                mv_validfrom = ?,
                mv_validuntil = ?,
                mv_status = ?
            WHERE mv_id = ?`;

            const result = await mysql.Query(sql, [code, description || null,
                discountType, value, minSpend || 0, maxUses || 1,
                useCount || 0, validFrom, validUntil, status, id ]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Voucher not found"
                });
            }

            res.status(200).json({
                message: "Voucher has been updated",
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
            console.error("VouchersController.updateVoucher: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // PUT /vouchers/use
    static async useVoucher(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { id } = req.body;

            if (!id || isNaN(id)) {
                return res.status(400).json({
                    message: "Valid voucher id required"
                });
            }

            const memberId = req.user.id;

            // USAGE CHECKING
            const [voucher] = await mysql.Query(`
                SELECT
                    mv_id,
                    mv_maxuses,
                    mv_usecount,
                    mv_status,
                    mv_validfrom,
                    mv_validuntil,
                    mv_userid,
                    mv_code
                FROM master_voucher
                WHERE mv_id = ?
                FOR UPDATE`, [id]);

            
            // VALIDATION
            if (!voucher) {
                return res.status(404).json({
                    message: "Voucher not found"
                });
            }

            // DATE COMPARISON
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

            if (voucher.mv_status !== "ACTIVE") {
                return res.status(400).json({
                    message: "Voucher is inactive"
                });
            }

            if (voucher.mv_usecount >= (voucher.mv_maxuses || 99999)) {
                return res.status(400).json({
                    message: "Maximum uses reached"
                });
            }

            if (today < voucher.mv_validfrom || today > voucher.mv_validuntil) {
                return res.status(400).json({
                    message: `Voucher valid ${voucher.mv_validfrom} to ${voucher.mv_validuntil}`
                });
            }

            // PREVENT SAME USER DOUBLE REDEMPTION
            if (voucher.mv_userid === memberId) {
                return res.status(400).json({
                    message: "You already used this voucher"
                });
            }

            // ATOMIC UPDATE (useCount INCREMENT)
            const result = await mysql.Query(`
                UPDATE master_voucher
                SET
                    mv_usecount = mv_usecount + 1,
                    mv_userid = ?
                WHERE mv_id = ?
                AND mv_status = 'ACTIVE'
                AND COALESCE(mv_maxuses, 99999) > mv_usecount
                AND ? BETWEEN mv_validfrom and mv_validuntil`, [memberId, id, today]);

            if (result.affectedRows === 0) {
                return res.status(409).json({
                    message: "Voucher already used or expired"
                });
            }

            res.status(200).json({
                message: "Voucher redeemed successfully",
                details: {
                    code: voucher.mv_code || "N/A",
                    remainingUses: (voucher.mv_maxuses || "Unlimited") - (voucher.mv_usecount + 1),
                    redeemedBy: memberId
                }
            });

        } catch (error) {
            console.error("VouchersController.useVoucher: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }


    // POST /vouchers/reset-use (ADMIN ONLY)
    static async resetVoucherUse(req, res) {
        try {
            
            if (!req.user?.id || req.user.role !== "ADMIN") {
                return res.status(401).json({
                    message: "Admin authentication required"
                });
            }

            const { voucherId } = req.body;

            if (!voucherId || isNaN(voucherId)) {
                return res.status(400).json({
                    message: "voucherId required"
                });
            }

            const result = await mysql.Query(`
                UPDATE master_voucher
                SET
                    mv_usecount = 0,
                    mv_userid = NULL
                WHERE mv_id = ?`, [voucherId]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Voucher not found"
                });
            }

            res.status(200).json({
                message: "Voucher use count reset",
                affectedRows: result.affectedRows
            });

        } catch (error) {
            console.error("VouchersController.resetVoucherUse: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }
}

module.exports = VouchersController;