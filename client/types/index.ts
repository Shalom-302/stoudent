/** Shared API types, mirroring the FastAPI schemas of the `client` sub-app. */

export interface ApiEnvelope<T> {
  code: number;
  msg: string;
  data: T;
  trace_id?: string;
}

// -- Auth --------------------------------------------------------------------

export interface AuthUser {
  id: number;
  x_id: string;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  phone: string | null;
  pseudo: string | null;
  roles: { name: string }[] | null;
}

/** Returned by /auth/register when the WhatsApp code gate is on. */
export interface OtpRequired {
  otp_required: true;
  phone: string;
}

export interface LoginToken {
  access_token: string;
  access_token_type: string;
  access_token_expire_time: string;
  user: AuthUser;
}

// -- Student -----------------------------------------------------------------

export interface Avatar {
  x_id: string;
  model: string;
  skin: string;
  hair: string;
  outfit: string;
  accessories: string[];
  position_x: number;
  position_y: number;
  position_z: number;
  rotation: number;
}

export interface Student {
  x_id: string;
  bio: string | null;
  institution: string | null;
  level: string | null;
  total_xp: number;
  level_number: number;
  created_time: string;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  pseudo: string | null;
  phone: string | null;
  filiere: string | null;
  member_type: 'student' | 'teacher';
  reputation: number;
  avatar: Avatar | null;
}

export interface LevelDetail {
  level_number: number;
  total_xp: number;
  xp_into_level: number;
  xp_for_next_level: number;
  progress_percent: number;
  title: string;
}

export interface LabProgress {
  lab_slug: string;
  lab_name: string;
  total_experiments: number;
  completed_experiments: number;
  progress_percent: number;
  xp_earned: number;
}

export interface Progress {
  level: LevelDetail;
  total_experiments: number;
  completed_experiments: number;
  in_progress_experiments: number;
  average_score: number;
  achievements_unlocked: number;
  labs: LabProgress[];
}

export interface Achievement {
  x_id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  xp_reward: number;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface HistoryEntry {
  experiment_slug: string;
  experiment_title: string;
  lab_slug: string;
  status: ExperimentStatus;
  progress: number;
  score: number;
  best_score: number;
  xp_earned: number;
  attempts: number;
  updated_time: string | null;
  completed_at: string | null;
}

// -- Labs & experiments ------------------------------------------------------

export type ExperimentStatus = 'not_started' | 'in_progress' | 'completed';
export type LabStatus = 'available' | 'coming_soon' | 'locked';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface SceneEquipment {
  id: string;
  label: string;
  position: { x: number; y: number; z: number };
}

export interface SceneConfig {
  building?: string;
  position?: { x: number; y: number; z: number };
  rotation?: number;
  accent?: string;
  entrance?: { x: number; y: number; z: number };
  locked_message?: string;
  equipment?: SceneEquipment[];
  panels?: { id: string; text: string }[];
}

export interface ExperimentSummary {
  x_id: string;
  slug: string;
  title: string;
  description: string | null;
  difficulty: Difficulty;
  duration_minutes: number;
  xp_reward: number;
  order: number;
  status: ExperimentStatus;
  progress: number;
  best_score: number;
  is_locked: boolean;
}

export interface Question {
  id: string;
  type: 'mcq' | 'numeric' | 'boolean' | 'text' | 'multi';
  question: string;
  options: string[];
  unit: string | null;
  points: number;
}

/** One manipulation the TP expects. The threshold stays server-side. */
export interface Milestone {
  id: string;
  label: string;
  points: number;
  done: boolean;
}

export interface ScoreBreakdown {
  manipulation: number;
  manipulation_total: number;
  reading: number;
  reading_total: number;
}

export interface GuideStep {
  title: string;
  text: string;
  result: string | null;
}

/** Formula + worked example, available from the start of the TP. */
export interface Guide {
  formula: string | null;
  formula_note: string | null;
  example: GuideStep[];
  your_turn: string | null;
}

export interface InstructionStep {
  title: string;
  content: string;
  hint?: string;
}

export interface ExperimentDetail extends ExperimentSummary {
  objective: string | null;
  instructions: InstructionStep[];
  guide: Guide | null;
  theory: string | null;
  initial_parameters: Record<string, unknown>;
  lab_slug: string;
  current_step: number;
  parameters: Record<string, unknown>;
  attempts: number;
  questions: Question[];
  milestones: Milestone[];
}

export interface LabSummary {
  x_id: string;
  name: string;
  slug: string;
  type: string;
  status: LabStatus;
  description: string | null;
  thumbnail: string | null;
  order: number;
  total_experiments: number;
  completed_experiments: number;
  progress_percent: number;
  scene_config?: SceneConfig;
}

export interface LabDetail extends LabSummary {
  scene_config: SceneConfig;
  experiments: ExperimentSummary[];
}

export interface WorldDescriptor {
  labs: LabSummary[];
  avatar: Avatar;
}

export interface AnswerResult {
  question_id: string;
  correct: boolean;
  points: number;
  max_points: number;
  feedback: string | null;
}

export interface UnlockedAchievement {
  slug: string;
  name: string;
  icon: string;
  xp_reward: number;
}

export interface SubmitResult {
  passed: boolean;
  score: number;
  best_score: number;
  xp_earned: number;
  total_xp: number;
  level_number: number;
  level_up: boolean;
  attempts: number;
  status: ExperimentStatus;
  results: AnswerResult[];
  milestones: Milestone[];
  breakdown: ScoreBreakdown | null;
  unlocked_achievements: UnlockedAchievement[];
  theory: string | null;
}

// -- Scientific engine -------------------------------------------------------

export interface SignalMetrics {
  min: number;
  max: number;
  mean: number;
  rms: number;
  peak_to_peak: number;
  power: number;
}

export interface SignalTrace {
  signal_type: string;
  sample_rate: number;
  duration: number;
  points: number;
  period: number | null;
  angular_frequency?: number;
  t: number[];
  y: number[];
  metrics: SignalMetrics;
}

export interface SpectrumPeak {
  frequency: number;
  magnitude: number;
}

export interface Spectrum {
  sample_rate: number;
  window: string;
  resolution: number;
  nyquist: number;
  frequencies: number[];
  magnitude: number[];
  magnitude_db: number[];
  phase: number[];
  peaks: SpectrumPeak[];
}

export interface FourierAnalysis {
  time_domain: SignalTrace;
  spectrum: Spectrum;
}

export interface Harmonic {
  order: number;
  frequency_ratio: number;
  amplitude: number;
  phase: number;
}

export interface PartialSum {
  up_to_order: number;
  y: number[];
  mse: number;
}

export interface HarmonicsResult {
  signal_type: string;
  frequency: number;
  amplitude: number;
  n_harmonics: number;
  harmonics: Harmonic[];
  t: number[];
  target: number[];
  reconstruction: number[];
  partial_sums: PartialSum[];
  mse: number;
}

export interface AliasingReport {
  sampling_rate: number;
  nyquist_frequency: number;
  signal_frequency: number;
  is_aliased: boolean;
  apparent_frequency: number;
  min_sampling_rate: number;
  criterion: string;
  verdict: string;
}

export interface SamplingResult {
  analog: { t: number[]; y: number[]; sample_rate: number };
  samples: { t: number[]; y: number[]; sample_rate: number; count: number };
  reconstructed?: { t: number[]; y: number[]; apparent_frequency: number };
  aliasing: AliasingReport;
  spectrum: Spectrum;
}

export interface FilterResponse {
  frequencies: number[];
  gain_db: number[];
  gain: number[];
  phase_deg: number[];
}

export interface FilterResult {
  filter: {
    type: string;
    family: string;
    order: number;
    cutoff: number;
    cutoff_high: number | null;
    sample_rate: number;
  };
  t: number[];
  input: number[];
  output: number[];
  input_metrics: SignalMetrics;
  output_metrics: SignalMetrics;
  global_attenuation_db: number;
  input_spectrum: Spectrum;
  output_spectrum: Spectrum;
  response: FilterResponse;
}

export interface ConvolutionResult {
  kernel: string;
  sample_rate: number;
  t: number[];
  input: number[];
  output: number[];
  impulse_response: { t: number[]; h: number[]; tau: number | null };
  input_metrics: SignalMetrics;
  output_metrics: SignalMetrics;
  frames?: { shift: number; value: number }[];
}

export interface LaplaceResult {
  expression: string;
  latex: string;
  numerator: number[];
  denominator: number[];
  zeros: { re: number; im: number }[];
  poles: { re: number; im: number }[];
  is_stable: boolean;
  stability_note: string;
  step: { t: number[]; y: number[] };
  impulse: { t: number[]; y: number[] };
  bode: { frequencies: number[]; gain_db: number[]; phase_deg: number[] };
  duration: number;
  inverse_latex?: string;
}

// -- Community (STOUDENT) ----------------------------------------------------

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

export interface CommunityAuthor {
  pseudo: string;
  filiere: string | null;
  level: string | null;
  reputation: number;
  is_teacher: boolean;
}

export interface QuestionSummary {
  x_id: string;
  title: string;
  excerpt: string;
  filiere: string;
  subject: string | null;
  tags: string[];
  score: number;
  answer_count: number;
  view_count: number;
  has_accepted: boolean;
  created_time: string;
  author: CommunityAuthor;
}

export interface AnswerDetail {
  x_id: string;
  body: string;
  score: number;
  is_accepted: boolean;
  teacher_endorsed: boolean;
  created_time: string;
  author: CommunityAuthor;
  my_vote: number;
  is_mine: boolean;
}

export interface QuestionDetail extends QuestionSummary {
  body: string;
  image_url: string | null;
  my_vote: number;
  is_mine: boolean;
  answers: AnswerDetail[];
}

export interface ResourceItem {
  x_id: string;
  title: string;
  url: string;
  domain: string;
  filiere: string;
  subject: string | null;
  source: string | null;
  description: string | null;
  created_time: string;
  author: CommunityAuthor;
}

export interface CommunityMeta {
  filieres: string[];
  subjects: string[];
  tags: { name: string; count: number }[];
  stats: { questions: number; answers: number; members: number };
}

export type ReportReason = 'spam' | 'offensive' | 'off_topic' | 'plagiarism' | 'broken_link' | 'other';

export interface ReportQueueItem {
  target_type: 'question' | 'answer' | 'resource';
  target_x_id: string;
  question_x_id: string | null;
  preview: string;
  author: string | null;
  is_hidden: boolean;
  count: number;
  reasons: string[];
  last_time: string;
}
