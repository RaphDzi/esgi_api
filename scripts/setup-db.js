// Prepare the database for authentication and roles.
// Can be run several times : it only creates what is missing.
// Usage : npm run setup
import bcrypt from 'bcryptjs';
import pool from '../db.js';

// test accounts, only for development
const TEST_USERS = [
  { email: 'admin@test.com', password: 'admin123', role: 'admin' },
  { email: 'manager@test.com', password: 'manager123', role: 'manager' },
  { email: 'manager2@test.com', password: 'manager123', role: 'manager' },
  { email: 'client@test.com', password: 'client123', role: 'client' },
];

// users table, the role is stored with the user
await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('client', 'manager', 'admin') NOT NULL DEFAULT 'client',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
  )
`);
console.log('Table "users" OK');

// products.created_by : who created the product (used for the manager rule)
const [columns] = await pool.query(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'created_by'`
);
if (columns.length === 0) {
  await pool.query(`
    ALTER TABLE products
      ADD COLUMN created_by INT NULL,
      ADD CONSTRAINT fk_products_created_by
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
  `);
  console.log('Colonne "products.created_by" ajoutée');
} else {
  console.log('Colonne "products.created_by" OK');
}

// passwords are never stored in clear, only their bcrypt hash
for (const user of TEST_USERS) {
  const hash = await bcrypt.hash(user.password, 10);
  const [result] = await pool.query(
    'INSERT IGNORE INTO users (email, password, role) VALUES (?, ?, ?)',
    [user.email, hash, user.role]
  );
  console.log(`${user.email} (${user.role}) : ${result.affectedRows ? 'créé' : 'existe déjà'}`);
}

await pool.end();
