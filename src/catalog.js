'use strict';

/**
 * Starfall Enigma apparel catalogue.
 * Every product, description and localisation in this file is original.
 */

const CATEGORY_LIST = [
  {
    id: 'outerwear',
    group: 'clothing',
    label_en: 'Outerwear',
    label_id: 'Luaran',
    description_en: 'Coats, capes and leather layers built for weather and ritual.',
    description_id: 'Mantel, cape, dan lapisan kulit untuk cuaca dan ritual.',
    image: '/assets/img/editorial/jacket.jpg',
    prefix: 'OW',
    noun_en: 'layer',
    noun_id: 'lapisan luar'
  },
  {
    id: 'tailoring',
    group: 'clothing',
    label_en: 'Tailoring',
    label_id: 'Tailoring',
    description_en: 'Sharp shoulders, softened structure and suiting for the hours after dark.',
    description_id: 'Bahu tegas, struktur lembut, dan setelan untuk jam-jam setelah gelap.',
    image: '/assets/img/editorial/apparel.jpg',
    prefix: 'TL',
    noun_en: 'tailored piece',
    noun_id: 'karya tailoring'
  },
  {
    id: 'knitwear',
    group: 'clothing',
    label_en: 'Knitwear',
    label_id: 'Rajutan',
    description_en: 'Wool, mohair and close-knit layers that keep the shape of the body.',
    description_id: 'Wol, mohair, dan rajutan rapat yang menyimpan bentuk tubuh.',
    image: '/assets/img/editorial/model-01.jpg',
    prefix: 'KN',
    noun_en: 'knit layer',
    noun_id: 'lapisan rajutan'
  },
  {
    id: 'dresses',
    group: 'clothing',
    label_en: 'Dresses',
    label_id: 'Gaun',
    description_en: 'Slip dresses, bias cuts and floor-length shadows.',
    description_id: 'Gaun slip, potongan bias, dan bayangan sepanjang lantai.',
    image: '/assets/img/editorial/model-03.jpg',
    prefix: 'DR',
    noun_en: 'dress',
    noun_id: 'gaun'
  },
  {
    id: 'tops',
    group: 'clothing',
    label_en: 'Tops & Shirts',
    label_id: 'Atasan & Kemeja',
    description_en: 'Shirts and blouses cut to frame the collarbone and the evening.',
    description_id: 'Kemeja dan blus dengan potongan yang membingkai tulang selangka dan malam.',
    image: '/assets/img/editorial/model-02.jpg',
    prefix: 'TP',
    noun_en: 'top',
    noun_id: 'atasan'
  },
  {
    id: 'trousers',
    group: 'clothing',
    label_en: 'Trousers',
    label_id: 'Celana',
    description_en: 'Wide legs, sharp pleats and trousers built to move.',
    description_id: 'Kaki lebar, lipit tegas, dan celana yang dibuat untuk bergerak.',
    image: '/assets/img/editorial/model-04.jpg',
    prefix: 'TR',
    noun_en: 'pair of trousers',
    noun_id: 'celana'
  },
  {
    id: 'skirts',
    group: 'clothing',
    label_en: 'Skirts',
    label_id: 'Rok',
    description_en: 'Bias-cut silk, raw hems and skirts that carry the air.',
    description_id: 'Sutra potongan bias, tepi mentah, dan rok yang membawa udara.',
    image: '/assets/img/editorial/model-05.jpg',
    prefix: 'SK',
    noun_en: 'skirt',
    noun_id: 'rok'
  },
  {
    id: 'denim',
    group: 'clothing',
    label_en: 'Denim',
    label_id: 'Denim',
    description_en: 'Rigid denim, washed black and darkened hardware.',
    description_id: 'Denim kaku, hitam washed, dan hardware digelapkan.',
    image: '/assets/img/editorial/model-01.jpg',
    prefix: 'DN',
    noun_en: 'denim piece',
    noun_id: 'karya denim'
  },
  {
    id: 'loungewear',
    group: 'clothing',
    label_en: 'Loungewear',
    label_id: 'Loungewear',
    description_en: 'Soft layers for the hours when the world is closed.',
    description_id: 'Lapisan lembut untuk jam-jam ketika dunia tertutup.',
    image: '/assets/img/editorial/cathedral-detail.jpg',
    prefix: 'LW',
    noun_en: 'loungewear layer',
    noun_id: 'lapisan loungewear'
  }
];

const COLLECTIONS = [
  {
    id: 'starfall',
    label: 'STARFALL',
    line_en: 'Celestial tailoring and silk, cut for the dark.',
    line_id: 'Tailoring celestial dan sutra, dipotong untuk kegelapan.'
  },
  {
    id: 'nocturne',
    label: 'NOCTURNE',
    line_en: 'Blackened denim, leather and moonlit knit.',
    line_id: 'Denim menghitam, kulit, dan rajutan bercahaya bulan.'
  },
  {
    id: 'reliquary',
    label: 'RELIQUARY',
    line_en: 'Heirloom layers, made to be kept.',
    line_id: 'Lapisan pusaka, dibuat untuk disimpan.'
  },
  {
    id: 'oathbound',
    label: 'OATHBOUND',
    line_en: 'Structured uniforms and signs of devotion.',
    line_id: 'Seragam terstruktur dan tanda pengabdian.'
  }
];

const MATERIALS = {
  wool_suiting: { en: 'Italian wool suiting', id: 'Wol suit Italia' },
  wool_flannel: { en: 'Brushed wool flannel', id: 'Flanel wol bersikat' },
  merino: { en: 'Fine merino wool', id: 'Wol merino halus' },
  mohair: { en: 'Brushed mohair blend', id: 'Campuran mohair bersikat' },
  cashmere: { en: 'Soft cashmere blend', id: 'Campuran kasmir lembut' },
  silk: { en: 'Sandwashed silk', id: 'Sutra sandwashed' },
  silk_satin: { en: 'Heavy silk satin', id: 'Satin sutra berat' },
  silk_mesh: { en: 'Fine silk mesh', id: 'Mesh sutra halus' },
  silk_velvet: { en: 'Silk velvet', id: 'Beludru sutra' },
  cotton_poplin: { en: 'Organic cotton poplin', id: 'Poplin katun organik' },
  cotton_twill: { en: 'Garment-dyed cotton twill', id: 'Twill katun pewarna garmen' },
  cotton_jersey: { en: 'Compact cotton jersey', id: 'Jersey katun padat' },
  denim: { en: 'Rigid Japanese denim', id: 'Denim Jepang kaku' },
  washed_denim: { en: 'Washed black denim', id: 'Denim hitam washed' },
  lamb_leather: { en: 'Lambskin leather', id: 'Kulit domba' },
  linen: { en: 'Washed linen', id: 'Linen washed' },
  viscose: { en: 'Fluid viscose', id: 'Viskosa fluid' },
  modal: { en: 'Micro-modal jersey', id: 'Jersey mikro-modal' },
  tech_nylon: { en: 'Technical nylon', id: 'Nilon teknis' }
};

const FINISHES = {
  hand_finished: { en: 'Hand-finished', id: 'Diselesaikan tangan' },
  brushed: { en: 'Brushed', id: 'Disikat' },
  matte: { en: 'Matte', id: 'Matte' },
  raw_hem: { en: 'Raw-edged', id: 'Tepi mentah' },
  garment_dyed: { en: 'Garment-dyed', id: 'Pewarna garmen' },
  stone_washed: { en: 'Stone-washed', id: 'Stone-washed' },
  overdyed: { en: 'Overdyed black', id: 'Hitam overdyed' },
  waxed: { en: 'Waxed', id: 'Berlilin' },
  enzyme_washed: { en: 'Enzyme-washed', id: 'Enzyme-washed' },
  pigment: { en: 'Pigment-dyed', id: 'Pewarna pigmen' }
};

const MOTIFS = {
  eclipse: { en: 'eclipse', id: 'gerhana' },
  serpent: { en: 'serpent', id: 'ular' },
  moth: { en: 'moth', id: 'ngengat' },
  star: { en: 'falling star', id: 'bintang jatuh' },
  dagger: { en: 'dagger', id: 'belati' },
  key: { en: 'reliquary key', id: 'kunci relikui' },
  lily: { en: 'grave lily', id: 'bunga lili makam' },
  crown: { en: 'thorn crown', id: 'mahkota duri' },
  eye: { en: 'all-seeing eye', id: 'mata yang melihat' },
  thorn: { en: 'thorn', id: 'duri' },
  moon: { en: 'crescent moon', id: 'bulan sabit' },
  halo: { en: 'halo', id: 'halo' },
  comet: { en: 'comet', id: 'komet' },
  belladonna: { en: 'belladonna', id: 'belladonna' },
  owl: { en: 'night owl', id: 'burung hantu malam' },
  raven: { en: 'raven', id: 'gagak' },
  rose: { en: 'night rose', id: 'mawar malam' },
  rune: { en: 'rune', id: 'rune' },
  bloom: { en: 'night bloom', id: 'bunga malam' },
  sun: { en: 'black sun', id: 'matahari hitam' }
};

const THEMES_EN = [
  'light and shadow',
  'devotion and defiance',
  'memory and forgetting',
  'stillness and movement',
  'the sacred and the profane',
  'distance and intimacy'
];
const THEMES_ID = [
  'cahaya dan bayangan',
  'pengabdian dan pembangkangan',
  'ingatan dan melupakan',
  'keheningan dan gerakan',
  'yang sakral dan yang profan',
  'jarak dan keintiman'
];

const CATEGORY_LINES = {
  outerwear: {
    form_en: [
      'The pattern is cut with a generous shoulder and a long, weighted line, so the fabric moves with the body rather than around it.',
      'A concealed placket and hand-set lining keep the interior as considered as the silhouette.',
      'The hem is left slightly uneven, a quiet signature that only becomes visible in motion.'
    ],
    form_id: [
      'Polanya dipotong dengan bahu lapang dan garis panjang berbobot, sehingga kain bergerak bersama tubuh, bukan mengelilinginya.',
      'Plaket tersembunyi dan lining yang dipasang tangan membuat bagian dalam sama tertatanya dengan siluetnya.',
      'Ujungnya dibiarkan sedikit tidak rata, tanda tangan sunyi yang baru terlihat saat bergerak.'
    ],
    detail: 'Relaxed coat fit · 118-126 cm length',
    detail_id: 'Potongan luaran santai · panjang 118-126 cm'
  },
  tailoring: {
    form_en: [
      'The shoulder is built by hand over a light canvas, giving structure without the stiffness of a conventional suit.',
      'A half-lining lets the jacket breathe, while the interior seams are bound and numbered.',
      'The waist is shaped just enough to interrupt the line, leaving room for movement and a hidden pocket.'
    ],
    form_id: [
      'Bahunya dibangun dengan tangan di atas kanvas ringan, memberi struktur tanpa kekakuan setelan konvensional.',
      'Setengah lining membuat jaket tetap bernapas, sementara kampuh dalam dibalut dan diberi nomor.',
      'Pinggangnya dibentuk secukupnya untuk memutus garis, menyisakan ruang gerak dan saku tersembunyi.'
    ],
    detail: 'Structured shoulder · 72 cm back length',
    detail_id: 'Bahu terstruktur · panjang punggung 72 cm'
  },
  knitwear: {
    form_en: [
      'The gauge is chosen for weight and recovery, so the knit holds its shape without pressing against the body.',
      'Ribbed cuffs and a hand-linked neckline finish the edges with a quiet, deliberate rhythm.',
      'A small star is worked into the inner hem rather than applied as a visible label.'
    ],
    form_id: [
      'Kerapatan rajutan dipilih untuk bobot dan pemulihan bentuk, sehingga rajutan tetap kokoh tanpa menekan tubuh.',
      'Manset berusuk dan garis leher yang disambung tangan menyelesaikan tepinya dengan ritme sunyi yang disengaja.',
      'Bintang kecil dirajut di bagian dalam ujung bawah, bukan dipasang sebagai label yang terlihat.'
    ],
    detail: 'Close fit · 58 cm body length',
    detail_id: 'Potongan dekat · panjang badan 58 cm'
  },
  dresses: {
    form_en: [
      'Cut on the bias, the dress follows the body without gripping it and falls back into a clean, dark line.',
      'A narrow bound edge replaces the usual facing, keeping the neckline and armholes almost weightless.',
      'The hem is finished by hand so it moves with a slight, living unevenness.'
    ],
    form_id: [
      'Dipotong secara bias, gaun mengikuti tubuh tanpa mencengkeram dan kembali jatuh ke garis gelap yang bersih.',
      'Tepi sempit yang dibalut menggantikan facing biasa, menjaga garis leher dan lubang lengan hampir tanpa bobot.',
      'Ujungnya diselesaikan tangan sehingga bergerak dengan ketidakrataan hidup yang halus.'
    ],
    detail: 'Bias cut · 128 cm length',
    detail_id: 'Potongan bias · panjang 128 cm'
  },
  tops: {
    form_en: [
      'The collar and placket are cut in one continuous line, allowing the top to sit close without feeling formal.',
      'A shaped back yoke and slightly dropped shoulder give the body room to breathe.',
      'Mother-of-pearl buttons are chosen for their quiet irregularity and sewn with a visible thread shank.'
    ],
    form_id: [
      'Kerah dan plaket dipotong dalam satu garis menyambung, membuat atasan duduk dekat tanpa terasa formal.',
      'Yoke punggung berbentuk dan bahu yang sedikit turun memberi ruang bagi tubuh untuk bernapas.',
      'Kancing mother-of-pearl dipilih karena ketidakrataannya yang sunyi dan dijahit dengan tangkai benang yang terlihat.'
    ],
    detail: 'Relaxed fit · 62 cm body length',
    detail_id: 'Potongan santai · panjang badan 62 cm'
  },
  trousers: {
    form_en: [
      'The rise is set to sit at the natural waist, with a clean extension and a hidden hook closure.',
      'Front pleats open into a long leg, while the back waist is finished with a split for ease.',
      'Pockets are set into the side seam so the line remains uninterrupted.'
    ],
    form_id: [
      'Pinggang diatur duduk di pinggang alami, dengan extension bersih dan kait tersembunyi.',
      'Lipit depan membuka ke kaki panjang, sementara pinggang belakang diselesaikan dengan belahan untuk kenyamanan.',
      'Saku dipasang di kampuh samping agar garisnya tetap utuh.'
    ],
    detail: 'High rise · 82 cm inseam',
    detail_id: 'Pinggang tinggi · inseam 82 cm'
  },
  skirts: {
    form_en: [
      'The skirt is cut with a narrow waistband and a bias fall that gives the fabric its own movement.',
      'A concealed side zip keeps the surface quiet; the hem is left raw or hand-rolled depending on the cloth.',
      'The silhouette is balanced to sit just below the knee or graze the floor without a train.'
    ],
    form_id: [
      'Rok dipotong dengan ban pinggang sempit dan jatuh bias yang memberi kain geraknya sendiri.',
      'Zipper samping tersembunyi menjaga permukaan tetap sunyi; ujungnya dibiarkan mentah atau digulung tangan tergantung kainnya.',
      'Siluetnya diseimbangkan untuk duduk tepat di bawah lutut atau menyentuh lantai tanpa ekor.'
    ],
    detail: 'Midi length · 78 cm',
    detail_id: 'Panjang midi · 78 cm'
  },
  denim: {
    form_en: [
      'Woven on a narrow shuttle loom, the denim is rigid at first and softens into the shape of the wearer.',
      'Tonal stitching and darkened hardware keep the construction visible only at close range.',
      'The waistband is finished by hand, with a small star stitch inside the coin pocket.'
    ],
    form_id: [
      'Ditenun di loom shuttle sempit, denim awalnya kaku lalu melembut mengikuti bentuk pemakainya.',
      'Jahitan senada dan hardware yang digelapkan membuat konstruksinya hanya terlihat dari jarak dekat.',
      'Ban pinggang diselesaikan tangan, dengan jahitan bintang kecil di dalam saku koin.'
    ],
    detail: 'Mid rise · straight leg',
    detail_id: 'Pinggang sedang · kaki lurus'
  },
  loungewear: {
    form_en: [
      'Cut with a soft, generous line and French seams, the piece is made to be worn without being thought about.',
      'A narrow silk cord and deep patch pockets keep the practical details quiet.',
      'The fabric is washed before cutting so it arrives already softened and at home on the body.'
    ],
    form_id: [
      'Dipotong dengan garis lembut dan lapang serta kampuh Prancis, karya ini dibuat untuk dikenakan tanpa dipikirkan.',
      'Tali sutra sempit dan saku tempel dalam menjaga detail praktis tetap sunyi.',
      'Kain dicuci sebelum dipotong sehingga tiba dalam keadaan lembut dan terasa akrab di tubuh.'
    ],
    detail: 'Relaxed fit · soft drape',
    detail_id: 'Potongan santai · jatuh lembut'
  }
};

const CARE = {
  outerwear: {
    en: 'Dry clean only. Brush the surface with a soft clothes brush after wear and hang on a broad wooden hanger. Keep leather away from prolonged moisture and direct heat. Do not machine wash or tumble dry.',
    id: 'Hanya dry clean. Sikat permukaannya dengan sikat pakaian lembut setelah dipakai dan gantung pada hanger kayu lebar. Jauhkan kulit dari kelembapan berkepanjangan dan panas langsung. Jangan cuci mesin atau keringkan dengan mesin.'
  },
  apparel: {
    en: 'Dry clean or hand wash cold with a gentle detergent. Wash inside out with similar colours. Do not bleach. Dry flat in shade and press on low heat. Store folded or on a padded hanger.',
    id: 'Dry clean atau cuci tangan dengan air dingin dan deterjen lembut. Cuci bagian dalam keluar dengan warna serupa. Jangan gunakan pemutih. Keringkan dengan cara dibentangkan di tempat teduh dan setrika pada suhu rendah. Simpan terlipat atau di hanger berlapis.'
  },
  denim: {
    en: 'Wash sparingly, inside out and cold, to preserve the indigo. Do not bleach or tumble dry. Hang to dry in shade. The denim will soften and lighten at the folds with wear; this is intrinsic to the cloth.',
    id: 'Cuci sesekali, bagian dalam keluar dan air dingin, untuk menjaga indigo. Jangan gunakan pemutih atau keringkan dengan mesin. Gantung di tempat teduh. Denim akan melembut dan memudar di lipatan seiring pemakaian; ini bagian intrinsik dari kain.'
  }
};

const CATEGORY_CARE_KEY = {
  outerwear: 'outerwear',
  tailoring: 'apparel',
  knitwear: 'apparel',
  dresses: 'apparel',
  tops: 'apparel',
  trousers: 'apparel',
  skirts: 'apparel',
  denim: 'denim',
  loungewear: 'apparel'
};

// Name | price USD | collection | material | finish | motif | garment art
const SPECS = {
  outerwear: [
    ['Eclipsed Trench Coat', 1290, 'starfall', 'tech_nylon', 'matte', 'eclipse', 'trench'],
    ['Nocturne Leather Blouson', 1150, 'nocturne', 'lamb_leather', 'waxed', 'serpent', 'blouson'],
    ['Thornwreath Wool Cape', 980, 'oathbound', 'wool_flannel', 'brushed', 'thorn', 'cape'],
    ['Reliquary Long Coat', 1390, 'reliquary', 'wool_suiting', 'hand_finished', 'key', 'long_coat'],
    ['Mothwing Harrington', 760, 'nocturne', 'tech_nylon', 'matte', 'moth', 'harrington'],
    ['Starfall Quilted Puffer', 890, 'starfall', 'tech_nylon', 'matte', 'star', 'puffer'],
    ['Belladonna Trench', 1180, 'reliquary', 'cotton_twill', 'garment_dyed', 'belladonna', 'trench'],
    ['Oathbound Field Coat', 1050, 'oathbound', 'wool_flannel', 'garment_dyed', 'dagger', 'field_coat']
  ],
  tailoring: [
    ['Eclipse Shawl Blazer', 920, 'starfall', 'wool_suiting', 'hand_finished', 'eclipse', 'blazer'],
    ['Ophidian Waistcoat', 480, 'nocturne', 'wool_suiting', 'matte', 'serpent', 'waistcoat'],
    ['Mourning Star Tuxedo Jacket', 1080, 'starfall', 'wool_suiting', 'hand_finished', 'star', 'tuxedo'],
    ['Reliquary Column Suit', 1240, 'reliquary', 'wool_suiting', 'brushed', 'key', 'suit'],
    ['Nocturne Double-Breasted Blazer', 960, 'nocturne', 'wool_flannel', 'brushed', 'moon', 'double_blazer'],
    ['Thorncut Tailored Vest', 520, 'oathbound', 'wool_flannel', 'raw_hem', 'thorn', 'vest'],
    ['Astral Key Smoking Jacket', 1120, 'reliquary', 'silk_velvet', 'hand_finished', 'key', 'smoking_jacket'],
    ['Crown of Static Suit', 1320, 'oathbound', 'wool_suiting', 'hand_finished', 'crown', 'suit']
  ],
  knitwear: [
    ['Eclipsed Halo Turtleneck', 390, 'starfall', 'merino', 'hand_finished', 'eclipse', 'turtleneck'],
    ['Serpent Cable Knit', 460, 'nocturne', 'merino', 'brushed', 'serpent', 'cable_knit'],
    ['Grave Lily Cardigan', 420, 'reliquary', 'mohair', 'brushed', 'lily', 'cardigan'],
    ['Night Owl Mohair Sweater', 480, 'nocturne', 'mohair', 'brushed', 'owl', 'sweater'],
    ['Starfall Ribbed Top', 320, 'starfall', 'merino', 'garment_dyed', 'star', 'ribbed_top'],
    ['Thorn Crown Knit Vest', 350, 'oathbound', 'merino', 'raw_hem', 'thorn', 'knit_vest'],
    ['Oracle Funnel Neck', 440, 'reliquary', 'wool_flannel', 'brushed', 'eye', 'funnel_neck'],
    ['Moonlit Hooded Knit', 410, 'nocturne', 'mohair', 'garment_dyed', 'moon', 'hooded_knit']
  ],
  dresses: [
    ['Eclipse Bias Slip Dress', 680, 'starfall', 'silk_satin', 'hand_finished', 'eclipse', 'slip_dress'],
    ['Nocturne Velvet Column Dress', 890, 'nocturne', 'silk_velvet', 'raw_hem', 'moon', 'column_dress'],
    ['Thornwreath Mesh Gown', 1150, 'oathbound', 'silk_mesh', 'raw_hem', 'thorn', 'gown'],
    ['Reliquary Lace Dress', 980, 'reliquary', 'silk_mesh', 'hand_finished', 'key', 'lace_dress'],
    ['Mothwing Cocktail Dress', 760, 'nocturne', 'silk_satin', 'hand_finished', 'moth', 'cocktail_dress'],
    ['Starfall Asymmetric Dress', 820, 'starfall', 'silk_satin', 'raw_hem', 'star', 'asymmetric_dress'],
    ['Belladonna Wrap Dress', 640, 'reliquary', 'viscose', 'garment_dyed', 'belladonna', 'wrap_dress'],
    ['Oathbound Column Dress', 920, 'oathbound', 'silk', 'hand_finished', 'dagger', 'column_dress']
  ],
  tops: [
    ['Eclipsed Collar Shirt', 340, 'starfall', 'cotton_poplin', 'hand_finished', 'eclipse', 'shirt'],
    ['Nocturne Silk Blouse', 390, 'nocturne', 'silk_satin', 'raw_hem', 'serpent', 'blouse'],
    ['Mourning Star Corset Top', 420, 'starfall', 'silk_satin', 'hand_finished', 'star', 'corset_top'],
    ['Reliquary Key Blouse', 360, 'reliquary', 'silk', 'hand_finished', 'key', 'key_blouse'],
    ['Thorncut Poplin Shirt', 310, 'oathbound', 'cotton_poplin', 'raw_hem', 'thorn', 'poplin_shirt'],
    ['Mothwing Sheer Top', 290, 'nocturne', 'silk_mesh', 'raw_hem', 'moth', 'sheer_top'],
    ['Oracle High-Neck Top', 330, 'reliquary', 'modal', 'matte', 'eye', 'high_neck_top'],
    ['Crown of Static Tee', 180, 'oathbound', 'cotton_jersey', 'garment_dyed', 'crown', 'tee']
  ],
  trousers: [
    ['Eclipse Wide-Leg Trouser', 520, 'starfall', 'wool_suiting', 'hand_finished', 'eclipse', 'wide_trouser'],
    ['Nocturne Leather Trouser', 890, 'nocturne', 'lamb_leather', 'waxed', 'serpent', 'leather_trouser'],
    ['Thornwreath Pleated Trouser', 480, 'oathbound', 'wool_flannel', 'brushed', 'thorn', 'pleated_trouser'],
    ['Reliquary Column Trouser', 540, 'reliquary', 'wool_suiting', 'hand_finished', 'key', 'column_trouser'],
    ['Starfall Cargo Trouser', 460, 'starfall', 'tech_nylon', 'matte', 'star', 'cargo_trouser'],
    ['Mothwing Silk Pant', 420, 'nocturne', 'silk_satin', 'raw_hem', 'moth', 'silk_pant'],
    ['Belladonna Tailored Short', 340, 'reliquary', 'wool_suiting', 'hand_finished', 'belladonna', 'short'],
    ['Oathbound Utility Pant', 390, 'oathbound', 'cotton_twill', 'garment_dyed', 'dagger', 'utility_pant']
  ],
  skirts: [
    ['Eclipse Bias Skirt', 480, 'starfall', 'silk_satin', 'raw_hem', 'eclipse', 'bias_skirt'],
    ['Nocturne Leather Midi', 790, 'nocturne', 'lamb_leather', 'waxed', 'moon', 'leather_skirt'],
    ['Thornwreath Pleated Skirt', 420, 'oathbound', 'wool_flannel', 'brushed', 'thorn', 'pleated_skirt'],
    ['Reliquary Column Skirt', 460, 'reliquary', 'wool_suiting', 'hand_finished', 'key', 'column_skirt'],
    ['Starfall Asymmetric Skirt', 390, 'starfall', 'silk_satin', 'raw_hem', 'star', 'asymmetric_skirt'],
    ['Mothwing Sheer Skirt', 350, 'nocturne', 'silk_mesh', 'raw_hem', 'moth', 'sheer_skirt'],
    ['Belladonna Wrap Skirt', 380, 'reliquary', 'viscose', 'garment_dyed', 'belladonna', 'wrap_skirt'],
    ['Oathbound Utility Skirt', 360, 'oathbound', 'cotton_twill', 'garment_dyed', 'dagger', 'utility_skirt']
  ],
  denim: [
    ['Eclipse Straight Jean', 320, 'starfall', 'denim', 'stone_washed', 'star', 'straight_jean'],
    ['Nocturne Overdyed Jean', 340, 'nocturne', 'washed_denim', 'overdyed', 'serpent', 'overdyed_jean'],
    ['Thornwreath Wide Jean', 360, 'oathbound', 'denim', 'stone_washed', 'thorn', 'wide_jean'],
    ['Reliquary Column Jean', 380, 'reliquary', 'denim', 'enzyme_washed', 'key', 'column_jean'],
    ['Starfall Trucker Jacket', 460, 'starfall', 'denim', 'stone_washed', 'star', 'denim_jacket'],
    ['Mothwing Carpenter Jean', 350, 'nocturne', 'denim', 'garment_dyed', 'moth', 'carpenter_jean'],
    ['Belladonna Denim Mini', 280, 'reliquary', 'washed_denim', 'raw_hem', 'belladonna', 'denim_skirt'],
    ['Oathbound Denim Jacket', 420, 'oathbound', 'denim', 'overdyed', 'dagger', 'denim_jacket']
  ],
  loungewear: [
    ['Eclipse Silk Robe', 540, 'starfall', 'silk_satin', 'hand_finished', 'eclipse', 'robe'],
    ['Nocturne Cashmere Set', 620, 'nocturne', 'cashmere', 'brushed', 'moon', 'lounge_set'],
    ['Thornwreath Lounge Pant', 280, 'oathbound', 'modal', 'garment_dyed', 'thorn', 'lounge_pant'],
    ['Reliquary Long Kimono', 480, 'reliquary', 'silk', 'hand_finished', 'key', 'kimono'],
    ['Starfall Jersey Set', 260, 'starfall', 'cotton_jersey', 'garment_dyed', 'star', 'lounge_set'],
    ['Mothwing Slip Set', 380, 'nocturne', 'silk_satin', 'raw_hem', 'moth', 'slip_set'],
    ['Belladonna Bed Jacket', 460, 'reliquary', 'silk_velvet', 'hand_finished', 'belladonna', 'bed_jacket'],
    ['Oathbound Cotton Set', 240, 'oathbound', 'cotton_jersey', 'garment_dyed', 'dagger', 'lounge_set']
  ]
};

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function variantLabels(categoryId) {
  if (categoryId === 'trousers' || categoryId === 'denim') return ['28', '30', '32', '34', '36'];
  return ['XS', 'S', 'M', 'L', 'XL'];
}

function buildProduct(category, spec, categoryIndex, globalIndex) {
  const [name, price, collection, materialKey, finishKey, motifKey, art] = spec;
  const material = MATERIALS[materialKey];
  const finish = FINISHES[finishKey];
  const motif = MOTIFS[motifKey];
  const lines = CATEGORY_LINES[category.id];
  const formEn = lines.form_en[globalIndex % lines.form_en.length];
  const formId = lines.form_id[globalIndex % lines.form_id.length];
  const themeIndex = globalIndex % THEMES_EN.length;

  const descriptionEn = `${name} is a ${category.noun_en} carrying the ${motif.en} motif, shaped around the tension between ${THEMES_EN[themeIndex]}. Cut from ${material.en.toLowerCase()} with a ${finish.en.toLowerCase()} surface, it is designed to gather shadow rather than announce itself. ${formEn} Each piece is cut and sewn in numbered small batches by the Starfall Enigma atelier.`;
  const descriptionId = `${name} adalah sebuah ${category.noun_id} dengan motif ${motif.id}, dibentuk dari ketegangan antara ${THEMES_ID[themeIndex]}. Dipotong dari ${material.id.toLowerCase()} dengan permukaan ${finish.id.toLowerCase()}, dibuat untuk mengumpulkan bayangan alih-alih menarik perhatian. ${formId} Setiap karya dipotong dan dijahit dalam batch kecil bernomor oleh atelier Starfall Enigma.`;

  const baseCents = Math.round(price * 100);
  const labels = variantLabels(category.id);
  const care = CARE[CATEGORY_CARE_KEY[category.id]];
  const newArrival = globalIndex % 6 === 0 || categoryIndex < 2;
  const bestseller = globalIndex % 11 === 0 || globalIndex === 5;
  let badge = '';
  if (newArrival) badge = 'new';
  else if (bestseller) badge = 'bestseller';

  const slug = slugify(name);
  const skuNumber = String(globalIndex + 1).padStart(3, '0');
  const detailsEn = [
    { label: 'Material', value: material.en },
    { label: 'Finish', value: finish.en },
    { label: 'Fit', value: lines.detail },
    { label: 'Made', value: 'Cut and sewn in small-batch atelier production' },
    { label: 'Edition', value: 'Numbered archive piece' }
  ];
  const detailsId = [
    { label: 'Material', value: material.id },
    { label: 'Finishing', value: finish.id },
    { label: 'Potongan', value: lines.detail_id },
    { label: 'Produksi', value: 'Dipotong dan dijahit dalam produksi atelier batch kecil' },
    { label: 'Edisi', value: 'Karya arsip bernomor' }
  ];

  return {
    slug,
    sku: `SE-${category.prefix}-${skuNumber}`,
    name,
    category: category.id,
    categoryLabelEn: category.label_en,
    categoryLabelId: category.label_id,
    collection,
    priceCents: baseCents,
    price,
    materialKey,
    finishKey,
    materialEn: material.en,
    materialId: material.id,
    finishEn: finish.en,
    finishId: finish.id,
    motifKey,
    motifEn: motif.en,
    motifId: motif.id,
    descriptionEn,
    descriptionId,
    detailsEn,
    detailsId,
    careEn: care.en,
    careId: care.id,
    badge,
    featured: categoryIndex === 0 || globalIndex % 13 === 0,
    newArrival: newArrival ? 1 : 0,
    bestseller: bestseller ? 1 : 0,
    imageA: `/assets/img/products/${slug}-a.svg`,
    imageB: `/assets/img/products/${slug}-b.svg`,
    art,
    variants: labels.map((label, variantIndex) => ({
      sku: `SE-${category.prefix}-${skuNumber}-${String(variantIndex + 1).padStart(2, '0')}`,
      label,
      priceDeltaCents: 0
    }))
  };
}

function buildCatalogue() {
  const products = [];
  let globalIndex = 0;
  for (const category of CATEGORY_LIST) {
    const specs = SPECS[category.id] || [];
    specs.forEach((spec, categoryIndex) => {
      products.push(buildProduct(category, spec, categoryIndex, globalIndex));
      globalIndex += 1;
    });
  }
  return products;
}

const PRODUCTS = buildCatalogue();

function findCategory(id) {
  return CATEGORY_LIST.find((category) => category.id === id);
}

function findProductBySlug(slug) {
  return PRODUCTS.find((product) => product.slug === slug);
}

module.exports = {
  CATEGORY_LIST,
  CATEGORIES: CATEGORY_LIST,
  COLLECTIONS,
  PRODUCTS,
  MATERIALS,
  FINISHES,
  MOTIFS,
  CARE,
  CATEGORY_CARE_KEY,
  slugify,
  hashString,
  findCategory,
  buildCatalogue
};
