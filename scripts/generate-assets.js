'use strict';

/**
 * Generates two original vector packshots for every apparel piece.
 * No external images, fonts, scripts or URLs are embedded in the SVGs.
 */

const fs = require('fs');
const path = require('path');
const { PRODUCTS, hashString } = require('../src/catalog');

const ROOT = path.resolve(__dirname, '..');
const PRODUCT_OUT = path.join(ROOT, 'public', 'assets', 'img', 'products');

fs.rmSync(PRODUCT_OUT, { recursive: true, force: true });
fs.mkdirSync(PRODUCT_OUT, { recursive: true });

const BONE = '#e8e1d5';
const BONE_DARK = '#c8bda9';
const INK = '#0d0e10';
const SILVER = '#b7b3aa';
const WINE = '#5b1821';

const CLOTH = {
  leather: { base: '#22191a', light: '#4c3334', line: '#a28f78', stitch: '#b89f83' },
  denim: { base: '#232c35', light: '#3b4b5a', line: '#9b7550', stitch: '#c6a173' },
  wool: { base: '#29272a', light: '#4a4549', line: '#a49a8a', stitch: '#c0b5a2' },
  silk: { base: '#45141f', light: '#742434', line: '#c9a987', stitch: '#d7bd9c' },
  knit: { base: '#3a3531', light: '#5a514a', line: '#b0a28e', stitch: '#d1c3ad' },
  cotton: { base: '#b6aa96', light: '#d7ccb9', line: '#665d51', stitch: '#7e7364' },
  fluid: { base: '#5a5550', light: '#847c73', line: '#cfc4b2', stitch: '#e0d4c1' }
};

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function clothFor(product) {
  const material = product.materialKey;
  if (material.includes('leather')) return CLOTH.leather;
  if (material.includes('denim')) return CLOTH.denim;
  if (material.includes('silk')) return CLOTH.silk;
  if (['merino', 'mohair', 'cashmere', 'wool_suiting', 'wool_flannel'].includes(material)) return CLOTH.wool;
  if (['cotton_poplin', 'cotton_twill', 'cotton_jersey'].includes(material)) return CLOTH.cotton;
  if (['viscose', 'modal', 'linen'].includes(material)) return CLOTH.fluid;
  return CLOTH.knit;
}

function motifMark(key, x, y, size, color, width = 2) {
  const s = size / 2;
  const common = `fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (key) {
    case 'eclipse':
      return `<g ${common}><circle cx="${x}" cy="${y}" r="${s}"/><path d="M${x + s * 0.2} ${y - s} A ${s} ${s} 0 0 0 ${x + s * 0.2} ${y + s}" fill="${color}" stroke="none" opacity=".7"/></g>`;
    case 'moon':
      return `<path d="M${x + s * 0.4} ${y - s} A ${s} ${s} 0 1 0 ${x + s * 0.4} ${y + s} A ${s * 0.72} ${s * 0.72} 0 1 1 ${x + s * 0.4} ${y - s}Z" fill="${color}" ${common.replace('fill="none" ', '')}/>`;
    case 'star':
      return `<path d="M${x} ${y - s} L${x + s * 0.22} ${y - s * 0.22} L${x + s} ${y} L${x + s * 0.22} ${y + s * 0.22} L${x} ${y + s} L${x - s * 0.22} ${y + s * 0.22} L${x - s} ${y} L${x - s * 0.22} ${y - s * 0.22}Z" fill="${color}" stroke="none"/>`;
    case 'serpent':
      return `<path d="M${x - s} ${y + s * 0.6} C${x - s * 0.4} ${y - s} ${x + s * 0.4} ${y + s} ${x + s} ${y - s * 0.6} M${x + s * 0.7} ${y - s * 0.9} l${s * 0.2} ${s * 0.15} l${s * 0.1} ${-s * 0.2}" ${common}/>`;
    case 'moth':
      return `<g ${common}><path d="M${x} ${y} C${x - s * 0.8} ${y - s} ${x - s} ${y + s * 0.2} ${x - s * 0.1} ${y + s * 0.45} M${x} ${y} C${x + s * 0.8} ${y - s} ${x + s} ${y + s * 0.2} ${x + s * 0.1} ${y + s * 0.45} M${x} ${y - s * 0.4} L${x} ${y + s * 0.7}"/></g>`;
    case 'key':
      return `<g ${common}><circle cx="${x}" cy="${y - s * 0.55}" r="${s * 0.35}"/><path d="M${x} ${y - s * 0.2} L${x} ${y + s} M${x} ${y + s * 0.45} L${x + s * 0.45} ${y + s * 0.45} M${x} ${y + s * 0.72} L${x + s * 0.3} ${y + s * 0.72}"/></g>`;
    case 'dagger':
      return `<g ${common}><path d="M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.15} L${x} ${y + s * 0.55} L${x - s * 0.28} ${y - s * 0.15}Z M${x - s * 0.42} ${y + s * 0.15} L${x + s * 0.42} ${y + s * 0.15} M${x} ${y + s * 0.55} L${x} ${y + s}"/></g>`;
    case 'thorn':
      return `<path d="M${x - s} ${y + s * 0.8} L${x - s * 0.4} ${y + s * 0.2} L${x - s * 0.55} ${y - s * 0.1} L${x + s * 0.15} ${y - s * 0.8} L${x + s * 0.05} ${y - s * 0.2} L${x + s} ${y + s * 0.2}" ${common}/>`;
    case 'crown':
      return `<g ${common}><path d="M${x - s} ${y + s * 0.35} L${x - s * 0.6} ${y - s * 0.55} L${x - s * 0.2} ${y + s * 0.05} L${x} ${y - s * 0.85} L${x + s * 0.2} ${y + s * 0.05} L${x + s * 0.6} ${y - s * 0.55} L${x + s} ${y + s * 0.35}Z M${x - s} ${y + s * 0.65} L${x + s} ${y + s * 0.65}"/></g>`;
    default:
      return `<g ${common}><circle cx="${x}" cy="${y}" r="${s * 0.8}"/><path d="M${x - s} ${y} L${x + s} ${y} M${x} ${y - s} L${x} ${y + s}"/></g>`;
  }
}

function longCoat(art, c, detail = false) {
  const short = ['blouson', 'harrington', 'puffer', 'jacket'].includes(art);
  const hem = short ? 760 : 1010;
  const cape = art === 'cape';
  if (cape) {
    return `<path d="M365 300 Q500 245 635 300 L770 760 Q500 830 230 760 Z" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>
      <path d="M365 300 Q500 265 635 300 L650 470 Q500 520 350 470 Z" fill="${c.light}" opacity=".75"/>
      <path d="M350 470 Q500 530 650 470 M300 640 Q500 710 700 640" fill="none" stroke="${c.stitch}" stroke-width="1.2" opacity=".7"/>`;
  }
  const body = `M370 300 L435 268 Q500 312 565 268 L630 300 L704 362 L670 480 L620 452 L642 ${hem} L358 ${hem} L380 452 L330 480 L296 362 Z`;
  const lapels = `<path d="M435 268 L500 405 L470 472 L420 342 Z M565 268 L500 405 L530 472 L580 342 Z" fill="${c.light}" opacity=".55"/>`;
  const belt = short ? '' : `<path d="M358 610 Q500 640 642 610 L642 658 Q500 688 358 658 Z" fill="${c.light}" opacity=".55"/><path d="M500 615 L500 676" stroke="${c.stitch}" stroke-width="2"/>`;
  const quilting = art === 'puffer'
    ? [480, 545, 610, 675, 740].map((y) => `<path d="M370 ${y} Q500 ${y + 18} 630 ${y}" fill="none" stroke="${c.stitch}" stroke-width="1.2" opacity=".55"/>`).join('')
    : '';
  const pockets = `<path d="M402 705 L472 705 M528 705 L598 705" stroke="${c.stitch}" stroke-width="1.2" opacity=".7"/><path d="M430 300 L430 ${hem - 20} M570 300 L570 ${hem - 20}" stroke="${c.line}" stroke-width="1" opacity=".25"/>`;
  const sleeve = short
    ? `<path d="M370 300 L330 480 L290 452 L296 362 Z M630 300 L670 480 L710 452 L704 362 Z" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>`
    : `<path d="M370 300 L312 660 L368 686 L406 445 Z M630 300 L688 660 L632 686 L594 445 Z" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>
       <path d="M318 646 L370 670 M682 646 L630 670" stroke="${c.stitch}" stroke-width="1.2" opacity=".55"/>`;
  return `${sleeve}<path d="${body}" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>${lapels}${belt}${quilting}${pockets}${detail && !short ? `<path d="M430 ${hem - 50} L570 ${hem - 50}" stroke="${c.stitch}" stroke-width="1.2" opacity=".55"/>` : ''}`;
}

function blazer(art, c) {
  if (art === 'waistcoat' || art === 'vest') {
    return `<path d="M410 300 L452 278 Q500 308 548 278 L590 300 L614 790 L386 790 Z" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>
      <path d="M452 278 L500 450 L548 278 L536 760 L464 760 Z" fill="${c.light}" opacity=".35"/>
      <path d="M500 450 L500 760" stroke="${c.stitch}" stroke-width="1.2"/>${[500, 560, 620, 680].map((y) => `<circle cx="500" cy="${y}" r="4" fill="${c.stitch}"/>`).join('')}`;
  }
  if (art === 'smoking_jacket') {
    return `<path d="M360 310 L430 276 Q500 322 570 276 L640 310 L700 370 L670 490 L620 462 L650 830 L350 830 L380 462 L330 490 L300 370 Z" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>
      <path d="M430 276 L500 440 L570 276 L610 320 L540 470 L610 520 L500 640 L390 520 L460 470 L390 320 Z" fill="${c.light}" opacity=".65"/>
      <path d="M350 830 L350 900 L650 900 L650 830" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>`;
  }
  const trousers = art === 'suit'
    ? `<path d="M390 770 L430 1120 L490 1120 L500 850 L510 1120 L570 1120 L610 770 Z" fill="${c.base}" opacity=".55" stroke="${c.light}" stroke-width="1.5"/>`
    : '';
  return `${trousers}<path d="M360 310 L318 610 L372 632 L412 465 Z M640 310 L682 610 L628 632 L588 465 Z" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>
    <path d="M360 310 L430 276 Q500 322 570 276 L640 310 L700 370 L668 480 L625 455 L650 830 L350 830 L375 455 L332 480 L300 370 Z" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>
    <path d="M430 276 L500 425 L470 480 L420 340 Z M570 276 L500 425 L530 480 L580 340 Z" fill="${c.light}" opacity=".6"/>
    <path d="M350 830 L350 880 L650 880 L650 830" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>
    <path d="M325 590 L370 612 M675 590 L630 612" stroke="${c.stitch}" stroke-width="1.2" opacity=".55"/>
    <circle cx="585" cy="620" r="5" fill="${c.stitch}"/>`;
}

function knit(art, c) {
  const open = art === 'cardigan' || art === 'bed_jacket';
  const vest = art === 'knit_vest';
  const hood = art === 'hooded_knit';
  const collar = ['turtleneck', 'funnel_neck'].includes(art)
    ? `<path d="M440 300 Q500 260 560 300 L555 365 Q500 335 445 365 Z" fill="${c.light}" stroke="${c.line}" stroke-width="1.5"/>`
    : '';
  const base = vest
    ? `<path d="M405 320 L452 292 Q500 326 548 292 L595 320 L610 790 L390 790 Z" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>`
    : `<path d="M360 320 Q500 272 640 320 L700 390 L660 535 L610 510 L600 800 Q500 830 400 800 L390 510 L340 535 L300 390 Z" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>`;
  const front = open
    ? `<path d="M500 330 L500 805 M430 350 L430 795 M570 350 L570 795" stroke="${c.stitch}" stroke-width="1.5" opacity=".75"/>`
    : `<path d="M430 350 L430 790 M570 350 L570 790" stroke="${c.stitch}" stroke-width="1" opacity=".45"/>`;
  const hoodShape = hood
    ? `<path d="M380 320 Q380 170 500 160 Q620 170 620 320 Q500 270 380 320 Z" fill="${c.light}" opacity=".8" stroke="${c.light}" stroke-width="2"/>`
    : '';
  const rib = `<path d="M400 790 Q500 820 600 790 M400 810 Q500 840 600 810" fill="none" stroke="${c.stitch}" stroke-width="2" opacity=".8"/>`;
  const cables = ['cable_knit', 'sweater'].includes(art)
    ? [450, 500, 550].map((x) => `<path d="M${x} 380 C${x - 18} 460 ${x + 18} 540 ${x} 620 C${x - 18} 700 ${x + 18} 760 ${x} 800" fill="none" stroke="${c.stitch}" stroke-width="1.1" opacity=".4"/>`).join('')
    : '';
  return `${hoodShape}${base}${collar}${front}${rib}${cables}`;
}

function dress(art, c) {
  const short = ['cocktail_dress', 'slip_dress'].includes(art);
  const wide = ['gown', 'lace_dress'].includes(art);
  const asym = art === 'asymmetric_dress';
  const wrap = art === 'wrap_dress';
  const hem = short ? 870 : wide ? 1080 : 1040;
  const width = wide ? 210 : short ? 130 : 150;
  const path = `M455 300 Q500 270 545 300 L560 370 L575 620 Q${500 + width} ${hem - 70} ${500 + width} ${hem} L${500 - width} ${hem} Q${500 - width} ${hem - 70} 425 620 L440 370 Z`;
  const straps = asym
    ? `<path d="M455 300 L500 285 M545 300 L575 250" stroke="${c.stitch}" stroke-width="5" fill="none"/>`
    : `<path d="M455 300 L470 250 M545 300 L530 250" stroke="${c.stitch}" stroke-width="4" fill="none"/>`;
  const neckline = wrap
    ? `<path d="M455 300 L500 480 L545 300" fill="none" stroke="${c.stitch}" stroke-width="1.5"/>`
    : '';
  const drape = `<path d="M440 620 Q500 670 560 620 M${500 - width + 20} ${hem - 20} Q500 ${hem - 70} ${500 + width - 20} ${hem - 20}" fill="none" stroke="${c.stitch}" stroke-width="1" opacity=".45"/>`;
  return `${path ? `<path d="${path}" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>` : ''}${straps}${neckline}${drape}`;
}

function top(art, c) {
  const tee = ['tee', 'corset_top'].includes(art);
  const corset = art === 'corset_top';
  const sheer = art === 'sheer_top';
  const high = art === 'high_neck_top';
  if (corset) {
    return `<path d="M420 340 Q500 300 580 340 L565 730 L435 730 Z" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>
      ${[390, 450, 510, 570, 630, 690].map((y) => `<path d="M440 ${y} Q500 ${y - 8} 560 ${y}" fill="none" stroke="${c.stitch}" stroke-width="1" opacity=".65"/>`).join('')}
      <path d="M500 350 L500 720" stroke="${c.stitch}" stroke-width="1.5"/>`;
  }
  const sleeve = tee
    ? `<path d="M390 350 L330 470 L380 500 L410 440 M610 350 L670 470 L620 500 L590 440" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>`
    : `<path d="M390 350 L320 600 L375 625 L420 520 M610 350 L680 600 L625 625 L580 520" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>`;
  const collar = high
    ? `<path d="M450 340 Q500 300 550 340 L548 390 Q500 365 452 390 Z" fill="${c.light}" opacity=".7"/>`
    : `<path d="M450 340 L500 400 L550 340" fill="none" stroke="${c.stitch}" stroke-width="1.5"/>`;
  return `${sleeve}<path d="M390 350 Q500 310 610 350 L590 720 Q500 750 410 720 Z" fill="${c.base}" fill-opacity="${sheer ? '.62' : '1'}" stroke="${c.light}" stroke-width="2"/>${collar}
    ${!tee && !sheer ? `<path d="M500 405 L500 715" stroke="${c.stitch}" stroke-width="1" opacity=".6"/>${[455, 515, 575, 635, 695].map((y) => `<circle cx="500" cy="${y}" r="3.5" fill="${c.stitch}"/>`).join('')}` : ''}`;
}

function trousers(art, c) {
  const short = art === 'short';
  const wide = ['wide_trouser', 'pleated_trouser', 'cargo_trouser', 'utility_pant'].includes(art);
  const leather = art === 'leather_trouser';
  const leg = wide ? 150 : leather ? 100 : 120;
  const hem = short ? 750 : 1080;
  return `<path d="M390 330 L610 330 L${500 + leg} ${hem} L${500 + 20} ${hem} L500 580 L${500 - 20} ${hem} L${500 - leg} ${hem} Z" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>
    <path d="M390 330 L610 330 L610 390 L390 390 Z" fill="${c.light}" opacity=".6"/>
    <path d="M410 390 L410 500 M590 390 L590 500" stroke="${c.stitch}" stroke-width="1.1" opacity=".5"/>
    <path d="M390 390 L390 420 M610 390 L610 420" stroke="${c.stitch}" stroke-width="1.5"/>
    ${wide ? `<path d="M420 410 L425 ${hem - 10} M580 410 L575 ${hem - 10}" stroke="${c.stitch}" stroke-width="1" opacity=".5"/>` : ''}
    ${art === 'cargo_trouser' || art === 'utility_pant' ? `<path d="M420 560 L485 560 L485 630 L420 630 Z M580 560 L515 560 L515 630 L580 630 Z" fill="none" stroke="${c.stitch}" stroke-width="1.2"/>` : ''}`;
}

function skirt(art, c) {
  const mini = ['denim_skirt'].includes(art);
  const pleated = art === 'pleated_skirt';
  const asym = art === 'asymmetric_skirt';
  const leather = art === 'leather_skirt';
  const hem = mini ? 740 : 1000;
  const flare = leather ? 120 : 230;
  return `<path d="M400 340 L600 340 L${500 + flare} ${hem} L${500 - flare} ${hem} Z" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>
    <path d="M400 340 L600 340 L600 410 L400 410 Z" fill="${c.light}" opacity=".6"/>
    ${pleated ? [440, 480, 520, 560].map((x) => `<path d="M${x} 410 L${x + (x - 500) * 1.2} ${hem - 10}" stroke="${c.stitch}" stroke-width="1.2" opacity=".55"/>`).join('') : ''}
    ${asym ? `<path d="M400 340 L600 340 L640 760 L430 980 Z" fill="${c.base}" stroke="${c.light}" stroke-width="1.5"/>` : ''}
    <path d="M400 410 Q500 440 600 410" fill="none" stroke="${c.stitch}" stroke-width="1" opacity=".5"/>`;
}

function jeans(art, c) {
  if (art === 'denim_jacket') return longCoat('jacket', c, true);
  if (art === 'denim_skirt') return skirt('denim_skirt', c);
  const wide = art === 'wide_jean';
  const leg = wide ? 150 : 112;
  return `<path d="M390 330 L610 330 L${500 + leg} 1080 L${500 + 20} 1080 L500 590 L${500 - 20} 1080 L${500 - leg} 1080 Z" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>
    <path d="M390 330 L610 330 L610 400 L390 400 Z" fill="${c.light}" opacity=".55"/>
    <path d="M430 400 L430 470 M570 400 L570 470" stroke="${c.stitch}" stroke-width="1.2"/>
    <path d="M405 500 Q430 520 455 500 M545 500 Q570 520 595 500" fill="none" stroke="${c.stitch}" stroke-width="1" opacity=".6"/>
    <path d="M450 330 L450 390 M550 330 L550 390" stroke="${c.stitch}" stroke-width="1.2"/>`;
}

function loungewear(art, c) {
  if (art === 'lounge_pant') return trousers('silk_pant', c);
  if (art === 'slip_set') return dress('slip_dress', c);
  if (art === 'lounge_set') {
    return `${top('shirt', c)}<g transform="translate(0 210) scale(.9) translate(55 0)">${trousers('silk_pant', c)}</g>`;
  }
  const robe = art === 'robe' || art === 'kimono' || art === 'bed_jacket';
  if (!robe) return knit(art, c);
  return `<path d="M370 300 L430 270 Q500 310 570 270 L630 300 L720 560 L670 590 L610 430 L640 1000 L360 1000 L390 430 L330 590 L280 560 Z" fill="${c.base}" stroke="${c.light}" stroke-width="2"/>
    <path d="M430 270 L500 520 L570 270 L540 690 L460 690 Z" fill="${c.light}" opacity=".6"/>
    <path d="M390 700 Q500 735 610 700" fill="none" stroke="${c.stitch}" stroke-width="2"/>
    <path d="M430 1000 L430 300 M570 1000 L570 300" stroke="${c.stitch}" stroke-width="1" opacity=".45"/>`;
}

function garment(product, detail = false) {
  const c = clothFor(product);
  let body;
  switch (product.category) {
    case 'outerwear': body = longCoat(product.art, c, detail); break;
    case 'tailoring': body = blazer(product.art, c); break;
    case 'knitwear': body = knit(product.art, c); break;
    case 'dresses': body = dress(product.art, c); break;
    case 'tops': body = top(product.art, c); break;
    case 'trousers': body = trousers(product.art, c); break;
    case 'skirts': body = skirt(product.art, c); break;
    case 'denim': body = jeans(product.art, c); break;
    case 'loungewear': body = loungewear(product.art, c); break;
    default: body = knit(product.art, c);
  }
  const motif = motifMark(product.motifKey, 500, 480, detail ? 45 : 34, c.stitch, 1.4);
  return `<g filter="url(#shadow)">${body}</g>${motif}`;
}

function background(dark, seed) {
  return `<rect width="1000" height="1250" fill="${dark ? 'url(#bgDark)' : 'url(#bgBone)'}"/>
    <g opacity="${dark ? '.22' : '.18'}" fill="none" stroke="${dark ? SILVER : INK}">
      <circle cx="500" cy="620" r="${300 + seed % 45}"/>
      <circle cx="500" cy="620" r="${420 + seed % 70}" stroke-dasharray="2 14"/>
      <path d="M100 120 L900 1130 M900 120 L100 1130" stroke-width=".6"/>
    </g>
    <g fill="${dark ? SILVER : INK}" opacity="${dark ? '.55' : '.35'}">
      <circle cx="160" cy="190" r="2"/><circle cx="820" cy="260" r="1.5"/><circle cx="770" cy="980" r="2.5"/><circle cx="210" cy="1040" r="1.5"/>
    </g>`;
}

function document(product, side) {
  const dark = side === 'b';
  const seed = hashString(`${product.slug}:${side}`) % 997;
  const title = `${product.name} - ${dark ? 'detail study' : 'front study'}`;
  const desc = `Original Starfall Enigma vector packshot for ${product.name}, ${product.categoryLabelEn}, ${dark ? 'detail view' : 'front view'}.`;
  const motif = motifMark(product.motifKey, dark ? 810 : 170, dark ? 1010 : 240, dark ? 86 : 62, dark ? '#c9a987' : WINE, 1.1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1250" width="1000" height="1250" role="img" aria-labelledby="title desc">
<title id="title">${esc(title)}</title>
<desc id="desc">${esc(desc)}</desc>
<defs>
  <linearGradient id="bgBone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0ebe1"/><stop offset=".55" stop-color="${BONE}"/><stop offset="1" stop-color="${BONE_DARK}"/></linearGradient>
  <linearGradient id="bgDark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#171719"/><stop offset=".6" stop-color="${INK}"/><stop offset="1" stop-color="#261a1c"/></linearGradient>
  <linearGradient id="cloth" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${clothFor(product).base}"/><stop offset="1" stop-color="${clothFor(product).light}"/></linearGradient>
  <filter id="shadow" x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#000" flood-opacity="${dark ? '.55' : '.18'}"/></filter>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .06"/></feComponentTransfer></filter>
</defs>
${background(dark, seed)}
${garment(product, dark)}
${motif}
<g fill="${dark ? '#b7b3aa' : '#4e4943'}" font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">
  <text x="500" y="1150" font-size="18" letter-spacing="7">STARFALL ENIGMA</text>
  <text x="500" y="1182" font-size="13" letter-spacing="3" opacity=".72">${esc(product.sku)} / ${esc(product.categoryLabelEn.toUpperCase())}</text>
  <text x="500" y="1214" font-size="11" letter-spacing="2" opacity=".55">${esc(product.name.toUpperCase())}</text>
</g>
<rect width="1000" height="1250" filter="url(#grain)" opacity=".55"/>
</svg>`;
}

let count = 0;
for (const product of PRODUCTS) {
  for (const side of ['a', 'b']) {
    const svg = document(product, side);
    fs.writeFileSync(path.join(PRODUCT_OUT, `${product.slug}-${side}.svg`), svg, 'utf8');
    count += 1;
  }
}

console.log(`Generated ${count} apparel packshots in public/assets/img/products.`);
