var express = require('express');
var router = express.Router();
const mysql = require('../services/dbconnect.js');

/* GET VOUCHERS PAGE. */
router.get('/', function(req, res, next) {
  res.send('VOUCHERS ROUTER');
});


router.get("/load", async (req, res)=> {
  try {
    
    const sql=`
    SELECT 
      mv_id,
      mv_code,
      mv_description,
      mv_discountType,
      mv_value,
      mv_pointsRequired,
      mv_minSpend,
      mv_maxUses,
      mv_useCount,
      mv_validFrom,
      mv_validUntil,
      mv_status,
      mv_createdAt,
      mu.mu_firstName as usedByName
    FROM master_voucher
    LEFT JOIN master_user mu ON mv_usedBy = mu.mu_id
    -- WHERE mv_status != 'DEACTIVATED' --delete to see deleted status
    ORDER BY mv_id DESC
    `;

    const result = await mysql.Query(sql);
    res.status(200).json({
      message: "Success",
      data: result
    });

  } catch (error) {
    res.status(500).json({
      message: "Error fetching vouchers",
      data: error
    });
  }
});


// VOUCHER INSERT
router.post("/insert", async (req, res)=> {
  try {
    
    if (!req.user?.id) {
      return res.status(401).json({
        message: "Authentication required (Bearer token)"
      });
    }

    const { code, description, discountType,
      value, minSpend, maxUses, useCount, validFrom,
      validUntil, status
     } = req.body;

     //VALIDATION
     if(!code || !discountType || !value || !validFrom || !validUntil || !status) {
      return res.status(400).json({
        message: "code, discountType, value, validFrom, validUntil, status required"
      });
     }

     const sql = `
     INSERT INTO master_voucher
      (mv_code,
      mv_description,
      mv_discountType,
      mv_value,
      mv_minSpend,
      mv_maxUses,
      mv_useCount,
      mv_validFrom,
      mv_validUntil,
      mv_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const result = await mysql.Query(sql, [code, description || null, 
        discountType, value, minSpend || 0, maxUses || 1, useCount || 0, 
        validFrom, validUntil, status || 'ACTIVE'
      ]);

      res.status(201).json({
        message: "Voucher created successfully",
        data: {mv_id: result.insertId}
      });

  } catch (error) {
    if(error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Duplicated Entry",
        data: error
      });
    }
    console.error("Error: ", error)
    res.status(500).json({
      message: "Server Error (500)",
      data: error
    });
  }
});


// UPDATE VOUCHERS
router.put("/update", async (req, res)=> {
  try {
    
    if(!req.user?.id) {
      return res.status(401).json({
        message: "Authentication required (Bearer token)"
      });
    }

    const { id, code, description, discountType, value,
      minSpend, maxUses, useCount, validFrom, validUntil, status
     } = req.body;


     // VALIDATION
     if (!id || !code || !discountType || !value || !validFrom || !validUntil || !status) {
      return res.status(400).json({
        message: "id, code, discountType, value, validFrom, validUntil, status required"
      });
     }

     // UNIQUE CODE CHECKING
     const existing = await mysql.Query(
      `SELECT 1 FROM master_voucher WHERE mv_code= ? AND mv_id != ?`, [code, id]
     );
     if (existing.length > 0) {
      return res.status(409).json({message: "Voucher code already exists"});
     }

     const sql = `
     UPDATE master_voucher
      SET mv_code = ?,
      mv_description = ?,
      mv_discountType = ?,
      mv_value = ?,
      mv_minSpend = ?,
      mv_maxUses = ?,
      mv_useCount = ?,
      mv_validFrom = ?,
      mv_validUntil = ?,
      mv_status = ?
    WHERE mv_id = ?
     `;

     const result = await mysql.Query(sql, [code, description || null, 
      discountType, value, minSpend || 0, maxUses || 1, 
      useCount || 0, validFrom, validUntil, status, id
     ]);

     if (result.affectedRows === 0) {
      return res.status(404).json({message: "Voucher not found"});
     }

     res.status(200).json ({
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
    };
    console.error("Error: ", error);
    res.status(500).json({
      message: "Server Error (500)",
      data: error
    });
  }
});


// VOUCHER USE
router.put("/use", async (req, res)=> {
  try {
    
    if(!req.user?.id) {
      return res.status(401).json({
        message: "Authentication required (Bearer token)"
      });
    }

    const {id} = req.body;

    if(!id || isNaN(id)) {
      return res.status(400).json({
        message: "Valid voucher id required"
      });
    }

    const memberId = req.user.id;

    // USAGE CHECKING
    const [voucher] = await mysql.Query(`
      SELECT
        mv_id,
        mv_maxUses, 
        mv_useCount, 
        mv_status,
        mv_validFrom,
        mv_validUntil,
        mv_usedBy,
        mv_code
      FROM master_voucher WHERE mv_id = ? FOR UPDATE`, [id]);

      // VALIDATION
      if (!voucher) {
        return res.status(404).json({message: "Voucher not found"});
      }

      // DATE COMPARISON
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      if (voucher.mv_status !== "ACTIVE") {
        return res.status(400).json({message: "Voucher is inactive"});
      }

      if (voucher.mv_useCount >= (voucher.mv_maxUses || 99999)) {
        return res.status(400).json({message: "Maximum uses reached"});
      }

      if (today < voucher.mv_validFrom || today > voucher.mv_validUntil) {
        return res.status(400).json({
          message: `Voucher valid ${voucher.mv_validFrom} to ${voucher.mv_validUntil}`
        });
      }

      // PREVENT SAME USER DOUBLE REDEMPTION
      if (voucher.mv_usedBy === memberId) {
        return res.status(400).json({message: "You already used this voucher"});
      }
        // useCount INCREMENT
        const result = await mysql.Query(`
          UPDATE master_voucher
            SET mv_useCount = mv_useCount + 1,
                mv_usedBy = ?
          WHERE mv_id = ?
            AND mv_status = 'ACTIVE'
            AND COALESCE(mv_maxUses, 99999)>mv_useCount
            AND ? BETWEEN mv_validFrom and mv_validUntil`,
            [memberId, id, today]);


          if (result.affectedRows === 0) {
            return res.status(409).json({ message: "Voucher already used or expired" });
          }

          res.status(200).json({
            message: "Voucher redeemed successfully",
            details: {
              code: voucher.mv_code || "N/A",
              remainingUses: (voucher.mv_maxUses || "Unlimited") - (voucher.mv_useCount + 1),
              redeemedBy: memberId
            }
          });

  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({
      message: "Server Error (500)",
      data: error
    })
  }
});



// ADMIN ONLY RESET USE
router.post("/reset-use", async (req, res)=> {
  try {
    
    if(!req.user?.id || req.user.role !== 'ADMIN') {
      return res.status(401).json({message: "Admin authentication required"});
    }

    const { voucherId } = req.body;

    if (!voucherId || isNaN(voucherId)) {
      return res.status(400).json({message: "voucherId required"});
    }

    const result = await mysql.Query(`
      UPDATE master_voucher
        SET mv_useCount = 0, mv_usedBy = NULL
      WHERE mv_id = ?
      `, [voucherId]);

      if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    res.status(200).json({
      message: "Voucher use count reset",
      affectedRows: result.affectedRows
    });

  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Server Error (500)" });
  }
});

module.exports = router;