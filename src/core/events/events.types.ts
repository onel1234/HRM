export interface UserCreatedEvent {
  userId: string;
  companyId: string;
  role: string;
}

export interface UserLoggedInEvent {
  userId: string;
  companyId: string;
}

export interface CompanyCreatedEvent {
  companyId: string;
}

export interface PayrollProcessedEvent {
  companyId: string;
  payrollRunId: string;
  period: string;
  totalEmployees: number;
}

export interface LeaveApprovedEvent {
  companyId: string;
  employeeId: string;
  leaveId: string;
  type: string;
  startDate: Date;
  endDate: Date;
}

export interface EmployeeJoinedEvent {
  companyId: string;
  employeeId: string;
  departmentId?: string;
  role: string;
  joinDate: Date;
}

export interface EmployeeSeparatedEvent {
  companyId: string;
  employeeId: string;
  reason: string;
  separationDate: Date;
}

export interface DepartmentChangedEvent {
  companyId: string;
  departmentId: string;
}

export interface EmployeeChangedEvent {
  companyId: string;
  employeeId: string;
}

export interface EmployeeDocumentChangedEvent {
  companyId: string;
  employeeId: string;
  documentId: string;
  type?: string;
}

export interface EmployeeProbationReviewedEvent {
  companyId: string;
  employeeId: string;
  outcome: string;
}
