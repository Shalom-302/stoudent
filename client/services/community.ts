import { api, apiUpload } from '@/lib/api';
import type {
  CommunityMeta,
  NotificationItem,
  Paged,
  QuestionDetail,
  QuestionSummary,
  ReportReason,
  ProgrammeFiliere,
  ProgrammeOverview,
  ResourceFacets,
  ResourceItem,
  ResourceKind,
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
  kind?: ResourceKind;
  chapter?: string;
  session_year?: number;
  original_author?: string;
}

export type ResourceSort = 'recent' | 'popular' | 'subject';

export interface ResourceFilters {
  filiere?: string;
  epreuve?: string;
  other?: boolean;
  subject?: string;
  kind?: ResourceKind;
  year?: number;
  q?: string;
  sort?: ResourceSort;
  page?: number;
  size?: number;
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

  editQuestion: (xId: string, payload: AskPayload) => api.patch<null>(`/community/questions/${xId}`, payload),

  /** Photo of the exercise: re-encoded server-side, returns the URL to attach. */
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<{ image_url: string }>('/community/uploads', form);
  },

  answer: (questionXId: string, body: string) =>
    api.post<{ x_id: string }>(`/community/questions/${questionXId}/answers`, { body }),
  accept: (questionXId: string, answerXId: string) =>
    api.post<null>(`/community/questions/${questionXId}/accept/${answerXId}`),
  editAnswer: (answerXId: string, body: string) => api.patch<null>(`/community/answers/${answerXId}`, { body }),
  deleteAnswer: (answerXId: string) => api.delete<null>(`/community/answers/${answerXId}`),
  thank: (answerXId: string) =>
    api.post<{ thanks_count: number; thanked: boolean }>(`/community/answers/${answerXId}/thanks`),

  notifications: () => api.get<{ unread: number; items: NotificationItem[] }>('/community/notifications'),
  markRead: (xIds: string[] = []) => api.post<null>('/community/notifications/read', { x_ids: xIds }),

  endorse: (answerXId: string) =>
    api.post<{ teacher_endorsed: boolean }>(`/community/answers/${answerXId}/endorse`),

  vote: (targetType: 'question' | 'answer', targetXId: string, value: -1 | 0 | 1) =>
    api.post<{ score: number; my_vote: number }>('/community/votes', {
      target_type: targetType,
      target_x_id: targetXId,
      value,
    }),

  resources: (filters: ResourceFilters) => api.get<Paged<ResourceItem>>(`/community/resources${query(filters)}`),
  resourceFacets: (filters: Pick<ResourceFilters, 'filiere' | 'subject' | 'kind'>) =>
    api.get<ResourceFacets>(`/community/resources/facets${query(filters)}`),
  programme: () => api.get<ProgrammeOverview>('/community/library/programme'),
  programmeFiliere: (code: string) =>
    api.get<ProgrammeFiliere>(`/community/library/programme${query({ filiere: code })}`),
  openResource: (xId: string) => api.post<{ url: string; open_count: number }>(`/community/resources/${xId}/open`),
  shareResource: (payload: ResourcePayload) =>
    api.post<{ x_id: string; status: string }>('/community/resources', payload),

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
