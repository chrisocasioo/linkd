import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString }) : new Pool();

export const db = drizzle(pool, { schema });
