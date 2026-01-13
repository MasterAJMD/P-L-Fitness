const mysql = require('../services/dbconnect.js');

class EquipmentController {
    // GET /equipment/ DASHBOARD PAGE
    static getDashboard(req, res) {
        res.render("equipment", {title: "Equipment"});
    }

    // GET /equipment/load
    static async loadEquipment(req, res) {
        try {
            
            const sql =`
            SELECT
                me_id,
                me_brand,
                me_type,
                me_status,
                me_quantity,
                me_purchasedDate
            FROM master_equipment
            -- WHERE me_status != 'DELETED' -- delete this to see 'DELETED' status
            ORDER BY me_type, me_brand`;

            const result = await mysql.Query(sql);
            
            res.status(200).json({
                message: "Success",
                data: result
            });

        } catch (error) {
            console.error("EquipmentController.loadEquipment: ", error);
            res.status(500).json({
                message: "Error fetching equipment",
                data: error
            });
        }
    }

    // POST /equipment/insert
    static async createEquipment(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { brand, type, status,
                quantity, purchasedDate } = req.body;

            // VALIDATION
            if(!brand || !type || !quantity) {
                return res.status(400).json({
                    message: "brand, type, quantity required"
                });
            }

            const sql =`
            INSERT INTO master_equipment
                (me_brand,
                me_type,
                me_status,
                me_quantity,
                me_purchasedDate,
                me_deleted)
            VALUES (?, ?, COALESCE(?, 'AVAILABLE'), ?, ?, 0)`;

            const result = await mysql.Query(sql, [brand, type,
                status, quantity, purchasedDate || null]);

            res.status(201).json({
                message: "Equipment created successfully",
                data: {
                    me_id: result.insertId
                }
            });

        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Duplicated Entry",
                    data: error
                });
            }
            console.error("EquipmentController.createEquipment: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }

    // PUT /equipment/update
    static async updateEquipment(req, res) {
        try {
            
            if (!req.user?.id) {
                return res.status(401).json({
                    message: "Authentication required (Bearer token)"
                });
            }

            const { id, brand, type, quantity, status } = req.body;

            // VALIDATION
            if (!id) {
                return res.status(400).json({
                    message: "id required"
                });
            }

            const sql =`
            UPDATE master_equipment
            SET
                me_brand = ?,
                me_type = ?,
                me_quantity = ?,
                me_status = COALESCE(?, me_status)
            WHERE me_id = ?`;

            const result = await mysql.Query(sql, [brand, type, quantity, status, id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Equipment not found"
                });
            }

            res.status(200).json({
                message: "Equipment has been updated",
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
            console.error("EquipmentController.updateEquipment: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }

    // PUT /equipment/delete
    static async deleteEquipment(req, res) {
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
            UPDATE master_equipment
            SET me_status = 'DELETED'
            WHERE me_id = ?`;

            const result = await mysql.Query(sql, [id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Equipment not found"
                });
            }

            res.status(200).json({
                message: "Equipment has been soft deleted",
                affectedRows: result.affectedRows,
                data: result
            });

        } catch (error) {
            console.error("EquipmentController.deleteEquipment: ", error);
            res.status(500).json({
                message: "Server Error (500)",
                data: error
            });
        }
    }
}

module.exports = EquipmentController;