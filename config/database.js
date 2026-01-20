const mysql = require("mysql");
require("dotenv").config();

// Use connection pool instead of single connection for better reliability
const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env._HOST_ADMIN,
  user: process.env.DB_USER || process.env._USER_ADMIN,
  password: process.env.DB_PASSWORD || process.env._PASSWORD_ADMIN,
  database: process.env.DB_NAME || process.env._DATABASE_ADMIN,
  port: process.env.DB_PORT || process.env._PORT_ADMIN || 4000,
  timezone: "PST",
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  connectionLimit: 10,
  acquireTimeout: 30000,
  waitForConnections: true,
  queueLimit: 0
});

exports.CheckConnection = () => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to MySQL database: ", err);
      return;
    }
    console.log("MySQL database connection established successfully!");
    connection.release();
  });
};

exports.Query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};
