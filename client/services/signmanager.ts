import { adminApi } from '@/lib/api';
import type { Paged, ReportQueueItem } from '@/types';

export interface OverviewCounters {
  total_students: number;
  active_students: number;
  inactive_students: number;
  engaged_students: number;
  total_experiments_completed: number;
  total_xp_awarded: number;
  average_score: number;
  badges_unlocked: number;
}

export interface ExperimentStat {
  slug: string;
  title: string;
  lab_slug: string;
  started: number;
  completed: number;
  completion_rate: number;
  average_score: number;
  average_attempts: number;
}

export interface Overview {
  counters: OverviewCounters;
  experiments: ExperimentStat[];
}

export interface ManagedStudent {
  x_id: string;
  user_x_id: string;
  email: string | null;
  phone: string | null;
  pseudo: string | null;
  filiere: string | null;
  member_type: 'student' | 'teacher';
  reputation: number;
  whatsapp_opt_in: boolean;
  firstname: string | null;
  lastname: string | null;
  institution: string | null;
  level: string | null;
  status: boolean;
  roles: string[];
  total_xp: number;
  level_number: number;
  completed_experiments: number;
  average_score: number;
  badges: number;
  join_time: string | null;
  last_login_time: string | null;
}

export interface ManagedStudentExperiment {
  experiment_slug: string;
  experiment_title: string;
  lab_slug: string;
  status: string;
  progress: number;
  score: number;
  best_score: number;
  xp_earned: number;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface ManagedStudentDetail extends ManagedStudent {
  bio: string | null;
  experiments: ManagedStudentExperiment[];
  achievements: string[];
}

export interface StudentPage {
  items: ManagedStudent[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

export const signManagerService = {
  overview: () => adminApi.get<Overview>('/signmanager/overview'),

  students: (params: { search?: string; status?: boolean; page?: number; size?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.status !== undefined) query.set('status', String(params.status));
    query.set('page', String(params.page ?? 1));
    query.set('size', String(params.size ?? 20));
    return adminApi.get<StudentPage>(`/signmanager/students?${query.toString()}`);
  },

  student: (xId: string) => adminApi.get<ManagedStudentDetail>(`/signmanager/students/${xId}`),

  setStatus: (xId: string, status: boolean) =>
    adminApi.patch<null>(`/signmanager/students/${xId}/status`, { status }),

  setRoles: (xId: string, roles: string[]) =>
    adminApi.patch<null>(`/signmanager/students/${xId}/roles`, { roles }),

  reports: (status: 'open' | 'resolved' | 'dismissed' = 'open', page = 1) =>
    adminApi.get<Paged<ReportQueueItem>>(`/moderation/reports?status=${status}&page=${page}`),

  resolve: (targetType: ReportQueueItem['target_type'], xId: string, action: 'hide' | 'restore' | 'dismiss') =>
    adminApi.post<{ is_hidden: boolean }>(`/moderation/${targetType}/${xId}/resolve`, { action }),
};
