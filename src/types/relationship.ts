export interface Relationship {
  id: string;
  caregiverUid: string;
  elderUid: string;
  elderId: string;
  status: 'active' | 'inactive';
  createdAt: string;
}
