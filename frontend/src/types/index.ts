export interface User {
  id: string;
  email: string;
  role: 'admin' | 'employee';
  fullName: string | null;
  avatar: string | null;
}

export interface Employee {
  fullName: string;
  department: string | null;
}

export interface AttendanceLog {
  id: string;
  fullName: string;
  date: string;
  rawValue: string;
  status: AttendanceStatus;
}

export type AttendanceStatus =
  | 'normal'
  | 'late'
  | 'early_leave'
  | 'missing_check_in'
  | 'missing_check_out'
  | 'absent'
  | 'holiday';

export interface DashboardStats {
  normal: number;
  late: number;
  earlyLeave: number;
  missingCheckIn: number;
  missingCheckOut: number;
  holiday: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
