/** Shared vocabulary for STOUDENT: filières, levels, report reasons. */

/** Offered at sign-up and in the filters; members can type another one. */
export const FILIERES = [
  'RIT',
  'IDA',
  'Télécommunications',
  'Électronique',
  'Génie civil',
  'Génie électrique',
  'Gestion',
  'Comptabilité',
  'Marketing',
  'Logistique',
];

export const LEVELS = ['BTS 1', 'BTS 2', 'Licence 1', 'Licence 2', 'Licence 3', 'Master 1', 'Master 2', 'Ingénieur'];

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam ou publicité' },
  { value: 'offensive', label: 'Propos offensants' },
  { value: 'off_topic', label: 'Hors sujet' },
  { value: 'plagiarism', label: 'Copie sans attribution' },
  { value: 'broken_link', label: 'Lien cassé' },
  { value: 'other', label: 'Autre' },
] as const;

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

/** "il y a 3 heures" */
export function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'à l’instant';
}
