/** Shared vocabulary for STOUDENT: filières, levels, report reasons. */

/**
 * The 33 BTS filières, with the official codes and names of the Direction des
 * Examens et Concours (bts.mesrs-ci.net). The code is what is stored and shown
 * on posts. Members can still type a filière missing from this list.
 */
export const BTS_FILIERES = [
  { code: 'ATPA', name: 'Agriculture tropicale option production animale', family: 'industrielle' },
  { code: 'ATPV', name: 'Agriculture tropicale option production végétale', family: 'industrielle' },
  { code: 'AACV', name: 'Arts et aménagement du cadre de vie', family: 'industrielle' },
  { code: 'CV', name: 'Communication visuelle', family: 'industrielle' },
  { code: 'COS', name: 'Cosmétologie', family: 'industrielle' },
  { code: 'ELT', name: 'Électrotechnique', family: 'industrielle' },
  { code: 'GBAT', name: 'Génie civil option bâtiment', family: 'industrielle' },
  { code: 'GGT', name: 'Génie civil option géomètre topographe', family: 'industrielle' },
  { code: 'GTP', name: 'Génie civil option travaux publics', family: 'industrielle' },
  { code: 'GEE', name: 'Génie énergétique et environnement', family: 'industrielle' },
  { code: 'GERN', name: 'Gestion de l’environnement et des ressources naturelles', family: 'industrielle' },
  { code: 'HST', name: 'Hygiène et sécurité du travail', family: 'industrielle' },
  { code: 'IACC', name: 'Industries agro-alimentaires et chimiques option contrôle', family: 'industrielle' },
  { code: 'IACP', name: 'Industries agro-alimentaires et chimiques option production', family: 'industrielle' },
  { code: 'IDA', name: 'Informatique développeur d’applications', family: 'industrielle' },
  { code: 'MSP', name: 'Maintenance des systèmes de production', family: 'industrielle' },
  { code: 'MGP', name: 'Mines, géologie et pétrole', family: 'industrielle' },
  { code: '2MA', name: 'Moteur et mécanique automobile', family: 'industrielle' },
  { code: 'OPL', name: 'Optique lunetterie', family: 'industrielle' },
  { code: 'RIT', name: 'Réseaux informatiques et télécommunications', family: 'industrielle' },
  { code: 'SIP', name: 'Sécurité incendie et prévention', family: 'industrielle' },
  { code: 'SEI', name: 'Systèmes électroniques et informatiques', family: 'industrielle' },
  { code: 'URBA', name: 'Urbanisme', family: 'industrielle' },
  { code: 'AD', name: 'Assistanat de direction', family: 'tertiaire' },
  { code: 'CJPI', name: 'Carrières juridiques et professions immobilières', family: 'tertiaire' },
  { code: 'FA', name: 'Finances assurances', family: 'tertiaire' },
  { code: 'FCGE', name: 'Finances comptabilité et gestion des entreprises', family: 'tertiaire' },
  { code: 'GEC', name: 'Gestion commerciale', family: 'tertiaire' },
  { code: 'GCT', name: 'Gestion des collectivités territoriales', family: 'tertiaire' },
  { code: 'LOG', name: 'Logistique', family: 'tertiaire' },
  { code: 'RHC', name: 'Ressources humaines et communication', family: 'tertiaire' },
  { code: 'SIN', name: 'Sciences de l’information', family: 'tertiaire' },
  { code: 'TH', name: 'Tourisme hôtellerie', family: 'tertiaire' },
] as const;

/** Codes used before the alignment on the official list (old links still resolve). */
export const LEGACY_FILIERES: Record<string, string> = {
  FC: 'FCGE',
  GC: 'GEC',
  GCB: 'GBAT',
  MMA: '2MA',
  CJ: 'CJPI',
  SDI: 'SIN',
};

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
