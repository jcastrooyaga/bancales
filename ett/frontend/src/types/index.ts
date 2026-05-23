export type Role = 'ADMIN' | 'REQUESTER' | 'VALIDATOR' | 'SUPERVALIDATOR' | 'READONLY';
export type RequestStatus = 'DRAFT' | 'SUBMITTED' | 'IN_VALIDATION' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  active?: boolean;
}

export interface Workplace { id: string; code: string; name: string; active: boolean; }
export interface ContractType { id: string; code: string; name: string; active: boolean; }
export interface JobCategory { id: string; code: string; name: string; active: boolean; }
export interface RequestReason { id: string; code: string; name: string; active: boolean; }
export interface Shift { id: string; code: string; name: string; active: boolean; }
export interface Ett { id: string; code: string; name: string; contactEmail?: string; active: boolean; emailRouting?: EttEmailRouting[]; }
export interface EttEmailRouting { id: string; ettId: string; email: string; active: boolean; }

export interface ValidationStep {
  id: string;
  order: number;
  validatorId: string;
  validator: Pick<User, 'id' | 'name' | 'email'>;
  backup?: Pick<User, 'id' | 'name' | 'email'>;
  timeoutHours: number;
}

export interface ValidationCircuit {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  steps: ValidationStep[];
}

export interface Request {
  id: string;
  code: string;
  requesterId: string;
  requester?: Pick<User, 'id' | 'name' | 'email'>;
  workplaceId: string;
  workplace?: Workplace;
  ettId: string;
  ett?: Ett;
  contractTypeId: string;
  contractType?: ContractType;
  jobCategoryId: string;
  jobCategory?: JobCategory;
  requestReasonId: string;
  requestReason?: RequestReason;
  shiftId: string;
  shift?: Shift;
  circuitId?: string;
  circuit?: ValidationCircuit;
  status: RequestStatus;
  startDate: string;
  endDate?: string;
  headcount: number;
  notes?: string;
  rejectionReason?: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  currentStep?: number;
  isRenewal: boolean;
  createdAt: string;
}

export interface Stats {
  total: number;
  submitted: number;
  approved: number;
  rejected: number;
  pending: number;
}
