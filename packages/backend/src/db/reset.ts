import pg from 'pg';
import 'dotenv/config';

async function reset() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🗑️  Dropping all tables...');
    await pool.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO public;
    `);
    console.log('✅ Database reset complete. Run db:migrate to re-create schema.');
  } finally {
    await pool.end();
  }
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
