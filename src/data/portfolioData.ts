export interface GalleryItem {
  id: string;
  title: string;
  category: string;
  type: string;
  image_url: string;
  thumbnail_url: string;
  description: string;
  year: string;
  width: number;
  height: number;
  order: number;
}

export const mockGalleryItems: GalleryItem[] = [
  {
    id: 'mock-1',
    title: 'KeenVi Studio Branding',
    category: 'Branding',
    type: 'portfolio',
    image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200',
    thumbnail_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600',
    description: 'A mock project for testing while database is unavailable.',
    year: '2024',
    width: 1200,
    height: 800,
    order: 0
  },
  {
    id: 'mock-2',
    title: 'Abstract Motion',
    category: 'Motion',
    type: 'portfolio',
    image_url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=1200',
    thumbnail_url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=600',
    description: 'Dynamic motion graphics exploration.',
    year: '2024',
    width: 1200,
    height: 1600,
    order: 1
  },
  {
    id: 'mock-3',
    title: 'UX Case Study',
    category: 'UI/UX',
    type: 'project',
    image_url: 'https://images.unsplash.com/photo-1586717791821-3f44a563eb4c?auto=format&fit=crop&q=80&w=1200',
    thumbnail_url: 'https://images.unsplash.com/photo-1586717791821-3f44a563eb4c?auto=format&fit=crop&q=80&w=600',
    description: 'In-depth look at a user-centric design process.',
    year: '2023',
    width: 1200,
    height: 900,
    order: 2
  }
];
