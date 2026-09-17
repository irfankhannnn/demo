export interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  type: 'sale' | 'rent';
  propertyType: 'apartment' | 'house' | 'commercial' | 'plot' | 'villa' | 'penthouse' | 'studio';
  area: number; // in sq ft
  bedrooms?: number;
  bathrooms?: number;
  location: {
    area: string;
    city: string;
    pincode: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  images: string[];
  amenities: string[];
  features: string[];
  contact: {
    name: string;
    phone: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
  isVerified: boolean;
  isFeatured: boolean;
}

export interface SearchFilters {
  type?: 'sale' | 'rent';
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  bedrooms?: number;
  location?: string;
}