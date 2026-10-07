const fs = require('fs');
const mysql = require('mysql2/promise');

async function importSql() {
  const connection = await mysql.createConnection({
    host: 'project-track-stack-mysqldatabase-hmbp7wnqaxgh.c7gsko48yrwy.ap-southeast-2.rds.amazonaws.com',
    user: 'admin',
    password: 'AdminPass123!',
    database: 'projecttrack',
    multipleStatements: true
  });

  console.log('Connected to AWS RDS database!');
  
  const sql = fs.readFileSync('backup.sql', 'utf8');
  console.log('Importing backup.sql...');
  
  await connection.query(sql);
  console.log('Database import complete!');
  
  await connection.end();
}

importSql().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});

