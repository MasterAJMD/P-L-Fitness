var express = require('express');
var router = express.Router();
const mysql = require('../services/dbconnect.js');
const bcrypt = require('bcryptjs');


/* GET USERS PAGE. */
router.get('/', function(req, res, next) {
  res.render("users", { title: "Users" });
});


// LOGIN AUTH
// router.get("/", (req, res, next) => {
//   // DEBUGS SESSION USER
//   console.log('Session user:', req.session.user); 
//   if (!req.session.user) {
//     return res.redirect('/login');
//   }
//   res.render("course", { user: req.session.user });
// });


router.get("/load", async(req, res)=> {

  try {
  
    // HIDES DELETED 'STATUS'
    // const sql = `SELECT * FROM master_user WHERE mu_status != 'DELETED'`;
    const sql = `SELECT * FROM master_user`;

    const result = await mysql.Query(sql);
    res.status(200).json({
      message: "Success",
      data: result
    });

  } catch (error) {
    res.status(500).json({
      message: "ERROR fetching users",
      data: error
    });
  };

});


// USER INSERTION
router.post("/insert", async (req, res)=> {
try {
  const {
    email, username, password, 
    firstName, lastName, phoneNumber, 
    role, specialty, status,
  } = req.body;

  // PASSWORD VALIDATION
  if (!password || typeof password !== 'string' || password.trim().length < 8) {
    return res.status(400).json({ 
      message: "Password required and must be at least 8 characters" 
    });
  };

  // SALTING AND HASHING
  const hashedPassword = await bcrypt.hash(password.trim(), 12);

  // CHECK UNIQUE EMAIL
  const emailSqlexist = `SELECT 1 FROM master_user WHERE mu_email = ?`;
  let emailSqlresult = await mysql.Query(emailSqlexist, [email]);

  if (emailSqlresult.length > 0) {
    return res.status(409).json ({ message: "Email already exist" });
  };

  // CHECK UNIQUE USERNAME
  const usernameSqlexist = `SELECT 1 FROM master_user WHERE mu_username = ?`;
  let usernameSqlresult = await mysql.Query(usernameSqlexist, [username]);

  if (usernameSqlresult.length > 0) {
    return res.status(409).json ({ message: "Username already exist" });
  };

  const sql = `
  INSERT INTO master_user (mu_email, mu_username, mu_password,
  mu_firstName, mu_lastName, mu_phoneNumber, mu_role, mu_specialty, mu_status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const result = await mysql.Query(sql, [email, username, hashedPassword,
    firstName, lastName, phoneNumber, role, specialty, status
  ]);
  res.status(201).json ({
    message: "User created successfully",
    userId: result.insertId,
    data: result
  });

} catch (error) {
  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "Duplicated Email or Username" });
  };
  console.error("Error: ", error);
  res.status(500).json({ message: "Server Error (500)"});
}
});


// USER UPDATE
router.put('/update', async (req, res)=> {
  try {
    
    const {
    id, email, username, password,
    firstName, lastName, phoneNumber,
    role, specialty, status
  } = req.body;

  // ID VALIDATION
  if (!id || isNaN(id)) {
  return res.status(400).json({ message: "Valid ID required" });
};

  // PASSWORD VALIDATION
  if (!password || typeof password !== 'string' || password.trim().length < 8) {
    return res.status(400).json({ 
      message: "Password required and must be at least 8 characters" 
    });
  };

  // SALTING AND HASHING
  let hashedPassword;
  if (password && typeof password === 'string' && password.trim().length >= 8) {
    hashedPassword = await bcrypt.hash(password.trim(), 12);
  } else {
    
    const user = await mysql.Query('SELECT mu_password FROM master_user WHERE mu_id = ?', [id]);
    if (!user.length) return res.status(404).json({ message: 'User not found' });
    hashedPassword = user[0].mu_password;
  };

  // CHECK UNIQUE EMAIL
  const emailSqlexist = `SELECT 1 FROM master_user 
  WHERE mu_email = ? AND mu_id != ?`;
  let emailSqlresult = await mysql.Query(emailSqlexist, [email, id]);

  if (emailSqlresult.length > 0) {
    return res.status(409).json ({ message: "Email already exist" });
  };

  // CHECK UNIQUE USERNAME
  const usernameSqlexist = `SELECT 1 FROM master_user
  WHERE mu_username = ? AND mu_id != ?`;
  let usernameSqlresult = await mysql.Query(usernameSqlexist, [username, id]);

  if (usernameSqlresult.length > 0) {
    return res.status(409).json ({ message: "Username already exist" });
  };

  const sql = `
  UPDATE master_user
  SET mu_email = ?, mu_username = ?, mu_password = ?, mu_firstName = ?,
  mu_lastName = ?, mu_phoneNumber = ?, mu_role = ?, mu_specialty = ?, mu_status = ?
  WHERE mu_id = ?
  `;

  const result = await mysql.Query(sql, [email, username, hashedPassword,
    firstName, lastName, phoneNumber, role, specialty, status, id
  ]);

  if (result.affectedRows === 0) {
    return res.status(404).json ({ message: "User not found" });
  };

  res.status(200).json({
    message: "User updated successfully",
    affectedRows: result.affectedRows,
    data: result
  });

  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json ({ message: "Duplicated Email or Username" });
    };
    console.error("Error: ", error);
    res.status(500).json({ message: "Server Error"});
  };
});


// SOFT DELETE
router.put('/delete', async (req, res)=> {
  try {
    
    const { id } = req.body;

    // ID VALIDATION
    if (!id || isNaN(id)) {
    return res.status(400).json({ message: "Valid ID required" });
    };

    const sql = `
    UPDATE master_user
    SET mu_email = CONCAT('DELETED_', mu_id, '@deleted.com'),
    mu_username = CONCAT('DELETED_', mu_id),
    mu_password = 'DELETED',
    mu_firstName = 'DELETED',
    mu_lastName = 'DELETED',
    mu_phoneNumber = 'DELETED',
    mu_role = 'DELETED',
    mu_specialty = 'DELETED',
    mu_status = 'DELETED',
    mu_createdById = NULL
    WHERE mu_id = ?
    `;

    const result = await mysql.Query(sql, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    };

    res.status(200).json({
      message: "User has been soft deleted",
      affectedRows: result.affectedRows
    });

  } catch (error) {
    console.error("ERROR DELETE: ", error);
    res.status(500).json ({ message:  "Server Error"});
  };
});


module.exports = router;