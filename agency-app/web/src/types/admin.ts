export interface Admin {
  id: string;
  username: string;
}

export interface Area {
  areaId: string;
  name: string;
  createdAt: string;
}

export interface Building {
  buildingId: string;
  name: string;
  areaId: string;
  areaName?: string;
  createdAt: string;
}

export interface Flat {
  flatId: string;
  buildingId: string;
  flatNumber: string;
  floorNumber: number;
  createdAt: string;
}

export interface Person {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  photoS3Key?: string;
  photoUrl?: string;
  panS3Key?: string;
  panUrl?: string;
  aadharS3Key?: string;
  aadharUrl?: string;
}

export interface Owner extends Person {
  ownerId: string;
  flatId: string;
}

export interface Tenant extends Person {
  tenantId: string;
  flatId: string;
}

export interface Agreement {
  agreementId: string;
  flatId: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  depositAmount: number;
  documentS3Key?: string;
  documentUrl?: string;
  documentName?: string;
  createdAt: string;
}

export interface Verification {
  verificationId: string;
  flatId: string;
  status: 'done' | 'pending' | 'not_done';
  verificationType: 'police' | 'other';
  verificationDate?: string;
  notes?: string;
  documentS3Key?: string;
  documentUrl?: string;
  documentName?: string;
  createdAt: string;
}

export interface Document {
  documentId: string;
  flatId: string;
  documentType: string;
  s3Key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  description?: string;
  url?: string;
  createdAt: string;
}

export interface FlatDetails extends Flat {
  buildingName?: string;
  areaName?: string;
  owner: Owner | null;
  tenant: Tenant | null;
  agreements: Agreement[];
  verifications: Verification[];
  documents: Document[];
}

export interface BuildingWithFlats extends Building {
  flats: Flat[];
}

export interface DashboardMetrics {
  totalAreas: number;
  totalBuildings: number;
  totalFlats: number;
  totalOwners: number;
  totalTenants: number;
  occupiedFlats: number;
  vacantFlats: number;
}

export interface AuthResponse {
  token: string;
  user: Admin;
}

export interface SearchResults {
  buildings: Building[];
  areas: Area[];
}
