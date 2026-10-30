import type { EquipmentType } from './city';

export interface QuizItem {
  question: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface SiteContent {
  id: EquipmentType;
  title: string;
  /** One line under the title in the prompt. */
  subtitle: string;
  /** Matière used to prefill "Poser une question". */
  subject: string;
  /** What it is, in plain words. */
  intro: string;
  parts: { name: string; role: string }[];
  figures: { label: string; value: string }[];
  /** Calculation run by the API, if the site has one. */
  mission?: 'microwave' | 'fibre';
  quiz: QuizItem[];
}

export const SITE_CONTENT: Record<EquipmentType, SiteContent> = {
  fh: {
    id: 'fh',
    title: 'Pylône de faisceau hertzien',
    subtitle: 'Liaison radio point à point entre deux pylônes',
    subject: 'Transmissions',
    intro:
      'Un faisceau hertzien (FH) transporte du trafic (voix, données, 4G) par radio entre deux antennes paraboliques qui se voient. Il remplace la fibre là où la tirer coûte trop cher. La liaison exige une visibilité directe, et même un peu plus : la première zone de Fresnel doit rester dégagée à au moins 60 %.',
    parts: [
      { name: 'Antennes paraboliques', role: 'Concentrent l’énergie dans un faisceau étroit ; le gain croît avec le diamètre et la fréquence.' },
      { name: 'ODU (unité extérieure)', role: 'Boîtier radio fixé derrière la parabole : émet et reçoit en hyperfréquence.' },
      { name: 'IDU (unité intérieure)', role: 'Dans le shelter : modem, multiplexage, interfaces Ethernet vers le réseau.' },
      { name: 'Câble IF', role: 'Relie l’ODU à l’IDU, transporte le signal et l’alimentation.' },
      { name: 'Pylône treillis', role: 'Élève les antennes au-dessus des obstacles.' },
      { name: 'Paratonnerre et balisage', role: 'Protègent de la foudre et signalent le pylône aux avions.' },
    ],
    figures: [
      { label: 'Fréquences courantes', value: '6 à 38 GHz (jusqu’à 80 GHz en bande E)' },
      { label: 'Portée typique', value: '1 à 50 km selon la fréquence' },
      { label: 'Affaiblissement en espace libre', value: '92,45 + 20 log f(GHz) + 20 log d(km)' },
      { label: 'Rayon de la 1re zone de Fresnel', value: '17,32 √(d₁d₂ / (f·d)) m' },
    ],
    mission: 'microwave',
    quiz: [
      {
        question: 'Si on double la distance d’une liaison FH, l’affaiblissement en espace libre augmente de :',
        options: ['3 dB', '6 dB', '10 dB', '20 dB'],
        answer: 1,
        explain: '20 log(2) ≈ 6 dB : l’affaiblissement varie en 20 log d.',
      },
      {
        question: 'Quelle part de la 1re zone de Fresnel doit rester dégagée ?',
        options: ['Aucune, la visibilité directe suffit', 'Au moins 60 %', 'Exactement 100 %', '10 %'],
        answer: 1,
        explain: 'La pratique (UIT-R P.530) demande au moins 60 % de dégagement, sinon le signal s’affaiblit par diffraction.',
      },
      {
        question: 'Pourquoi la pluie gêne-t-elle surtout les liaisons au-dessus de 10 GHz ?',
        options: [
          'Les gouttes absorbent et diffusent les ondes de cette longueur d’onde',
          'La pluie déplace les pylônes',
          'Les paraboles se remplissent d’eau',
          'Elle ne les gêne pas',
        ],
        answer: 0,
        explain: 'Plus la fréquence monte, plus la longueur d’onde se rapproche de la taille des gouttes : l’atténuation par la pluie grimpe.',
      },
    ],
  },
  pbo: {
    id: 'pbo',
    title: 'Point de concentration fibre (PBO)',
    subtitle: 'Le boîtier d’où part la fibre de chaque maison',
    subject: 'Réseaux optiques',
    intro:
      'Le point de concentration, aussi appelé PBO (point de branchement optique), est le petit boîtier posé sur un poteau ou en façade. La fibre arrive du central par le réseau de distribution ; dans le boîtier, elle est soudée aux câbles de branchement qui partent vers chaque abonné. Souvent, un coupleur y répartit la lumière entre plusieurs maisons.',
    parts: [
      { name: 'Câble de distribution', role: 'Arrive de l’armoire de rue avec plusieurs fibres.' },
      { name: 'Cassettes de lovage', role: 'Rangent les surlongueurs de fibre et protègent les soudures.' },
      { name: 'Soudures (épissures)', role: 'Raccordent deux fibres par fusion, environ 0,1 dB de perte chacune.' },
      { name: 'Coupleur optique (splitter)', role: 'Divise la lumière : 1:8 ≈ 10,5 dB de perte, 1:32 ≈ 17 dB.' },
      { name: 'Câbles de branchement', role: 'Descendent vers la box (ONU) de chaque abonné.' },
    ],
    figures: [
      { label: 'Architecture', value: 'GPON : OLT au central → coupleurs → ONU chez l’abonné' },
      { label: 'Atténuation de la fibre', value: '0,35 dB/km à 1310 nm, 0,25 dB/km à 1550 nm' },
      { label: 'Budget optique classe B+', value: '28 dB entre l’OLT et l’ONU' },
      { label: 'Abonnés par port GPON', value: '64 en pratique, 128 au maximum' },
    ],
    mission: 'fibre',
    quiz: [
      {
        question: 'Un coupleur 1:8 suivi d’un 1:8 dessert combien d’abonnés ?',
        options: ['16', '32', '64', '128'],
        answer: 2,
        explain: '8 × 8 = 64 sorties ; les pertes, elles, s’additionnent : 10,5 + 10,5 = 21 dB.',
      },
      {
        question: 'Que fait l’ONU ?',
        options: [
          'Elle émet la lumière vers tous les abonnés',
          'C’est la box optique de l’abonné, elle convertit la lumière en Ethernet',
          'Elle soude les fibres',
          'Elle mesure la longueur de la fibre',
        ],
        answer: 1,
        explain: 'L’OLT est au central ; l’ONU (ou ONT) est chez l’abonné.',
      },
    ],
  },
  sro: {
    id: 'sro',
    title: 'Armoire de rue (SRO)',
    subtitle: 'Le sous-répartiteur optique du quartier',
    subject: 'Réseaux optiques',
    intro:
      'L’armoire de rue regroupe les fibres d’un quartier. Les gros câbles de transport venant du central (NRO) y sont brassés vers les câbles de distribution qui partent vers les points de concentration. C’est ici que le technicien relie un abonné à un port de l’opérateur.',
    parts: [
      { name: 'Tête de câble transport', role: 'Arrivée des fibres depuis le central (NRO).' },
      { name: 'Tête de câble distribution', role: 'Départ des fibres vers les PBO du quartier.' },
      { name: 'Jarretières', role: 'Cordons qui relient une fibre transport à une fibre distribution.' },
      { name: 'Coupleurs', role: 'Premier étage de division dans beaucoup d’architectures.' },
    ],
    figures: [
      { label: 'Capacité courante', value: 'quelques centaines à plus de mille lignes' },
      { label: 'Connecteur courant', value: 'SC/APC (vert), perte ≈ 0,3 à 0,5 dB' },
    ],
    quiz: [
      {
        question: 'Pourquoi les connecteurs APC sont-ils verts et polis en biais ?',
        options: [
          'Pour être jolis',
          'Le biais de 8° limite la lumière réfléchie vers l’émetteur',
          'Pour transporter plus de débit',
          'Pour résister à la pluie',
        ],
        answer: 1,
        explain: 'Le poli angulaire (APC) renvoie la réflexion hors du cœur de la fibre ; la vidéo et le GPON y sont sensibles.',
      },
    ],
  },
  chambre: {
    id: 'chambre',
    title: 'Chambre de tirage',
    subtitle: 'Sous la plaque : les fourreaux et les boîtiers d’épissure',
    subject: 'Réseaux optiques',
    intro:
      'Sous la plaque en fonte du trottoir, la chambre de tirage donne accès aux fourreaux enterrés. On y tire les câbles d’un tronçon à l’autre et on y loge les boîtiers d’épissure (BPE) qui protègent les soudures. Les chambres sont espacées pour que le câble puisse être tiré sans dépasser sa force de traction.',
    parts: [
      { name: 'Fourreaux (PVC, PEHD)', role: 'Tubes enterrés dans lesquels passent les câbles.' },
      { name: 'Boîtier de protection d’épissure (BPE)', role: 'Boîtier étanche où les fibres de deux câbles sont soudées.' },
      { name: 'Love de câble', role: 'Surlongueur gardée pour pouvoir ressortir le boîtier et intervenir.' },
    ],
    figures: [{ label: 'Rayon de courbure minimal', value: 'environ 20 fois le diamètre du câble' }],
    quiz: [
      {
        question: 'Pourquoi garde-t-on une surlongueur de câble dans la chambre ?',
        options: [
          'Pour pouvoir sortir le boîtier d’épissure et souder au calme',
          'Pour augmenter le débit',
          'Pour réduire l’atténuation',
          'C’est une erreur de pose',
        ],
        answer: 0,
        explain: 'Le love permet de remonter le BPE dans une camionnette ou sous une tente pour intervenir.',
      },
    ],
  },
  gsm: {
    id: 'gsm',
    title: 'Relais GSM / 4G sur toit',
    subtitle: 'Trois secteurs pour couvrir le quartier',
    subject: 'Réseaux mobiles',
    intro:
      'Sur le toit, une station de base couvre le quartier. Trois antennes-panneaux, orientées à 120° les unes des autres, découpent la zone en trois secteurs. Le petit FH à côté relie le site au réseau de l’opérateur, quand il n’y a pas de fibre.',
    parts: [
      { name: 'Antennes-panneaux sectorielles', role: 'Une par secteur, ouverture d’environ 65° chacune, inclinées vers le sol (tilt).' },
      { name: 'RRU (unité radio distante)', role: 'Près de l’antenne : émission et réception radio.' },
      { name: 'BBU (unité de bande de base)', role: 'Dans l’armoire : traitement numérique, lien vers le cœur de réseau.' },
      { name: 'Lien de collecte (backhaul)', role: 'FH ou fibre qui raccorde le site au réseau.' },
    ],
    figures: [
      { label: 'Azimuts typiques', value: '0°, 120°, 240°' },
      { label: 'Bandes 2G / 4G', value: '900 et 1800 MHz (4G aussi en 800 et 2600 MHz)' },
    ],
    quiz: [
      {
        question: 'À quoi sert le tilt d’une antenne sectorielle ?',
        options: [
          'À orienter le lobe vers le sol pour maîtriser la portée de la cellule',
          'À changer de fréquence',
          'À protéger de la pluie',
          'À augmenter la puissance',
        ],
        answer: 0,
        explain: 'En inclinant le lobe, on réduit la portée et les interférences avec les cellules voisines.',
      },
    ],
  },
  'fh-roof': {
    id: 'fh-roof',
    title: 'FH de collecte sur toit',
    subtitle: 'La liaison radio qui raccorde un relais au réseau',
    subject: 'Transmissions',
    intro:
      'Une petite parabole sur un toit, pointée vers une autre parabole sur un toit voisin : c’est un faisceau hertzien de collecte (backhaul). Il transporte tout le trafic du relais GSM jusqu’à un site mieux raccordé, quand la fibre n’arrive pas encore. En ville, on en voit partout dès qu’on lève la tête.',
    parts: [
      { name: 'Parabole de 30 à 60 cm', role: 'Petite car la fréquence est haute (18 à 38 GHz) et la distance courte (quelques km).' },
      { name: 'ODU fixée derrière', role: 'Radio extérieure, reliée à l’armoire du relais.' },
      { name: 'Support et visée', role: 'L’antenne est pointée au dixième de degré près vers l’autre bout.' },
      { name: 'Polarisation', role: 'Verticale ou horizontale : les deux bouts doivent être identiques.' },
    ],
    figures: [
      { label: 'Fréquences courantes en ville', value: '18, 23, 38 GHz' },
      { label: 'Débit typique', value: '100 Mbit/s à 1 Gbit/s' },
      { label: 'Ouverture du faisceau (60 cm à 23 GHz)', value: 'environ 1,5°' },
    ],
    quiz: [
      {
        question: 'Pourquoi les paraboles de collecte en ville sont-elles petites ?',
        options: [
          'Parce que la fréquence est élevée : à diamètre égal le gain augmente, donc une petite parabole suffit',
          'Pour coûter moins cher uniquement',
          'Parce qu’elles ne servent qu’à la télévision',
          'Pour ne pas être vues',
        ],
        answer: 0,
        explain: 'Le gain varie en (πD/λ)² : à 23 GHz la longueur d’onde fait 1,3 cm, une parabole de 60 cm donne déjà près de 40 dBi.',
      },
      {
        question: 'Si on désaligne une parabole de quelques degrés, que se passe-t-il ?',
        options: ['Rien', 'Le niveau reçu chute fortement, la liaison peut tomber', 'Le débit double', 'La fréquence change'],
        answer: 1,
        explain: 'Le faisceau ne fait qu’environ 1,5° de large : quelques degrés suffisent à sortir du lobe principal.',
      },
    ],
  },
  smallcell: {
    id: 'smallcell',
    title: 'Small cell sur lampadaire',
    subtitle: 'Une mini station de base au niveau de la rue',
    subject: 'Réseaux mobiles',
    intro:
      'La small cell est une petite station de base (quelques watts) posée sur un lampadaire ou une façade. Elle couvre une centaine de mètres et soulage le relais du toit là où il y a beaucoup de monde : carrefour, marché, gare routière. Elle est raccordée en fibre, ou par un petit lien radio.',
    parts: [
      { name: 'Boîtier radio + antenne intégrée', role: 'Émet en 4G (et 5G sur les sites récents), faible puissance.' },
      { name: 'Raccordement', role: 'Fibre qui monte dans le mât, ou petit FH.' },
      { name: 'Alimentation', role: 'Prise sur l’éclairage public, avec batterie ou non.' },
    ],
    figures: [
      { label: 'Puissance', value: '1 à 10 W (contre 20 à 60 W par secteur sur un toit)' },
      { label: 'Rayon de couverture', value: '50 à 200 m' },
    ],
    quiz: [
      {
        question: 'Pourquoi ajouter une small cell alors qu’un relais couvre déjà la zone ?',
        options: [
          'Pour augmenter la capacité là où beaucoup d’utilisateurs se concentrent',
          'Pour éclairer la rue',
          'Pour remplacer la fibre',
          'Pour capter la radio FM',
        ],
        answer: 0,
        explain: 'Chaque cellule partage ses ressources radio entre ses utilisateurs : en découpant la zone, on multiplie la capacité.',
      },
    ],
  },
  nro: {
    id: 'nro',
    title: 'Central optique (NRO)',
    subtitle: 'Là où démarre la fibre du quartier',
    subject: 'Réseaux optiques',
    intro:
      'Le nœud de raccordement optique (NRO) est un petit bâtiment technique, souvent anonyme. Il abrite les OLT de l’opérateur : chaque port envoie la lumière vers jusqu’à 64 abonnés. De là, les gros câbles partent sous les trottoirs, de chambre en chambre, jusqu’aux armoires de rue (SRO), puis aux PBO sur les poteaux.',
    parts: [
      { name: 'OLT (Optical Line Terminal)', role: 'Équipement actif : un port GPON = un arbre optique vers les abonnés.' },
      { name: 'Répartiteur optique (ODF)', role: 'Baies où arrivent toutes les fibres, brassées par jarretières.' },
      { name: 'Énergie', role: 'Redresseurs, batteries et groupe électrogène : le central ne doit jamais s’arrêter.' },
      { name: 'Climatisation', role: 'Les équipements actifs chauffent ; une panne de clim coupe le service.' },
    ],
    figures: [
      { label: 'Capacité', value: 'de quelques milliers à plus de 100 000 lignes' },
      { label: 'Puissance d’émission OLT (classe B+)', value: '+1,5 à +5 dBm' },
    ],
    quiz: [
      {
        question: 'Dans quel ordre la fibre va-t-elle du central à l’abonné ?',
        options: ['NRO → SRO → PBO → box', 'PBO → NRO → SRO → box', 'Box → NRO → PBO → SRO', 'SRO → PBO → NRO → box'],
        answer: 0,
        explain: 'Transport du NRO à l’armoire de rue, distribution jusqu’au PBO, puis branchement jusqu’à la box (ONU).',
      },
    ],
  },
};

/** Equipment types in the order the field notebook lists them. */
export const SITE_ORDER: EquipmentType[] = ['fh', 'fh-roof', 'gsm', 'smallcell', 'nro', 'sro', 'chambre', 'pbo'];
