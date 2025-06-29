import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'task_management',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to the database:', err.stack);
  } else {
    console.log('✅ Successfully connected to database');
    release();
  }
});

const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'employee')),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        assigned_by INTEGER REFERENCES users(id),
        assigned_to INTEGER REFERENCES users(id),
        deadline TIMESTAMPTZ NOT NULL,
        status VARCHAR(50) NOT NULL CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS performance_scores (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER CHECK (score >= 0 AND score <= 100),
        month DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        google_event_id VARCHAR(255),
        microsoft_event_id VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create default admin if not exists
    const adminEmail = 'info@thewebvalue.com';
    const adminPassword = 'Aa123456';
    const adminName = 'System Administrator';

    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
    if (existing.rows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      await pool.query(
        'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
        [adminEmail, hashedPassword, adminName, 'admin']
      );
      console.log('✅ Default admin user created successfully');
    }

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database tables:', error);
    throw error;
  }
};

export { pool, initDatabase };
