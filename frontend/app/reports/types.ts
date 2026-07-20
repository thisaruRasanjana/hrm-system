export type ReportPeriod = "weekly" | "monthly" | "annually" | "custom";
export type DetailTab = "attendance" | "leave" | "violations";

export interface EmployeeDetail {
  id: string;
  name: string;
  employeeCode: string;
  department: string;
  position: string;
  manager: string;
  joinDate: string;
  attendanceRate: number;
  absentDays: number;
  lateArrivals: number;
  totalViolations: number;
}

export interface EmployeeReportRow {
  id: string;
  name: string;
  employeeCode: string;
  role: string;
  department: string;
  totalLeave: number;
  used: number;
  pending: number;
  remaining: number;
  lastLeave: string;
}

export interface AttendanceRecord {
  employeeName: string;
  employeeCode: string;
  department: string;
  present: number;
  absent: number;
  totalDays: number;
  rate: number;
  trend: string;
}

export interface LeaveHistoryRecord {
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  created_at?: string;
}

export interface SummaryCardItem {
  label: string;
  value: number;
}

export interface ViolationRecord {
  title: string;
  date: string;
  description: string;
  severity: string;
}