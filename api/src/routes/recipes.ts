import { Router, Request, Response } from 'express';
import { db } from '../database/db';
import { authMiddleware } from '../middleware/auth';
import { Recipe } from '../types';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/recipes - Get all recipes for user
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const recipes = db.prepare(
      'SELECT * FROM recipes WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as Recipe[];

    // Parse ingredients JSON string
    const parsedRecipes = recipes.map(recipe => ({
      ...recipe,
      ingredients: typeof recipe.ingredients === 'string'
        ? JSON.parse(recipe.ingredients)
        : recipe.ingredients
    }));

    res.json({
      success: true,
      data: parsedRecipes
    });
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recipes'
    });
  }
});

// POST /api/recipes - Add new recipe
router.post('/', (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const recipe: Recipe = req.body;

    // Validation
    if (!recipe.name) {
      return res.status(400).json({
        success: false,
        error: 'Recipe name is required'
      });
    }

    // Stringify ingredients if it's an array/object
    const ingredientsStr = typeof recipe.ingredients === 'string'
      ? recipe.ingredients
      : JSON.stringify(recipe.ingredients);

    // Insert recipe
    const result = db.prepare(`
      INSERT INTO recipes (
        user_id, name, ingredients, instructions, glass, category
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      recipe.name,
      ingredientsStr,
      recipe.instructions || null,
      recipe.glass || null,
      recipe.category || null
    );

    const recipeId = result.lastInsertRowid as number;

    // Get created recipe
    const createdRecipe = db.prepare(
      'SELECT * FROM recipes WHERE id = ?'
    ).get(recipeId) as Recipe;

    // Parse ingredients
    const parsedRecipe = {
      ...createdRecipe,
      ingredients: JSON.parse(createdRecipe.ingredients as string)
    };

    res.status(201).json({
      success: true,
      data: parsedRecipe
    });
  } catch (error) {
    console.error('Add recipe error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add recipe'
    });
  }
});

// POST /api/recipes/import - CSV import (placeholder)
router.post('/import', (req: Request, res: Response) => {
  // TODO: Implement CSV import
  res.status(501).json({
    success: false,
    error: 'CSV import not yet implemented'
  });
});

export default router;
