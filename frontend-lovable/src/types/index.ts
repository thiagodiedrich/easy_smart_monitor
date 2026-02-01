// User & Auth Types
export interface User {
  id: number;
  uuid: string;
  tenant_id: number;
  email: string;
  name: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Organization & Workspace Types
export interface Organization {
  id: number;
  uuid: string;
  tenant_id: number;
  name: string;
  description?: string;
  document?: string;
  phone?: string;
  email?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: number;
  uuid: string;
  tenant_id: number;
  organization_id: number;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface SaaSContext {
  organizationId: number;
  workspaceId: number;
  organization: Organization | null;
  workspace: Workspace | null;
  isGlobalAccess: boolean;
}

// Tenant Types
export interface Tenant {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  plan_code: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface Plan {
  code: string;
  name: string;
  description?: string;
  max_devices: number;
  max_sensors: number;
  max_users: number;
  max_organizations: number;
  max_workspaces: number;
  retention_days: number;
  price: number;
  status: 'active' | 'inactive';
}

export interface TenantLimits {
  max_devices: number;
  max_sensors: number;
  max_users: number;
  max_organizations: number;
  max_workspaces: number;
  retention_days: number;
  current_devices: number;
  current_sensors: number;
  current_users: number;
  current_organizations: number;
  current_workspaces: number;
}

export interface UsageDaily {
  date: string;
  telemetry_count: number;
  devices_active: number;
  sensors_active: number;
}

// Alert Types
export interface Alert {
  id: number;
  uuid: string;
  tenant_id: number;
  organization_id: number;
  workspace_id: number;
  name: string;
  description?: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface AlertHistory {
  id: number;
  alert_id: number;
  alert_name: string;
  triggered_at: string;
  value: number;
  status: 'triggered' | 'resolved';
}

// Webhook Types
export interface Webhook {
  id: number;
  uuid: string;
  tenant_id: number;
  organization_id: number;
  workspace_id: number;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive';
  secret?: string;
  created_at: string;
  updated_at: string;
}

// Analytics Types
export interface EquipmentStats {
  equipment_uuid: string;
  total_readings: number;
  avg_value: number;
  min_value: number;
  max_value: number;
  last_reading_at: string;
}

export interface SensorHistory {
  timestamp: string;
  value: number;
  sensor_uuid: string;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ApiError {
  message: string;
  error?: string;
  statusCode: number;
}
