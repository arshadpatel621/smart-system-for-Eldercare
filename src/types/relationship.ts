export interface Relationship {
  id: string;
  caregiverUid: string;
  elderUid: string;
  elderId: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface RelationshipRegistryEntry extends Relationship {
  caregiverName: string;
  elderName: string;
}
