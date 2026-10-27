import { api } from '@/lib/api';
import type {
  CommunityMeta,
  Paged,
  QuestionDetail,
  QuestionSummary,
  ReportReason,
  ResourceItem,
} from '@/types';

export type QuestionSort = 'recent' | 'votes' | 'active' | 'unanswered';

export interface QuestionFilters {
  filiere?: string;
  subject?: string;
  tag?: string;
  q?: string;
  sort?: QuestionSort;
  page?: number;
}

export interface AskPayload {
  title: string;
  body: string;
  filiere: string;
  subject?: string;
  tags: string[];
  image_url?: string;
}

export interface ResourcePayload {
  title: string;
  url: string;
  filiere: string;
  subject?: string;
  source?: string;
  description?: string;
}

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const communityService = {
  meta: () => api.get<CommunityMeta>('/community/meta'),

  questions: (filters: QuestionFilters) =>
    api.get<Paged<QuestionSummary>>(`/community/questions${query(filters)}`),
  question: (xId: string) => api.get<QuestionDetail>(`/community/questions/${xId}`),
  ask: (payload: AskPayload) => api.post<{ x_id: string }>('/community/questions', payload),
  deleteQuestion: (xId: string) => api.delete<null>(`/community/questions/${xId}`),

  answer: (questionXId: string, body: string) =>
    api.post<{ x_id: string }>(`/community/questions/${questionXId}/answers`, { body }),
  accept: (questionXId: string, answerXId: string) =>
    api.post<null>(`/community/questions/${questionXId}/accept/${answerXId}`),
  endorse: (answerXId: string) =>
    api.post<{ teacher_endorsed: boolean }>(`/community/answers/${answerXId}/endorse`),

  vote: (targetType: 'question' | 'answer', targetXId: string, value: -1 | 0 | 1) =>
    api.post<{ score: number; my_vote: number }>('/community/votes', {
      target_type: targetType,
      target_x_id: targetXId,
      value,
    }),

  resources: (filters: { filiere?: string; subject?: string; q?: string; page?: number }) =>
    api.get<Paged<ResourceItem>>(`/community/resources${query(filters)}`),
  shareResource: (payload: ResourcePayload) =>
    api.post<{ x_id: string }>('/community/resources', payload),

  report: (
    targetType: 'question' | 'answer' | 'resource',
    targetXId: string,
    reason: ReportReason,
    details?: string,
  ) =>
    api.post<{ hidden: boolean }>('/community/reports', {
      target_type: targetType,
      target_x_id: targetXId,
      reason,
      details,
    }),
};
