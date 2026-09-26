/**
 * Categories (global reusable dropdown option lists).
 */

export interface CategoryItem {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
}

export interface CategoryUsage {
  formCount: number;
  formNames: string[];
}

export interface Category {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  items: CategoryItem[];
  usage?: CategoryUsage;
}

export interface CategoryItemInput {
  value: string;
  label: string;
}
