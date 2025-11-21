/**
 * Remove Duplicate Bottles Script
 *
 * This script removes duplicate bottle entries from the database.
 * It keeps the most recently created entry for each bottle name
 * and removes all older duplicates.
 *
 * Usage: node remove-duplicates.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'alchemix.db');
const db = new Database(dbPath);

console.log('🔍 Scanning for duplicate bottles...\n');

// Find all duplicates
const duplicates = db.prepare(`
  SELECT name, COUNT(*) as count
  FROM bottles
  GROUP BY name
  HAVING count > 1
  ORDER BY count DESC
`).all();

console.log(`Found ${duplicates.length} bottle names with duplicates:`);
duplicates.forEach(dup => {
  console.log(`  - "${dup.name}" (${dup.count} copies)`);
});
console.log('');

if (duplicates.length === 0) {
  console.log('✅ No duplicates found! Your inventory is clean.');
  db.close();
  process.exit(0);
}

console.log('🗑️  Removing duplicates (keeping most recent entry for each)...\n');

let totalRemoved = 0;

// For each duplicate name, keep the most recent (highest id) and delete the rest
for (const dup of duplicates) {
  const bottleName = dup.name;

  // Get all IDs for this bottle name, ordered by ID (most recent last)
  const bottles = db.prepare(`
    SELECT id, created_at, name
    FROM bottles
    WHERE name = ?
    ORDER BY id ASC
  `).all(bottleName);

  // Keep the last one (most recent), delete the others
  const toDelete = bottles.slice(0, -1);

  console.log(`📦 "${bottleName}": Keeping ID ${bottles[bottles.length - 1].id}, removing ${toDelete.length} duplicate(s)`);

  for (const bottle of toDelete) {
    db.prepare('DELETE FROM bottles WHERE id = ?').run(bottle.id);
    totalRemoved++;
  }
}

console.log('');
console.log(`✅ Removed ${totalRemoved} duplicate bottles`);

// Verify results
const finalCount = db.prepare('SELECT COUNT(*) as count FROM bottles').get();
const uniqueCount = db.prepare('SELECT COUNT(DISTINCT name) as count FROM bottles').get();

console.log('');
console.log('📊 Final Results:');
console.log(`  - Total bottles: ${finalCount.count}`);
console.log(`  - Unique bottle names: ${uniqueCount.count}`);
console.log(`  - Duplicates remaining: ${finalCount.count - uniqueCount.count}`);

if (finalCount.count === uniqueCount.count) {
  console.log('');
  console.log('🎉 Success! All duplicates removed. Your inventory is now clean.');
} else {
  console.log('');
  console.log('⚠️  Warning: Some duplicates may still remain. This could happen if bottles have identical names but different data.');
}

db.close();
console.log('');
console.log('Done! You can now refresh your browser to see the updated inventory.');
