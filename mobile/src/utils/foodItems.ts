import type { FoodItem } from '../services/api';

/**
 * Household measures → grams. These mirror the anchors in the backend scan
 * prompt, so an item keeps the same weight whether the AI produced it or the
 * user picked it manually.
 */
export const UNIT_GRAMS: Record<string, number> = {
  katori: 180,
  roti: 40,
  cup: 150,
  piece: 50,
  tbsp: 14,
  tsp: 5,
  glass: 250,
  plate: 300,
  slice: 25,
  g: 1,
};

export const UNITS = Object.keys(UNIT_GRAMS);

/** Grams for a given quantity + unit ("g" means the quantity *is* grams). */
export function gramsFor(quantity: number, unit: string): number {
  return Math.round(quantity * (UNIT_GRAMS[unit] ?? 100));
}

/**
 * Re-scale an item to a new quantity/unit, holding its nutrition *density*
 * constant. Editing one item never touches the others — that's the whole point
 * of the per-item model: a wrong rice estimate can't corrupt a correct dal.
 */
export function rescaleItem(item: FoodItem, quantity: number, unit: string): FoodItem {
  const newGrams = gramsFor(quantity, unit);
  // Density from the original estimate; guard against a zero-gram item.
  const base = item.grams > 0 ? item.grams : 1;
  const k = newGrams / base;
  const r1 = (v: number) => Math.round(v * k * 10) / 10;
  return {
    ...item,
    quantity,
    unit,
    grams: newGrams,
    calories: Math.round(item.calories * k),
    protein_g: r1(item.protein_g),
    carbs_g: r1(item.carbs_g),
    fat_g: r1(item.fat_g),
    fiber_g: r1(item.fiber_g),
  };
}

export interface ItemTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  grams: number;
}

/** Sum a list of items. The header always shows this — never the AI's own arithmetic. */
export function sumItems(items: readonly FoodItem[]): ItemTotals {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    calories: Math.round(items.reduce((s, i) => s + i.calories, 0)),
    protein_g: r1(items.reduce((s, i) => s + i.protein_g, 0)),
    carbs_g: r1(items.reduce((s, i) => s + i.carbs_g, 0)),
    fat_g: r1(items.reduce((s, i) => s + i.fat_g, 0)),
    fiber_g: r1(items.reduce((s, i) => s + i.fiber_g, 0)),
    grams: Math.round(items.reduce((s, i) => s + i.grams, 0)),
  };
}

/** Nutrition per 100 g for foods the user can add manually. */
interface FoodDef {
  name: string;
  unit: string;
  /** per 100 g */
  kcal: number;
  p: number;
  c: number;
  f: number;
  fib: number;
}

/**
 * Common Indian foods for the "add anything we missed" flow — the AI reliably
 * misses drinks, ghee, pickles and side items at the edge of frame. Values are
 * per 100 g so any quantity/unit can be derived.
 */
export const COMMON_FOODS: readonly FoodDef[] = [
  { name: 'Roti / Chapati',      unit: 'roti',   kcal: 300, p: 8,   c: 62, f: 1.5, fib: 8 },
  { name: 'Plain rice (cooked)', unit: 'cup',    kcal: 133, p: 2.7, c: 30, f: 0.3, fib: 0.6 },
  { name: 'Dal (cooked)',        unit: 'katori', kcal: 78,  p: 5,   c: 11, f: 1.7, fib: 2.8 },
  { name: 'Curd / Dahi',         unit: 'katori', kcal: 60,  p: 3.4, c: 4.7, f: 3.3, fib: 0 },
  { name: 'Buttermilk / Chaas',  unit: 'glass',  kcal: 40,  p: 2,   c: 4,  f: 1.5, fib: 0 },
  { name: 'Milk (full fat)',     unit: 'glass',  kcal: 61,  p: 3.2, c: 4.8, f: 3.3, fib: 0 },
  { name: 'Ghee',                unit: 'tsp',    kcal: 900, p: 0,   c: 0,  f: 100, fib: 0 },
  { name: 'Cooking oil',         unit: 'tsp',    kcal: 884, p: 0,   c: 0,  f: 100, fib: 0 },
  { name: 'Paneer',              unit: 'katori', kcal: 265, p: 18,  c: 1.2, f: 21, fib: 0 },
  { name: 'Mixed veg sabzi',     unit: 'katori', kcal: 87,  p: 2,   c: 8,  f: 5.3, fib: 2.7 },
  { name: 'Chicken curry',       unit: 'katori', kcal: 155, p: 12,  c: 4.4, f: 10, fib: 0.6 },
  { name: 'Egg (boiled)',        unit: 'piece',  kcal: 155, p: 13,  c: 1.1, f: 11, fib: 0 },
  { name: 'Idli',                unit: 'piece',  kcal: 130, p: 4,   c: 27, f: 0.5, fib: 1 },
  { name: 'Dosa (plain)',        unit: 'piece',  kcal: 170, p: 4,   c: 30, f: 4,  fib: 1.5 },
  { name: 'Poha',                unit: 'katori', kcal: 139, p: 2.8, c: 25, f: 3.3, fib: 1.7 },
  { name: 'Upma',                unit: 'katori', kcal: 132, p: 3,   c: 20, f: 4.5, fib: 1.8 },
  { name: 'Paratha',             unit: 'piece',  kcal: 320, p: 7,   c: 45, f: 12, fib: 5 },
  { name: 'Samosa',              unit: 'piece',  kcal: 300, p: 5,   c: 37, f: 15, fib: 3 },
  { name: 'Salad (raw veg)',     unit: 'katori', kcal: 25,  p: 1,   c: 5,  f: 0.2, fib: 2 },
  { name: 'Pickle / Achaar',     unit: 'tsp',    kcal: 180, p: 1,   c: 10, f: 15, fib: 2 },
  { name: 'Papad (roasted)',     unit: 'piece',  kcal: 350, p: 20,  c: 55, f: 3,  fib: 10 },
  { name: 'Tea with milk+sugar', unit: 'cup',    kcal: 45,  p: 1.3, c: 6.5, f: 1.5, fib: 0 },
  { name: 'Coffee with milk',    unit: 'cup',    kcal: 50,  p: 1.5, c: 6,  f: 2,  fib: 0 },
  { name: 'Banana',              unit: 'piece',  kcal: 89,  p: 1.1, c: 23, f: 0.3, fib: 2.6 },
  { name: 'Apple',               unit: 'piece',  kcal: 52,  p: 0.3, c: 14, f: 0.2, fib: 2.4 },
  { name: 'Almonds',             unit: 'tbsp',   kcal: 579, p: 21,  c: 22, f: 50, fib: 12.5 },
  { name: 'Peanut butter',       unit: 'tbsp',   kcal: 588, p: 25,  c: 20, f: 50, fib: 6 },
  { name: 'Bread (white)',       unit: 'slice',  kcal: 265, p: 9,   c: 49, f: 3.2, fib: 2.7 },
  { name: 'Sugar',               unit: 'tsp',    kcal: 387, p: 0,   c: 100, f: 0, fib: 0 },
  { name: 'Sweet / Mithai',      unit: 'piece',  kcal: 350, p: 5,   c: 50, f: 14, fib: 1 },
];

/** Build a FoodItem from a catalogue entry at the given quantity. */
export function itemFromFood(food: FoodDef, quantity: number, unit: string): FoodItem {
  const grams = gramsFor(quantity, unit);
  const k = grams / 100;
  const r1 = (v: number) => Math.round(v * k * 10) / 10;
  return {
    name: food.name,
    quantity,
    unit,
    grams,
    calories: Math.round(food.kcal * k),
    protein_g: r1(food.p),
    carbs_g: r1(food.c),
    fat_g: r1(food.f),
    fiber_g: r1(food.fib),
  };
}
