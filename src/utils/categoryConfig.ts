import { type Category, type VendorType } from '../types';

export interface CategoryConfig {
    itemLabel: string;
    itemPlaceholder: string;
}

export const CATEGORY_CONFIG: Record<Category, CategoryConfig> = {
    Food: { itemLabel: 'Food item / Place name', itemPlaceholder: 'e.g. Tomatoes, Byrek' },
    Utilities: { itemLabel: 'Utility name', itemPlaceholder: 'e.g. Electric bill, Phone data' },
    Transport: { itemLabel: 'Destination / Route', itemPlaceholder: 'e.g. Tirana -> Peshkopi' },
    Social: { itemLabel: 'Event / Place', itemPlaceholder: 'e.g. Movie, Drinks' },
    Travel: { itemLabel: 'Location / Item', itemPlaceholder: 'e.g. Hostel, Train ticket' },
    Accommodation: { itemLabel: 'Hotel / Airbnb / Rent', itemPlaceholder: 'e.g. Hostel booking, Hotel room' },
    Entertainment: { itemLabel: 'Show / Attraction', itemPlaceholder: 'e.g. Movie, Concert ticket, Museum' },
    Other: { itemLabel: 'Item name', itemPlaceholder: 'What was it?' },
};

export function getSubcategories(category: Category): string[] {
    switch (category) {
        case 'Utilities':
            return ['Electricity', 'Water', 'Internet', 'Phone', 'Gas'];
        case 'Transport':
            return ['Furgon', 'Bus', 'Taxi', 'Train', 'Flight'];
        case 'Travel':
            return ['Accommodation', 'Transport', 'Activity', 'Food'];
        case 'Accommodation':
            return ['Hostel', 'Hotel', 'Airbnb', 'Rent'];
        case 'Entertainment':
            return ['Cinema', 'Concert', 'Museum', 'Theater', 'Sports'];
        default:
            return [];
    }
}

export function getVendorOptions(category: Category, _subcategory?: string): VendorType[] {
    if (category === 'Food') {
        return ['Pazar', 'Supermarket', 'Café', 'Bakery', 'Restaurant', 'Other'];
    }
    return [];
}

export function showFoodDetails(category: Category): boolean {
    return category === 'Food';
}