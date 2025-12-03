#!/usr/bin/env ts-node
/**
 * Database Backup Script
 *
 * Creates timestamped backups of the SQLite database with optional compression.
 *
 * Features:
 * - Timestamped backup files (alchemix-backup-2025-01-15T10-30-00.db)
 * - Optional gzip compression (--compress flag)
 * - Configurable retention (--keep=N to keep last N backups)
 * - Integrity verification after backup
 * - Works with both development and production databases
 *
 * Usage:
 *   npx ts-node scripts/backup-database.ts                    # Basic backup
 *   npx ts-node scripts/backup-database.ts --compress         # Compressed backup
 *   npx ts-node scripts/backup-database.ts --keep=7           # Keep last 7 backups
 *   npx ts-node scripts/backup-database.ts --output=/backups  # Custom output directory
 *
 * Cron Example (daily backup at 2am):
 *   0 2 * * * cd /path/to/alchemix/api && npx ts-node scripts/backup-database.ts --compress --keep=30
 *
 * Restore:
 *   cp backups/alchemix-backup-2025-01-15T10-30-00.db data/alchemix.db
 *   # or for compressed:
 *   gunzip -c backups/alchemix-backup-2025-01-15T10-30-00.db.gz > data/alchemix.db
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';

// Parse command line arguments
const args = process.argv.slice(2);
const compress = args.includes('--compress');
const keepArg = args.find(a => a.startsWith('--keep='));
const keepCount = keepArg ? parseInt(keepArg.split('=')[1], 10) : undefined;
const outputArg = args.find(a => a.startsWith('--output='));
const outputDir = outputArg ? outputArg.split('=')[1] : path.join(__dirname, '../backups');

// Database paths
const dataDir = process.env.DATABASE_PATH
  ? path.dirname(process.env.DATABASE_PATH)
  : path.join(__dirname, '../data');
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'alchemix.db');

/**
 * Generate timestamped backup filename
 */
function generateBackupFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, '')
    .replace('T', 'T');
  return `alchemix-backup-${timestamp}.db`;
}

/**
 * Verify database integrity
 */
function verifyIntegrity(dbPath: string): boolean {
  try {
    const db = new Database(dbPath, { readonly: true });
    const result = db.pragma('integrity_check') as { integrity_check: string }[];
    db.close();
    return result[0]?.integrity_check === 'ok';
  } catch (error) {
    return false;
  }
}

/**
 * Get database statistics
 */
function getDbStats(dbPath: string): { tables: number; totalRows: number } {
  try {
    const db = new Database(dbPath, { readonly: true });

    // Get table names
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[];

    // Count rows in each table
    let totalRows = 0;
    for (const table of tables) {
      const count = db.prepare(`SELECT COUNT(*) as count FROM "${table.name}"`).get() as { count: number };
      totalRows += count.count;
    }

    db.close();
    return { tables: tables.length, totalRows };
  } catch (error) {
    return { tables: 0, totalRows: 0 };
  }
}

/**
 * Clean up old backups, keeping only the most recent N
 */
function cleanupOldBackups(dir: string, keep: number): number {
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('alchemix-backup-') && (f.endsWith('.db') || f.endsWith('.db.gz')))
    .map(f => ({
      name: f,
      path: path.join(dir, f),
      mtime: fs.statSync(path.join(dir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.mtime - a.mtime); // Newest first

  let deleted = 0;
  if (files.length > keep) {
    const toDelete = files.slice(keep);
    for (const file of toDelete) {
      fs.unlinkSync(file.path);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Main backup function
 */
async function backup(): Promise<void> {
  console.log('='.repeat(60));
  console.log('AlcheMix Database Backup');
  console.log('='.repeat(60));
  console.log('');

  // Check source database exists
  if (!fs.existsSync(dbPath)) {
    console.error(`ERROR: Database not found at ${dbPath}`);
    console.error('Make sure the database exists before running backup.');
    process.exit(1);
  }

  // Create output directory if needed
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created backup directory: ${outputDir}`);
  }

  // Get source stats
  const sourceStats = fs.statSync(dbPath);
  const dbStats = getDbStats(dbPath);

  console.log('Source Database:');
  console.log(`  Path: ${dbPath}`);
  console.log(`  Size: ${formatSize(sourceStats.size)}`);
  console.log(`  Tables: ${dbStats.tables}`);
  console.log(`  Total rows: ${dbStats.totalRows.toLocaleString()}`);
  console.log('');

  // Generate backup path
  const backupFilename = generateBackupFilename();
  const backupPath = path.join(outputDir, backupFilename);

  console.log('Creating backup...');

  // Use SQLite's backup API via better-sqlite3 for safe hot backup
  const sourceDb = new Database(dbPath, { readonly: true });
  sourceDb.backup(backupPath)
    .then(() => {
      sourceDb.close();

      // Verify backup integrity
      console.log('Verifying backup integrity...');
      if (!verifyIntegrity(backupPath)) {
        console.error('ERROR: Backup failed integrity check!');
        fs.unlinkSync(backupPath);
        process.exit(1);
      }

      let finalPath = backupPath;
      let finalSize = fs.statSync(backupPath).size;

      // Compress if requested
      if (compress) {
        console.log('Compressing backup...');
        try {
          // Use gzip command (available on most systems)
          execSync(`gzip "${backupPath}"`, { stdio: 'pipe' });
          finalPath = `${backupPath}.gz`;
          finalSize = fs.statSync(finalPath).size;
          console.log(`  Compression ratio: ${((1 - finalSize / sourceStats.size) * 100).toFixed(1)}%`);
        } catch (error) {
          console.warn('Warning: gzip not available, saving uncompressed backup');
        }
      }

      console.log('');
      console.log('Backup Complete:');
      console.log(`  File: ${path.basename(finalPath)}`);
      console.log(`  Path: ${finalPath}`);
      console.log(`  Size: ${formatSize(finalSize)}`);

      // Cleanup old backups if requested
      if (keepCount && keepCount > 0) {
        console.log('');
        console.log(`Cleaning up old backups (keeping last ${keepCount})...`);
        const deleted = cleanupOldBackups(outputDir, keepCount);
        if (deleted > 0) {
          console.log(`  Deleted ${deleted} old backup(s)`);
        } else {
          console.log('  No old backups to delete');
        }
      }

      // List current backups
      console.log('');
      console.log('Current backups:');
      const backups = fs.readdirSync(outputDir)
        .filter(f => f.startsWith('alchemix-backup-'))
        .sort()
        .reverse();

      for (const backup of backups.slice(0, 5)) {
        const stats = fs.statSync(path.join(outputDir, backup));
        console.log(`  ${backup} (${formatSize(stats.size)})`);
      }
      if (backups.length > 5) {
        console.log(`  ... and ${backups.length - 5} more`);
      }

      console.log('');
      console.log('='.repeat(60));
      console.log('Backup successful!');
      console.log('='.repeat(60));
    })
    .catch((error) => {
      sourceDb.close();
      console.error('ERROR: Backup failed:', error.message);
      process.exit(1);
    });
}

// Run backup
backup().catch(error => {
  console.error('Backup failed:', error);
  process.exit(1);
});
