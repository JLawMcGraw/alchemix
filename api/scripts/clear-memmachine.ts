/**
 * Clear MemMachine Recipe Memories Script
 *
 * Utility script to clear all recipe memories from MemMachine for a specific user.
 * Run this when you want to start fresh with UUID tracking.
 *
 * Usage:
 *   npm run clear-memmachine -- --userId=1
 */

import { memoryService } from '../src/services/MemoryService';

async function clearMemMachineRecipes() {
  // Get userId from command line arguments
  const args = process.argv.slice(2);
  const userIdArg = args.find(arg => arg.startsWith('--userId='));

  if (!userIdArg) {
    console.error('❌ Error: Please provide --userId argument');
    console.log('Usage: npm run clear-memmachine -- --userId=1');
    process.exit(1);
  }

  const userId = parseInt(userIdArg.split('=')[1], 10);

  if (isNaN(userId) || userId <= 0) {
    console.error('❌ Error: Invalid userId. Must be a positive integer.');
    process.exit(1);
  }

  console.log(`🧹 Clearing all MemMachine recipe memories for user ${userId}...`);
  console.log('⚠️  WARNING: This will delete ALL recipes from MemMachine (not from AlcheMix DB)');
  console.log('');

  try {
    const success = await memoryService.deleteAllRecipeMemories(userId);

    if (success) {
      console.log('');
      console.log('✅ SUCCESS! All recipe memories cleared from MemMachine');
      console.log('');
      console.log('Next steps:');
      console.log('1. Re-import your recipes via CSV');
      console.log('2. UUIDs will be captured automatically');
      console.log('3. Future deletions will work properly');
      process.exit(0);
    } else {
      console.error('');
      console.error('❌ FAILED to clear MemMachine memories');
      console.error('Check that MemMachine service is running on port 8080');
      process.exit(1);
    }
  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error);
    process.exit(1);
  }
}

// Run the script
clearMemMachineRecipes();
