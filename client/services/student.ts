import { api } from '@/lib/api';
import type { Achievement, Avatar, HistoryEntry, Progress, Student } from '@/types';

export interface UpdateProfilePayload {
  firstname?: string | null;
  lastname?: string | null;
  bio?: string | null;
  institution?: string | null;
  level?: string | null;
  filiere?: string | null;
  whatsapp_opt_in?: boolean;
}

export interface AvatarPayload {
  model?: string;
  skin?: string;
  hair?: string;
  outfit?: string;
  accessories?: string[];
}

export const studentService = {
  me: () => api.get<Student>('/students/me'),
  updateMe: (payload: UpdateProfilePayload) => api.patch<Student>('/students/me', payload),
  progress: () => api.get<Progress>('/students/me/progress'),
  achievements: () => api.get<Achievement[]>('/students/me/achievements'),
  history: (limit = 20) => api.get<HistoryEntry[]>(`/students/me/history?limit=${limit}`),

  avatar: () => api.get<Avatar>('/avatar'),
  updateAvatar: (payload: AvatarPayload) => api.patch<Avatar>('/avatar', payload),
  /** Called when the student leaves the world, so the next visit resumes in place. */
  saveTransform: (transform: {
    position_x: number;
    position_y: number;
    position_z: number;
    rotation: number;
  }) => api.put<Avatar>('/avatar/transform', transform),
};
