import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// pg reads PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD automatically when no connectionString given
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool();

export const db = drizzle(pool, { schema });
