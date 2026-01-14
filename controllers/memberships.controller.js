const mysql = require('../services/dbconnect.js');

class MembershipController {
    // GET /membership/ DASHBOARD PAGE
    static getDashboard(req, res) {
        res.render("memberships", {title: "Memberships"});
    }

    // GET /memberships/load
    static async loadMemberships(req, res) {
        try {

            const sql =`
            SELECT
                mm.mm_id,
                mm.mm_userId,
                CONCAT(mu.mu_firstName, ' ', mu.mu_lastName) AS memberName,
                mm.mm_startDate,
                mm.mm_endDate,
                mm.mm_planType,
                mm.mm_price,
                mm.mm_nextDueDate,
                mm.mm_status,
                mm.mm_totalPaid
            FROM master_membership mm
            LEFT JOIN master_user mu ON mm.mm_userId = mu.mu_id
            -- WHERE mm.mm_status != 'DELETED' -- delete this to see 'DELETED' status
            -- AND mu.mu_status != 'DELETED' -- delete this to see 'DELETED' status
            ORDER BY mm.mm_startDate ASC`;

            const result = await mysql.Query(sql);
            res.status(200).json({
                message: "Success", 
                data: result
            });

        } catch (error) {
            console.error("MembershipsController.loadMemberships: ", error);
            res.status(500).json({
                message: "Error fetching memberships",
                data: error
            });
        }
    }

    // POST /memberships/insert
    static async createMembership(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { userId, startDate, endDate, planType,
                price, nextDueDate, status, totalPaid } = req.body;

            // VALIDATION
            if (!userId || !startDate || !planType || !price) {
                return res.status(400).json({
                    message: "userId, startDate, planType, price required"
                });
            }

            const sql =`
            INSERT INTO master_membership
                (mm_userId,
                mm_startDate,
                mm_endDate,
                mm_planType,
                mm_price,
                mm_nextDueDate,
                mm_status,
                mm_totalPaid)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

            const result = await mysql.Query(sql, [userId, startDate, endDate,
                planType, price, nextDueDate, status, totalPaid]);
            
            res.status(201).json({
                message: "Membership created successfully",
                data: result
            });

        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Duplicated Entry",
                    data: error
                });
            }
            console.error("MembershipsController.createMembership: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }

    // PUT /memberships/update
    static async updateMembership(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { id, startDate, endDate, planType, price,
                nextDueDate, status, totalPaid: newTotalPaid } = req.body;

            // VALIDATION
            if (!id || !startDate || !endDate || !planType || !price) {
                return res.status(400).json({
                    message: "id, startDate, endDate, planType, price required"
                });
            }

            // TOTAL PAYMENT CALCULATION
            const current = await mysql.Query(`
                SELECT mm_totalPaid
                FROM master_membership
                WHERE mm_id = ?`, [id]);
            if (!current.length) {
                return res.status(404).json({
                    message: "Membership not found"
                });
            }

            const currentTotalPaid = current[0].mm_totalPaid || 0;
            const additionalPayment = newTotalPaid || price;
            const updatedTotalPaid = currentTotalPaid + additionalPayment;

            const sql =`
            UPDATE master_membership
            SET
                mm_startDate = ?,
                mm_endDate = ?,
                mm_planType = ?,
                mm_price = ?,
                mm_nextDueDate = ?,
                mm_status = ?,
                mm_totalPaid = ?
            WHERE mm_id = ?`;

            const result = await mysql.Query(sql, [startDate, endDate,
                planType, price, nextDueDate, status, updatedTotalPaid, id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Membership not found"
                });
            }

            res.status(200).json({
                message: "Membership updated successfully",
                affectedRows: result.affectedRows,
                oldTotalPaid: currentTotalPaid,
                newTotalPaid: updatedTotalPaid,
                data: result
            });

        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Duplicated Entry",
                    data: error
                });
            }
            console.error("MembershipsController.updateMembership: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }

    // PUT /memberships/delete
    static async deleteMembership(req, res) {
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
            UPDATE master_membership
            SET
                mm_status = 'DELETED',
                mm_planType = CONCAT('DELETED_', mm_id)
            WHERE mm_id = ?`;

            const result = await mysql.Query(sql, [id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Membership not found"
                });
            }

            res.status(200).json({
                message: "Membership has been soft deleted",
                affectedRows: result.affectedRows,
                data: result
            });

        } catch (error) {
            console.error("MembershipsController.deleteMembership: ", error);
            res.status(500).json({
                message: "Server Error (500)"
            });
        }
    }
}

module.exports = MembershipController;