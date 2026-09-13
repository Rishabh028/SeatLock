import { DbClient } from '../db/pool.js';
import { User, UserRole } from '../types/index.js';

export class UserRepository {
  async findById(id: string, client?: DbClient): Promise<User | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByEmail(email: string, client?: DbClient): Promise<User | null> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  }

  async create(
    data: { email: string; password_hash: string; name: string; role?: UserRole },
    client?: DbClient
  ): Promise<User> {
    const db = client || (await import('../db/pool.js')).getPool();
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.email, data.password_hash, data.name, data.role || UserRole.USER]
    );
    return rows[0]!;
  }
}
