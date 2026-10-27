const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");

const host = process.env.DB_HOST || process.argv[2];
const user = process.env.DB_USER || process.argv[3] || "admin";
const password = process.env.DB_PASSWORD || process.argv[4] || "AdminPass123!";
const database = process.env.DB_NAME || process.argv[5] || "projecttrack";

if (!host) {
  console.error("Usage: node infra/init_db.js <host> [user] [password] [database]");
  process.exit(1);
}

console.log(`Connecting to MySQL database at ${host}:3306...`);

const connection = mysql.createConnection({
  host: host,
  user: user,
  password: password,
  database: database,
  multipleStatements: true
});

connection.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  }
  console.log("Connected successfully to RDS MySQL database!");

  const sqlPath = path.join(__dirname, "..", "backup.sql");
  console.log(`Reading SQL script from ${sqlPath}...`);
  const sql = fs.readFileSync(sqlPath, "utf-8");

  console.log("Executing SQL statements to restore database tables and data...");
  connection.query(sql, (queryErr, results) => {
    if (queryErr) {
      console.error("SQL execution error:", queryErr.message);
      connection.end();
      process.exit(1);
    }
    console.log("Database initialized and backup.sql restored successfully!");
    connection.end();
  });
});

