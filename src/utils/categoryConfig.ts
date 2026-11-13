import { CATEGORIES, type Category, type FoodType, type VendorType } from '../types';

export interface CategoryConfig {
    itemLabel: string;
    itemPlaceholder: string;
}

export const CATEGORY_CONFIG: Record<Category, CategoryConfig> = {
    Groceries: { itemLabel: 'Grocery items / Store', itemPlaceholder: 'e.g. Tomatoes, Milk, Bread' },
    'Eating Out': { itemLabel: 'Place / Dish / Drink', itemPlaceholder: 'e.g. Byrek, Espresso, Dinner' },
    'Housing & Bills': { itemLabel: 'Bill / Service name', itemPlaceholder: 'e.g. Rent, Electric bill, Internet' },
    Transport: { itemLabel: 'Route / Transit', itemPlaceholder: 'e.g. Bus, Taxi, Fuel' },
    Shopping: { itemLabel: 'Item / Store', itemPlaceholder: 'e.g. Jacket, Headphones, Home goods' },
    Personal: { itemLabel: 'Item / Service', itemPlaceholder: 'e.g. Haircut, Toiletries, Skincare' },
    'Health & Wellness': { itemLabel: 'Gym / Pharmacy / Clinic', itemPlaceholder: 'e.g. Gym membership, Vitamins, Pharmacy' },
    'Social & Fun': { itemLabel: 'Event / Activity / Place', itemPlaceholder: 'e.g. Cinema, Drinks, Concert' },
    Travel: { itemLabel: 'Destination / Booking', itemPlaceholder: 'e.g. Flight, Airbnb, Weekend trip' },
    Other: { itemLabel: 'Item name', itemPlaceholder: 'What was it?' },
};

export function normalizeCategory(
    raw?: string,
    hints?: { vendorType?: VendorType; foodType?: FoodType }
): Category {
    if (!raw) return 'Other';
    const trimmed = raw.trim();
    if (!trimmed) return 'Other';

    // 1. Exact canonical match (case-insensitive)
    const exact = CATEGORIES.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (exact) return exact;

    // 2. Legacy & cross-app keyword fallbacks
    const s = trimmed.toLowerCase();
    if (s.includes('grocer') || s.includes('supermarket') || s.includes('pazar')) {
        return 'Groceries';
    }
    if (
        s === 'food' ||
        s.includes('eating') ||
        s.includes('dining') ||
        s.includes('restaurant') ||
        s.includes('cafe') ||
        s.includes('café') ||
        s.includes('coffee') ||
        s.includes('meal')
    ) {
        if (
            hints?.vendorType === 'Supermarket' ||
            hints?.vendorType === 'Pazar' ||
            hints?.foodType === 'Grocery'
        ) {
            return 'Groceries';
        }
        return 'Eating Out';
    }
    if (
        s.includes('housing') ||
        s.includes('bill') ||
        s.includes('rent') ||
        s.includes('utility') ||
        s.includes('utilities') ||
        s.includes('subscript')
    ) {
        return 'Housing & Bills';
    }
    if (
        s.includes('transport') ||
        s.includes('taxi') ||
        s.includes('bus') ||
        s.includes('furgon') ||
        s.includes('fuel') ||
        s.includes('parking')
    ) {
        return 'Transport';
    }
    if (s.includes('shop') || s.includes('cloth') || s.includes('retail') || s.includes('gear')) {
        return 'Shopping';
    }
    if (s.includes('personal') || s.includes('toilet') || s.includes('hair') || s.includes('groom')) {
        return 'Personal';
    }
    if (
        s.includes('health') ||
        s.includes('wellness') ||
        s.includes('gym') ||
        s.includes('pharmac') ||
        s.includes('doctor') ||
        s.includes('medical')
    ) {
        return 'Health & Wellness';
    }
    if (
        s.includes('social') ||
        s.includes('fun') ||
        s.includes('party') ||
        s.includes('drinks') ||
        s.includes('entertain') ||
        s.includes('movie') ||
        s.includes('cinema') ||
        s.includes('concert')
    ) {
        return 'Social & Fun';
    }
    if (
        s.includes('travel') ||
        s.includes('trip') ||
        s.includes('flight') ||
        s.includes('train') ||
        s.includes('accommod') ||
        s.includes('hotel') ||
        s.includes('hostel') ||
        s.includes('airbnb') ||
        s.includes('lodging')
    ) {
        return 'Travel';
    }

    return 'Other';
}

export function getSubcategories(category: Category): string[] {
    switch (category) {
        case 'Housing & Bills':
            return ['Rent', 'Electricity', 'Water', 'Internet', 'Phone', 'Subscriptions'];
        case 'Transport':
            return ['Bus', 'Furgon', 'Taxi', 'Fuel', 'Parking'];
        case 'Health & Wellness':
            return ['Gym', 'Pharmacy', 'Doctor / Dental', 'Supplements'];
        case 'Social & Fun':
            return ['Drinks / Bar', 'Cinema', 'Concert', 'Sports', 'Hobby'];
        case 'Travel':
            return ['Accommodation', 'Flight / Train', 'Activity', 'Trip Food'];
        default:
            return [];
    }
}

export function getVendorOptions(category: Category, _subcategory?: string): VendorType[] {
    if (category === 'Groceries') {
        return ['Pazar', 'Supermarket', 'Bakery', 'Other'];
    }
    if (category === 'Eating Out') {
        return ['Café', 'Restaurant', 'Bakery', 'Other'];
    }
    return [];
}

export function showFoodDetails(category: Category): boolean {
    return category === 'Groceries' || category === 'Eating Out';
}