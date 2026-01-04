var express = require('express');
var router = express.Router();
const mysql = require('../services/dbconnect.js');

/* GET REWARDS PAGE. */
router.get('/', function(req, res, next) {
  res.send('REWARDS ROUTER');
});


// USER LOAD
router.get("/load", async (req, res)=> {
try {
  if (!req.user?.id) {
    return res.status(401).json({
      message: "Authentication required (Bearer token)"
    });
  }

  const userId = req.user.id

  const sql=`
  SELECT COALESCE(SUM(mr_pointsAdded), 0) as totalRewardPoints
  FROM master_reward_point
  WHERE mu_id = ? AND mr_status = 'ACTIVE'`;

  const totalResult = await mysql.Query(sql, [userId]);

  // RECENT REWARD HISTORY
  const sqlHistory =`
  SELECT
    mr_id,
    mr_pointsAdded,
    mr_status,
    mr_source,
    mr_dateEarned,
    ma.ma_duration,
    mv.mv_code,
    CONCAT(mu.mu_firstName, " ", mu.mu_lastName) as memberName
  FROM master_reward_point mr
  LEFT JOIN master_attendance ma ON mr.ma_id = ma.ma_id
  LEFT JOIN master_voucher mv ON mr.mv_id = mv.mv_id
  LEFT JOIN master_user mu ON mr.mu_id = mu.mu_id
  WHERE mr.mu_id = ?
  ORDER BY mr_dateEarned DESC LIMIT 10`;

  const historyResult = await mysql.Query(sqlHistory, [req.user.id]);

  res.status(200).json({
    message: "Success",
    data: {
      totalRewardPoints: totalResult[0]?.totalRewardPoints || 0,
      history: historyResult
    }
  });

} catch (error) {
  console.error("Error: ", error);
  res.status(500).json({ message: "Server Error (500)" });
}
});


// ADMIN LOAD
router.get("/admin-load", async (req, res)=> {
  try {
    
    if(!req.user?.id || req.user.role !== 'ADMIN') {
      return res.status(401).json({
        message: "Admin authentication required (Bearer token)"
      });
    }

    const sql=`
    SELECT
      mr.mu_id,
      CONCAT(mu.mu_firstName, ' ', mu.mu_lastName) as memberName,
      COALESCE(SUM(mr.mr_pointsAdded), 0) as totalPoints,
      COUNT(mr.mr_id) as transactions,
      MAX(mr.mr_dateEarned) as lastActivity
    FROM master_reward_point mr
    LEFT JOIN master_user mu ON mr.mu_id = mu.mu_id
    WHERE mr.mr_status = 'ACTIVE'
    GROUP BY mr.mu_id
    ORDER BY totalPoints DESC`;

    const result = await mysql.Query(sql);
    res.status(200).json({
      message: "Success",
      data: result
    });

  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({
      message: "Server Error (500)",
      data: error
    });
  }
});


// ATTENDANCE CONVERSION
router.post("/convert-attendance", async (req, res)=> {
  try {

    if (!req.user?.id) {
      return res.status(401).json({
        message: "Authentication required (Bearer token)"
      });
    }

    const {ma_id} = req.body;

    if (!ma_id) {
      return res.status(400).json({
        message: "ma_id required"
      });
    }

    // CHECK IF ATTENDANCE EXIST + POINTS EARNED
    const attendance = await mysql.Query(`
      SELECT 
        mu_id,
        ma_pointsEarned
      FROM master_attendance
      WHERE ma_id = ?
      AND ma_checkout IS NOT NULL AND ma_deleted = 0`,[ma_id]);

      if(!attendance.length) {
        return res.status(404).json({
          message: "Attendance not found or not checked out"
        });
      }

      const {mu_id, ma_pointsEarned} = attendance[0];

      if(!ma_pointsEarned || ma_pointsEarned <= 0) {
        return res.status(400).json({
          message: "No points earned from this attendance"
        });
      }

    // CHECK IF ALREADY CONVERTED
      const alreadyConverted = await mysql.Query(`
        SELECT 1 FROM master_reward_point
        WHERE ma_id = ?`, [ma_id]);

      if (alreadyConverted.length > 0) {
        return res.status(409).json({
          message: "Attendance points already converted"
        });
      }

    // INSERT INTO master_reward_point
    const sql=`
    INSERT INTO master_reward_point
      (mu_id, ma_id, mr_pointsAdded, mr_source)
    VALUES(?,?,?,'ATTENDANCE')`;

    const result = await mysql.Query(sql, [mu_id, ma_id, ma_pointsEarned]);

    res.status(201).json({
      message: "Attendance points converted successfully",
      data: {
        ma_id,
        mu_id,
        pointsConverted: ma_pointsEarned,
        rewardId: result.insertId
      }
    });

  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({
      message: "Server Error (500)",
      data: error
    });
  }
});



// REDEEM
router.post("/redeem-voucher", async (req, res)=> {
  try {

    if (!req.user?.id) {
      return res.status(401).json({
        message: "Authentication required (Bearer token)"
      });
    }

    const {voucherId} = req.body;
    
    if(!voucherId){
      return res.status(400).json({
        message: "voucherId required"
      });
    }

    const userId = req.user.id;

    // CHECK USER POINT BALANCE
    const pointsCheck = await mysql.Query(`
      SELECT COALESCE (SUM(mr_pointsAdded), 0) as totalPoints
      FROM master_reward_point
      WHERE mu_id = ? AND mr_status = 'ACTIVE'`, [userId]);

      const userPoints = pointsCheck[0].totalPoints;

      // GET VOUCHER + POINT COST
      const voucher = await mysql.Query(`
        SELECT mv_code, mv_pointsRequired, mv_status, mv_maxUses, mv_useCount
        FROM master_voucher
        WHERE mv_id = ?`, [voucherId]);

        // VALIDATION
        if(!voucher.length) {
          return res.status(404).json({
            message: "Voucher not found"
          });
        }

        const {mv_code, mv_pointsRequired, 
        mv_status, mv_maxUses, mv_useCount} = voucher[0];

        if (mv_status != 'ACTIVE') {
          return res.status(400).json({
            message: "Voucher inactive"
          });
        }

        if (mv_useCount >= mv_maxUses) {
          return res.status(400).json({
            message: "Maximum redemption reached"
          })
        }

        if (userPoints <  mv_pointsRequired) {
          return res.status(400).json({
            message: `Need ${mv_pointsRequired} points. You have ${userPoints}`
          });
        }

        //ATOMIC REDEMPTION
        // MARK POINTS REDEEMED
        await mysql.Query(`
          UPDATE master_reward_point
            SET mr_status = 'REDEEMED'
          WHERE mu_id = ? AND mr_status = 'ACTIVE'
          LIMIT ?`, [userId, mv_pointsRequired]);

          //CLAIM VOUCHER
          const voucherResult = await mysql.Query(`
            UPDATE master_voucher
              SET mv_useCount = mv_useCount + 1, mv_usedBy = ?
            WHERE mv_id = ?`, [userId, voucherId]);

            res.status(200).json({
              message: "Voucher redeemed successfully",
              data: {
                voucherId,
                voucherCode: mv_code,
                pointsSpent: mv_pointsRequired,
                remainingPoints: userPoints - mv_pointsRequired
              }
            });

  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({
      message: "Server Error (500)",
      data: error
    });
  }
});

module.exports = router;