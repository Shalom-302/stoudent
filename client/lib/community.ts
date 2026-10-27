/** Shared vocabulary for STOUDENT: filières, levels, report reasons. */

/**
 * The BTS filières STOUDENT opens with. The code is what is stored and shown
 * on posts; the name explains it to someone from another filière. Members can
 * still type a filière missing from this list.
 */
export const BTS_FILIERES = [
  { code: 'RIT', name: 'Réseaux Informatiques et Télécommunications' },
  { code: 'IDA', name: 'Informatique Développeur d’Application' },
  { code: 'ELT', name: 'Électrotechnique' },
  { code: 'SEI', name: 'Systèmes Électroniques et Informatiques' },
  { code: 'MSP', name: 'Maintenance des Systèmes de Production' },
  { code: 'FC', name: 'Finance Comptabilité' },
  { code: 'GC', name: 'Gestion Commerciale' },
  { code: 'RHC', name: 'Ressources Humaines et Communication' },
  { code: 'LOG', name: 'Logistique' },
  { code: 'AD', name: 'Assistanat de Direction' },
] as const;

export const FILIERES: string[] = BTS_FILIERES.map((f) => f.code);

/** "IDA" -> "IDA · Informatique Développeur d’Application" (unknown codes as-is). */
export function filiereLabel(code: string): string {
  const known = BTS_FILIERES.find((f) => f.code.toLowerCase() === code.toLowerCase());
  return known ? `${known.code} · ${known.name}` : code;
}

/** Where members send data requests (privacy page). */
export const PRIVACY_CONTACT = 'contact@kortex.sbs';

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
