/**
 * Seed MemMachine with Existing User Recipes
 *
 * Run this script to populate MemMachine with all existing recipes from the database.
 * This enables the AI to use semantic search over your recipe collection.
 *
 * IMPORTANT: Each user's recipes are stored in isolated namespaces (user_1, user_2, etc.)
 * User 1 cannot see User 2's recipes - complete data isolation!
 *
 * Usage:
 *   npx tsx src/scripts/seed-memmachine.ts
 */

// Load environment variables first
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { queryAll } from '../database/db';
import { memoryService } from '../services/MemoryService';

async function seedMemMachine() {
  console.log('🌱 Starting MemMachine seeding process...\n');

  try {
    // Get all users
    const users = await queryAll<{ id: number; email: string }>('SELECT id, email FROM users');

    console.log(`📊 Found ${users.length} users in database\n`);

    for (const user of users) {
      console.log(`👤 Processing user ${user.id} (${user.email})...`);

      // Get all recipes for this user
      const recipes = await queryAll<{ name: string; ingredients: string; instructions?: string; glass?: string; category?: string }>(
        'SELECT * FROM recipes WHERE user_id = $1 ORDER BY name',
        [user.id]
      );

      console.log(`   📚 Found ${recipes.length} recipes`);

      let successCount = 0;
      let errorCount = 0;

      // Store each recipe in MemMachine
      for (const recipe of recipes) {
        try {
          await memoryService.storeUserRecipe(user.id, {
            name: recipe.name,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            glass: recipe.glass,
            category: recipe.category,
          });
          successCount++;

          // Log progress every 10 recipes
          if (successCount % 10 === 0) {
            console.log(`   ✅ Stored ${successCount}/${recipes.length} recipes...`);
          }
        } catch (error) {
          errorCount++;
          console.error(`   ❌ Failed to store recipe "${recipe.name}":`, error instanceof Error ? error.message : error);
        }
      }

      console.log(`   ✅ Successfully stored ${successCount} recipes`);
      if (errorCount > 0) {
        console.log(`   ⚠️  Failed to store ${errorCount} recipes`);
      }
      console.log('');
    }

    console.log('🎉 MemMachine seeding complete!\n');
    console.log('You can now use the AI Bartender with full semantic search over your recipes.');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeding function
seedMemMachine()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
