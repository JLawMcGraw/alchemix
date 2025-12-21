#!/usr/bin/env ts-node
/**
 * Migration: Add has_seeded_classics column to users table
 * 
 * This migration adds the has_seeded_classics column for tracking
 * whether a user has received their initial 20 classic recipes.
 * 
 * Safe to run multiple times (checks if column exists first).
 * 
 * Usage:
 *   npx ts-node scripts/migrate-add-seeded-classics.ts
 */

import '../src/config/env';
import { Pool } from 'pg';

async function migrate() {
  console.log('='.repeat(60));
  console.log('Migration: Add has_seeded_classics column');
  console.log('='.repeat(60));
  console.log('');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    // Check if column already exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'has_seeded_classics'
    `);

    if (checkResult.rows.length > 0) {
      console.log('Column has_seeded_classics already exists. Skipping migration.');
    } else {
      console.log('Adding has_seeded_classics column to users table...');
      
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN has_seeded_classics BOOLEAN NOT NULL DEFAULT FALSE
      `);
      
      console.log('Column added successfully!');
    }

    // Verify the column exists
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'has_seeded_classics'
    `);

    if (verifyResult.rows.length > 0) {
      const col = verifyResult.rows[0];
      console.log('');
      console.log('Column verified:');
      console.log(`  Name: ${col.column_name}`);
      console.log(`  Type: ${col.data_type}`);
      console.log(`  Default: ${col.column_default}`);
      console.log(`  Nullable: ${col.is_nullable}`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Migration complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
