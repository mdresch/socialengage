const fs = require('fs');
const path = require('path');

// Check PID and PPID to locate this process's database context
const possibleFiles = [
  path.join(__dirname, `.jest-test-db-${process.pid}.json`),
  path.join(__dirname, `.jest-test-db-${process.ppid}.json`),
];

for (const file of possibleFiles) {
  if (fs.existsSync(file)) {
    try {
      const ctx = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (ctx.testDbName) {
        process.env.PGHOST = '127.0.0.1';
        process.env.PGPORT = '5434';
        process.env.PGDATABASE = ctx.testDbName;
        process.env.PGUSER = 'postgres';
        process.env.PGPASSWORD = 'postgres';
        break;
      }
    } catch {}
  }
}
