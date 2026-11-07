export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentCategoryId: string | null;
  active: boolean;
  displayOrder: number;
  imageUrl?: string;
}
