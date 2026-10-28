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
  { code: 'FA', name: 'Finance Assurance' },
  { code: 'CJ', name: 'Carrières Juridiques' },
  { code: 'TH', name: 'Tourisme Hôtellerie' },
  { code: 'GCB', name: 'Génie Civil option Bâtiment' },
  { code: 'MMA', name: 'Moteur et Mécanique Automobile' },
  { code: 'SDI', name: 'Sciences de l’Information' },
  { code: 'GCT', name: 'Gestion des Collectivités Territoriales' },
] as const;

export const FILIERES: string[] = BTS_FILIERES.map((f) => f.code);

/** "IDA" -> "IDA · Informatique Développeur d’Application" (unknown codes as-is). */
export function filiereLabel(code: string): string {
  const known = BTS_FILIERES.find((f) => f.code.toLowerCase() === code.toLowerCase());
  return known ? `${known.code} · ${known.name}` : code;
}

/** Library documents that apply to every filière (français, anglais, maths générales…). */
export const TRONC_COMMUN = 'Tronc commun';

/** Library shelves shared by a family of filières (the exam's FI / FT papers). */
export const FILIERE_GROUPS: Record<string, string> = {
  [TRONC_COMMUN]: 'Français, anglais, maths… communs à toutes les filières',
  FI: 'Filières industrielles : épreuves communes (maths, économie, gestion…)',
  FT: 'Filières tertiaires : épreuves communes',
};

/** The library's document types, in the order the filters show them. */
export const RESOURCE_KINDS = [
  { value: 'sujet', label: 'Sujet', plural: 'Sujets d’examen' },
  { value: 'corrige', label: 'Corrigé', plural: 'Corrigés' },
  { value: 'cours', label: 'Cours', plural: 'Cours' },
  { value: 'td', label: 'TD', plural: 'TD et exercices' },
  { value: 'autre', label: 'Document', plural: 'Autres' },
] as const;

export function kindLabel(kind: string): string {
  return RESOURCE_KINDS.find((k) => k.value === kind)?.label ?? 'Document';
}

/** Where members send data requests (privacy page). */
export const PRIVACY_CONTACT = 'contact@kortexdigital.net';

export const LEVELS = ['BTS 1', 'BTS 2', 'Licence 1', 'Licence 2', 'Licence 3', 'Master 1', 'Master 2', 'Ingénieur'];

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam ou publicité' },
  { value: 'offensive', label: 'Propos offensants' },
  { value: 'off_topic', label: 'Hors sujet' },
  { value: 'plagiarism', label: 'Copie sans attribution' },
  { value: 'copyright', label: 'Je suis l’auteur, retirez-le' },
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
