/**
 * Fallback Classic Recipes for Onboarding
 *
 * Used when the API call to /api/recipes/classics fails.
 * Contains 15 of the most popular cocktails with pre-computed
 * 'requires' arrays for element matching.
 */

import type { ClassicRecipe } from '@/lib/api';

export const fallbackRecipes: ClassicRecipe[] = [
  {
    name: 'Old Fashioned',
    ingredients: [
      '2 oz Bourbon or rye whiskey',
      '1 Sugar cube',
      '2-3 dashes Angostura bitters',
      'Orange peel for garnish',
    ],
    instructions:
      'Place sugar cube in rocks glass. Saturate with bitters and a splash of water. Muddle until dissolved. Add whiskey and a large ice cube. Stir gently. Express orange peel over the glass and drop in as garnish.',
    glass: 'Rocks',
    spirit_type: 'whiskey',
    requires: ['Bb'],
  },
  {
    name: 'Margarita',
    ingredients: [
      '2 oz Tequila blanco',
      '1 oz Fresh lime juice',
      '1/2 oz Triple sec or Cointreau',
      '1/2 oz Agave syrup',
      'Salt for rim (optional)',
    ],
    instructions:
      'If desired, rim a rocks glass with salt. Add tequila, lime juice, triple sec, and agave to a shaker with ice. Shake well. Strain into the prepared glass over fresh ice.',
    glass: 'Rocks',
    spirit_type: 'tequila',
    requires: ['Tq', 'Ol', 'Li'],
  },
  {
    name: 'Negroni',
    ingredients: [
      '1 oz Gin',
      '1 oz Campari',
      '1 oz Sweet vermouth',
      'Orange peel for garnish',
    ],
    instructions:
      'Add gin, Campari, and vermouth to a mixing glass with ice. Stir until well-chilled. Strain into a rocks glass over a large ice cube. Express orange peel and drop in as garnish.',
    glass: 'Rocks',
    spirit_type: 'gin',
    requires: ['Gn', 'Cp', 'Sv'],
  },
  {
    name: 'Daiquiri',
    ingredients: ['2 oz White rum', '1 oz Fresh lime juice', '3/4 oz Simple syrup'],
    instructions:
      'Add all ingredients to a shaker with ice. Shake vigorously until well-chilled. Strain into a chilled coupe glass.',
    glass: 'Coupe',
    spirit_type: 'rum',
    requires: ['Rm', 'Li'],
  },
  {
    name: 'Manhattan',
    ingredients: [
      '2 oz Rye whiskey',
      '1 oz Sweet vermouth',
      '2 dashes Angostura bitters',
      'Luxardo cherry for garnish',
    ],
    instructions:
      'Add whiskey, vermouth, and bitters to a mixing glass with ice. Stir until well-chilled, about 30 seconds. Strain into a chilled coupe or martini glass. Garnish with a cherry.',
    glass: 'Coupe',
    spirit_type: 'whiskey',
    requires: ['Ry', 'Sv'],
  },
  {
    name: 'Martini',
    ingredients: [
      '2 1/2 oz Gin or vodka',
      '1/2 oz Dry vermouth',
      'Lemon twist or olive for garnish',
    ],
    instructions:
      'Add gin and vermouth to a mixing glass with ice. Stir until very cold, about 30 seconds. Strain into a chilled martini glass. Garnish with a lemon twist or olives.',
    glass: 'Martini',
    spirit_type: 'gin',
    requires: ['Gn', 'Dv'],
  },
  {
    name: 'Whiskey Sour',
    ingredients: [
      '2 oz Bourbon whiskey',
      '3/4 oz Fresh lemon juice',
      '1/2 oz Simple syrup',
      '1/2 oz Egg white (optional)',
      'Angostura bitters for garnish',
    ],
    instructions:
      'Add all ingredients to a shaker. Dry shake without ice for 15 seconds if using egg white. Add ice and shake vigorously. Strain into a rocks glass over fresh ice. Dash bitters on top of foam.',
    glass: 'Rocks',
    spirit_type: 'whiskey',
    requires: ['Bb', 'Le'],
  },
  {
    name: 'Moscow Mule',
    ingredients: [
      '2 oz Vodka',
      '1/2 oz Fresh lime juice',
      '4 oz Ginger beer',
      'Lime wheel for garnish',
    ],
    instructions:
      'Add vodka and lime juice to a copper mug or highball glass filled with ice. Top with ginger beer. Stir gently. Garnish with a lime wheel.',
    glass: 'Copper Mug',
    spirit_type: 'vodka',
    requires: ['Vd', 'Gb', 'Li'],
  },
  {
    name: 'Mojito',
    ingredients: [
      '2 oz White rum',
      '1 oz Fresh lime juice',
      '3/4 oz Simple syrup',
      '6-8 Fresh mint leaves',
      'Club soda to top',
    ],
    instructions:
      'Gently muddle mint leaves with simple syrup in a highball glass. Add rum and lime juice. Fill with ice and top with club soda. Stir gently. Garnish with a sprig of mint.',
    glass: 'Highball',
    spirit_type: 'rum',
    requires: ['Rm', 'Mt', 'Li'],
  },
  {
    name: 'Espresso Martini',
    ingredients: [
      '2 oz Vodka',
      '1 oz Fresh espresso (cooled)',
      '1/2 oz Coffee liqueur',
      '1/2 oz Simple syrup',
      '3 coffee beans for garnish',
    ],
    instructions:
      'Add vodka, espresso, coffee liqueur, and simple syrup to a shaker with ice. Shake vigorously until very cold and frothy. Strain into a chilled martini glass. Garnish with coffee beans.',
    glass: 'Martini',
    spirit_type: 'vodka',
    requires: ['Vd', 'Cf'],
  },
  {
    name: 'Aperol Spritz',
    ingredients: [
      '3 oz Prosecco',
      '2 oz Aperol',
      '1 oz Club soda',
      'Orange slice for garnish',
    ],
    instructions:
      'Fill a wine glass with ice. Add Prosecco, then Aperol. Top with club soda. Stir gently. Garnish with an orange slice.',
    glass: 'Wine Glass',
    spirit_type: 'aperitif',
    requires: ['Ap', 'Sp'],
  },
  {
    name: 'Paloma',
    ingredients: [
      '2 oz Tequila blanco',
      '1/2 oz Fresh lime juice',
      'Grapefruit soda to top',
      'Pinch of salt',
      'Lime wheel for garnish',
    ],
    instructions:
      'Add tequila, lime juice, and salt to a highball glass with ice. Top with grapefruit soda. Stir gently to combine. Garnish with a lime wheel.',
    glass: 'Highball',
    spirit_type: 'tequila',
    requires: ['Tq', 'Li', 'Gf'],
  },
  {
    name: 'Cosmopolitan',
    ingredients: [
      '1 1/2 oz Vodka',
      '1 oz Triple sec or Cointreau',
      '1/2 oz Fresh lime juice',
      '1/2 oz Cranberry juice',
      'Lime wheel for garnish',
    ],
    instructions:
      'Add all ingredients to a shaker with ice. Shake well until chilled. Strain into a chilled martini glass. Garnish with a lime wheel.',
    glass: 'Martini',
    spirit_type: 'vodka',
    requires: ['Vd', 'Ol', 'Li'],
  },
  {
    name: 'Boulevardier',
    ingredients: [
      '1 1/4 oz Bourbon',
      '1 oz Campari',
      '1 oz Sweet vermouth',
      'Orange peel for garnish',
    ],
    instructions:
      'Add bourbon, Campari, and vermouth to a mixing glass with ice. Stir until well-chilled. Strain into a rocks glass over a large ice cube. Express orange peel and garnish.',
    glass: 'Rocks',
    spirit_type: 'whiskey',
    requires: ['Bb', 'Cp', 'Sv'],
  },
  {
    name: 'French 75',
    ingredients: [
      '1 oz Gin',
      '1/2 oz Fresh lemon juice',
      '1/2 oz Simple syrup',
      '3 oz Champagne or sparkling wine',
      'Lemon twist for garnish',
    ],
    instructions:
      'Add gin, lemon juice, and simple syrup to a shaker with ice. Shake well. Strain into a champagne flute. Top with champagne. Garnish with a lemon twist.',
    glass: 'Champagne Flute',
    spirit_type: 'gin',
    requires: ['Gn', 'Sp', 'Le'],
  },
];
