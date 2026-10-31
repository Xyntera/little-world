/* Little World - procedural low-poly cities. Original code, no copied assets. */
import * as THREE from '/vendor/three.module.js';
import { put, box, cyl, sph, cone, leafyTree, palm, M } from '/world.js';
import { mergeStatic } from '/merge.js';
import { riverReaches, bandOutline } from '/riverband.js';
import { buildAirport, buildFerry, AIRPORT_HALF, AIRPORT_COLLIDERS } from '/transport.js';

export const CITY_SIZE = 110; // half-width of the playable square

export const CITY_DEFS = {
  /* LICENCE TAG: mumbai.shoreEast northern half (z -104..0) derives from GSHHG 2.3.7 GSHHS_f L1 (LGPLv3+, (c) NOAA/Univ. of Hawaii - dev/gshhg-2.3.7-LICENSE.TXT, dev/PROVENANCE.md); southern half (z 0..104) is hand-simplified (Update 104 correction). INTERNAL-ONLY hold: do not deploy publicly without the owner decision recorded in dev/PROVENANCE.md. */
  mumbai: { name: 'Mumbai', sun: ['#ffdca8', 2.05], ground: '#9a9a8a', sky: '#f4c58a', fog: '#f0d4a8', bld: ['#d9b48f', '#c98a6b', '#e8d5b0', '#b9715a'], water: 'east', shoreEast: [[-104,64],[-96,66],[-88,70],[-80,40],[-72,46],[-64,26],[-56,18],[-48,22],[-40,26],[-32,30],[-24,30],[-16,36],[-8,40],[0,18],[8,18],[16,18],[24,18],[32,18],[40,18],[48,18],[56,18],[64,18],[72,18],[80,18],[88,18],[96,18],[104,18]], landmark: 'gateway', tree: '#3d8f4a' },
  delhi: { name: 'Delhi', sun: ['#ffe0b0', 1.95], ground: '#a9a07c', sky: '#e8d3a0', fog: '#ecdcb4', bld: ['#d6a27c', '#c97a52', '#e3c9a0', '#b66a4a'], water: null, circle: { r0: 8, r1: 16 }, landmark: 'indiagate', tree: '#4a8f3d' },
  dubai: { name: 'Dubai', sun: ['#ffd9a0', 2.1], ground: '#e0c48a', sky: '#9ad4f2', fog: '#e8dcc0', bld: ['#cfe3ec', '#a8c9d8', '#e8e8e8', '#7fa9bf'], water: 'north', landmark: 'spire', tree: '#5c9a3d' },
  london: { name: 'London', sun: ['#e8e2d0', 1.6], ground: '#7d8f7a', sky: '#a9b8c4', fog: '#b9c4cc', bld: ['#b87d62', '#a56a52', '#c9a58a', '#8d5c48'], water: null, arc: { cx: 24, cz: 24, r: 24, a0: Math.PI, a1: 1.5 * Math.PI, hw: 3.5 }, landmark: 'clock', tree: '#3f7f46',
    river: [[-112.00, 83.61, -90.23, 81.26],[-90.23, 81.26, -66.03, 86.26],[-66.03, 86.26, -54.38, 86.47],[-54.38, 86.47, -34.12, 80.85],[-34.12, 80.85, -19.31, 71.96],[-19.31, 71.96, -8.94, 58.75],[-8.94, 58.75, 2.31, 37.44],[2.31, 37.44, 8.31, 8.49],[8.31, 8.49, 14.40, -53.96],[14.40, -53.96, 20.04, -67.77],[20.04, -67.77, 28.06, -77.37],[28.06, -77.37, 41.38, -83.96],[41.38, -83.96, 57.75, -86.85],[57.75, -86.85, 95.04, -86.76],[95.04, -86.76, 112.00, -84.43]] }, /* Update 109: Thames CENTRELINE course from OSM relation 2263653 main_stream ways (clip lon -0.1997..0.0495), node-id stitched, DP 1.2u, now placed through the EXISTING shared extrasLondon landmark transform X=(lon+0.1246)*4130, Z=-26-(lat-51.5007)*6672 (cities.js extrasLondon) - river and places share one transform, replacing Update 108's erroneous independent placement (retracted: it ignored the sourced anchors). Sourced anchor check: Westminster Bridge 51.50083N 0.12194W -> (11.0, -26.9); course passes 11.6u east of the plaza centre and enters the r20 pad, so the plaza outline is notched to the near bank (PLAZA_NOTCH) instead of moving the river. Width-8 band is our stylization, NOT sourced bank/width evidence; transformed game-scale arrangement, not a real-relationship map; ODbL attribution obligation recorded, public-rollout hold unchanged (dev/HK-SOURCES.md) */
  paris: { name: 'Paris', sun: ['#fff0d8', 1.85], ground: '#a8a496', sky: '#b8d4ea', fog: '#cfdde8', bld: ['#e8dcc4', '#d9ccb0', '#f0e6d2', '#c9bc9c'], water: null, landmark: 'eiffel', tree: '#4f8f4a',
    river: [[110.83, -59.68, 99.31, -62.97],[99.31, -62.97, 31.58, -61.21],[31.58, -61.21, 21.78, -60.18],[21.78, -60.18, 5.22, -52.51],[5.22, -52.51, -11.96, -37.94],[-11.96, -37.94, -25.13, -19.23],[-25.13, -19.23, -64.77, 24.73],[-64.77, 24.73, -79.73, 44.99],[-79.73, 44.99, -108.92, 91.53]] }, /* Update 109: Seine CENTRELINE course from OSM relation 962076 main_stream ways (clip lon 2.2406..2.4102), node-id stitched, DP 1.2u, placed through the EXISTING shared extrasParis landmark transform X=(lon-2.2945)*4360, Z=-26-(lat-48.85822)*6672 (cities.js extrasParis) - river and places share one transform, replacing Update 108's erroneous independent placement (retracted). Sourced anchor check: Pont d'Iena 48.85972N 2.29222E -> (-9.9, -36.0); course passes 16.7u NNW of the plaza centre and clips the r20 pad rim, so the plaza outline is notched to the near bank (PLAZA_NOTCH). Width-8 band is our stylization, NOT sourced bank/width evidence; transformed game-scale arrangement; ODbL attribution obligation + public-rollout hold as london */
  newyork: { name: 'New York', sun: ['#f4eede', 1.9], ground: '#8f9296', sky: '#9ec6e8', fog: '#c0d2e0', bld: ['#8fa3b5', '#6f8499', '#b0bec9', '#5f7388'], water: 'west', landmark: 'liberty', tree: '#3f8a4a' },
  tokyo: { name: 'Tokyo', sun: ['#e8ecf4', 1.85], ground: '#9a9aa4', sky: '#c9d4f0', fog: '#d6dcee', bld: ['#d4d8e4', '#b4bccd', '#e4e6ee', '#9aa3b8'], water: 'east', landSurround: true, landmark: 'redtower', tree: '#e8a0b8' },
  sydney: { name: 'Sydney', sun: ['#ffedc0', 2.05], ground: '#c9bf9a', sky: '#8fd0f0', fog: '#c4e4f0', bld: ['#e8dcc0', '#d0c4a0', '#f2e8d0', '#b8a888'], water: 'east', landmark: 'sails', tree: '#4a9a50' },
  rio: { name: 'Rio de Janeiro', sun: ['#ffe4a8', 2.1], ground: '#d9c58f', sky: '#7fd0f0', fog: '#bfe4f0', bld: ['#f0c870', '#e8845a', '#7fc4b0', '#e86a8a'], water: 'south', landmark: 'statue', tree: '#2f9a4a' },
  cairo: { name: 'Cairo', sun: ['#ffd2a0', 2.1], ground: '#dcc48a', sky: '#f0d9a0', fog: '#efdcb0', bld: ['#d9bc88', '#c9a672', '#e8d0a0', '#b8956a'], water: null, landmark: 'pyramid', tree: '#6a9a3a' },
  capetown: { name: 'Cape Town', sun: ['#fff0c0', 2.0], ground: '#a4b07f', sky: '#8fcdf0', fog: '#c0e0ee', bld: ['#f0e0c8', '#e0c8a8', '#f8f0e0', '#d4b890'], water: 'north', landmark: 'tablemtn', tree: '#4a8a46' },
  singapore: { name: 'Singapore', sun: ['#fff0c8', 2.0], ground: '#8fb08a', sky: '#a8dcf0', fog: '#cce8ee', bld: ['#e4ece8', '#b8d4c8', '#f4f4f0', '#8fb8a8'], water: 'south', landmark: 'supertrees', tree: '#2f9a50' },
  istanbul: { name: 'Istanbul', sun: ['#ffe8c0', 1.95], ground: '#b09a84', sky: '#b4d4ec', fog: '#d0dce8', bld: ['#e0c4a4', '#cfa884', '#ecd8bc', '#b88c6c'], water: 'east', landmark: 'mosque', tree: '#4a8a46' },
};


/* city signature style: building height, roof detail and street props */
// Real-world primary international airport for each world city (one per city, matching the single airport node).
// Names/codes from the OurAirports scheduled-service large-airport dataset, cross-checked with Wikipedia.
export const CITY_AIRPORTS = {
  mumbai: { name: 'Chhatrapati Shivaji Maharaj Intl', code: 'BOM' },
  delhi: { name: 'Indira Gandhi Intl', code: 'DEL' },
  dubai: { name: 'Dubai Intl', code: 'DXB' },
  london: { name: 'Heathrow', code: 'LHR' },
  paris: { name: 'Charles de Gaulle', code: 'CDG' },
  newyork: { name: 'John F. Kennedy Intl', code: 'JFK' },
  tokyo: { name: 'Haneda', code: 'HND' },
  sydney: { name: 'Kingsford Smith', code: 'SYD' },
  rio: { name: 'Galeão Intl', code: 'GIG' },
  cairo: { name: 'Cairo Intl', code: 'CAI' },
  capetown: { name: 'Cape Town Intl', code: 'CPT' },
  singapore: { name: 'Changi', code: 'SIN' },
  istanbul: { name: 'Istanbul Airport', code: 'IST' },
  rome: { name: 'Fiumicino', code: 'FCO' },
  berlin: { name: 'Berlin Brandenburg', code: 'BER' },
  moscow: { name: 'Sheremetyevo', code: 'SVO' },
  beijing: { name: 'Beijing Capital Intl', code: 'PEK' },
  seoul: { name: 'Incheon Intl', code: 'ICN' },
  bangkok: { name: 'Suvarnabhumi', code: 'BKK' },
  hongkong: { name: 'Hong Kong Intl', code: 'HKG' },
  losangeles: { name: 'Los Angeles Intl', code: 'LAX' },
  mexicocity: { name: 'Benito Juárez Intl', code: 'MEX' },
  buenosaires: { name: 'Ezeiza Intl', code: 'EZE' },
  toronto: { name: 'Toronto Pearson Intl', code: 'YYZ' },
  athens: { name: 'Athens Intl', code: 'ATH' },
  bogota: { name: 'El Dorado Intl', code: 'BOG' },
  auckland: { name: 'Auckland Airport', code: 'AKL' },
  lagos: { name: 'Murtala Muhammed Intl', code: 'LOS' },
  stockholm: { name: 'Stockholm Arlanda', code: 'ARN' },
  kualalumpur: { name: 'Kuala Lumpur Intl', code: 'KUL' },
  amsterdam: { name: 'Schiphol', code: 'AMS' },
  lisbon: { name: 'Humberto Delgado Airport', code: 'LIS' },
  lima: { name: 'Jorge Chavez Intl', code: 'LIM' },
  marrakesh: { name: 'Marrakesh Menara', code: 'RAK' },
  madrid: { name: 'Adolfo Suarez Madrid-Barajas', code: 'MAD' },
  nairobi: { name: 'Jomo Kenyatta Intl', code: 'NBO' },
  jakarta: { name: 'Soekarno-Hatta Intl', code: 'CGK' },
};

export const LANDMARK_NAMES = {
  mumbai: 'Gateway of India (Mumbai)', delhi: 'India Gate (New Delhi)', dubai: 'Burj Khalifa (Dubai)', london: 'Big Ben, Elizabeth Tower (London)',
  paris: 'Eiffel Tower (Paris)', newyork: 'Statue of Liberty (New York Harbor)', tokyo: 'Tokyo Tower (Tokyo)', sydney: 'Sydney Opera House',
  rio: 'Christ the Redeemer (Rio)', cairo: 'Giza pyramids (Giza, near Cairo)', capetown: 'Table Mountain (Cape Town)', singapore: 'Supertrees, Gardens by the Bay (Singapore)', istanbul: 'Blue Mosque-inspired mosque (Istanbul)',
};
/* one-line safe flavor facts shown on the landmark arrival moment */
export const LANDMARK_FACTS = {
  mumbai: "The waterfront arch marking King George V's 1911 landing.",
  delhi: 'A war memorial arch at the heart of the capital.',
  dubai: 'The tallest building on Earth.',
  london: 'Big Ben is the name of the Great Bell inside the tower.',
  paris: "Built for the 1889 World's Fair.",
  newyork: 'A gift from France, standing in New York Harbor since 1886.',
  tokyo: 'A 333 m orange-and-white lattice tower, inspired by the Eiffel Tower.',
  sydney: 'Every roof shell is a section of the same sphere.',
  rio: 'Arms open wide over the city from Corcovado mountain.',
  cairo: 'Royal tombs standing for about 4,500 years.',
  capetown: 'A flat-topped mountain overlooking Cape Town.',
  singapore: 'Vertical gardens that light up after dark.',
  istanbul: 'Known for six minarets and a cascade of domes.',
  rome: 'The largest amphitheatre of the ancient world.',
  berlin: "Germany's tallest structure, with a sphere near the top.",
  moscow: 'Nine patterned onion domes around a tall central tent, on Red Square.',
  beijing: 'A triple-roofed hall where emperors prayed for good harvests.',
  seoul: 'A tower on Namsan mountain above the city.',
  bangkok: 'Wat Arun-inspired temple of dawn on the Chao Phraya west bank.',
  hongkong: 'The harbour between Hong Kong Island and Kowloon.',
  losangeles: 'Nine white letters on the hillside since 1923.',
  mexicocity: 'Echoes of Tenochtitlan beneath the modern city.',
  buenosaires: 'Erected in 1936 on the Plaza de la Republica.',
  toronto: 'It held the world height record for over 30 years.',
  athens: 'A temple for Athena, nearly 2,500 years old.',
  bogota: 'A white church on a green ridge, high above the city.',
  auckland: 'A needle tower with a wide lookout ring, tallest in its hemisphere when built.',
  lagos: 'A lighthouse tower that has watched the harbour entrance since the colony days.',
  stockholm: 'A brick council tower crowned with three gilded crowns above the water.',
  kualalumpur: 'A skybridge joins the twin towers 170 m up; tallest in the world from 1998 to 2004.',
  amsterdam: 'A church tower with a golden crown above the canal ring.',
  lisbon: 'A statue-topped column that looks down Lisbon\'s grand avenue toward the river.',
  lima: 'A cathedral with two towers on the main square of a colonial capital.',
  marrakesh: 'A twelfth-century minaret that towers over the old medina.',
  madrid: 'A neoclassical gate built for a king in 1778.',
  nairobi: 'A tower in the middle of the city, with a rooftop helipad.',
  jakarta: 'A tall white obelisk topped with a golden flame.',
};
const STYLE = {
  mumbai: { roof: 'flat', hmax: 16, prop: 'taxi', pc: '#e8c43a' },
  delhi: { roof: 'flat', hmax: 12, prop: 'rickshaw', pc: '#2f9a50' },
  dubai: { roof: 'glass', hmin: 12, hmax: 46, prop: 'palm' }, // palm-lined boulevards
  london: { roof: 'chimney', hmax: 12, prop: 'phonebox', pc: '#d63a2a' },
  paris: { roof: 'mansard', hmax: 11, prop: 'cafe', pc: '#d9ccb0' },
  newyork: { roof: 'water', hmin: 10, hmax: 40, prop: 'taxi', pc: '#f2c21b' },
  tokyo: { roof: 'neon', hmin: 8, hmax: 30, prop: 'vending', pc: '#e84a6a' },
  sydney: { roof: 'green', hmin: 7, hmax: 20, prop: 'cafe', pc: '#2f8f9a' }, // cafe culture
  rio: { roof: 'slant', hmax: 9, prop: 'palm', colorful: true }, // Copacabana palms
  cairo: { roof: 'flat', hmax: 9, prop: 'palm' },
  capetown: { roof: 'slant', hmax: 10, prop: 'palm' },
  singapore: { roof: 'green', hmin: 8, hmax: 34, prop: 'palm' }, // garden-city greenery
  istanbul: { roof: 'dome', hmax: 11, prop: 'cafe', pc: '#c9552f' },
};


/* city collectibles: same 5 point values as the server (flower 5, mango 10, jackfruit 15, umbrella 25, banana 100), different name, shape and colour per city */
export const CITY_ITEMS = {
  mumbai:   { flower: ['Marigold', 'flower', '#f59a23'], mango: ['Vada pav', 'disc', '#d9a05a'], jackfruit: ['Chai cup', 'cup', '#c98a4a'], umbrella: ['Kite', 'gem', '#e8452c'], banana: ['Gold coin', 'coin', '#ffd23f'] },
  delhi:    { flower: ['Marigold', 'flower', '#f59a23'], mango: ['Jalebi', 'ring', '#e8892a'], jackfruit: ['Chai cup', 'cup', '#c98a4a'], umbrella: ['Kite', 'gem', '#2f7bd9'], banana: ['Gold coin', 'coin', '#ffd23f'] },
  dubai:    { flower: ['Date palm leaf', 'long', '#4a9a3a'], mango: ['Gold ring', 'ring', '#ffd23f'], jackfruit: ['Coffee pot', 'cup', '#c9a64a'], umbrella: ['Perfume', 'gem', '#9d6bff'], banana: ['Gold bar', 'box', '#ffd23f'] },
  london:   { flower: ['Rose', 'flower', '#d63a2a'], mango: ['Scone', 'dome', '#d9a05a'], jackfruit: ['Tea cup', 'cup', '#e8e0cf'], umbrella: ['Bus ticket', 'box', '#d63a2a'], banana: ['Crown jewel', 'gem', '#e8c43a'] },
  paris:    { flower: ['Lavender', 'flower', '#9d6bff'], mango: ['Macaron', 'disc', '#ff8fb0'], jackfruit: ['Croissant', 'crescent', '#e0a050'], umbrella: ['Baguette', 'long', '#d9a05a'], banana: ['Gold key', 'coin', '#ffd23f'] },
  newyork:  { flower: ['Daisy', 'flower', '#ffffff'], mango: ['Bagel', 'ring', '#d9a05a'], jackfruit: ['Hot dog', 'long', '#c9503a'], umbrella: ['Taxi sign', 'box', '#f2c21b'], banana: ['Gold star', 'gem', '#ffd23f'] },
  tokyo:    { flower: ['Sakura', 'flower', '#ffb7d0'], mango: ['Onigiri', 'cone', '#f4f4f4'], jackfruit: ['Ramen bowl', 'cup', '#e8452c'], umbrella: ['Paper lantern', 'ball', '#e8452c'], banana: ['Gold koi', 'coin', '#ffb43a'] },
  sydney:   { flower: ['Wattle', 'flower', '#ffd23f'], mango: ['Meat pie', 'disc', '#c98a4a'], jackfruit: ['Surfboard', 'long', '#35d0ff'], umbrella: ['Beach ball', 'ball', '#e8452c'], banana: ['Opal', 'gem', '#9ad4f2'] },
  rio:      { flower: ['Orchid', 'flower', '#ff5fa2'], mango: ['Acai bowl', 'dome', '#6a2c8a'], jackfruit: ['Football', 'ball', '#f4f4f4'], umbrella: ['Carnival mask', 'box', '#ffd23f'], banana: ['Gold medal', 'coin', '#ffd23f'] },
  cairo:    { flower: ['Lotus', 'flower', '#7fd0f0'], mango: ['Date', 'long', '#6a3f2a'], jackfruit: ['Scarab', 'gem', '#2f9a8a'], umbrella: ['Ankh', 'ring', '#ffd23f'], banana: ['Gold mask', 'coin', '#ffd23f'] },
  capetown: { flower: ['Protea', 'flower', '#e86a8a'], mango: ['Rooibos cup', 'cup', '#a0522d'], jackfruit: ['Vuvuzela', 'cone', '#ffd23f'], umbrella: ['Wave', 'crescent', '#35d0ff'], banana: ['Diamond', 'gem', '#bfe4ff'] },
  singapore:{ flower: ['Orchid', 'flower', '#b06ae8'], mango: ['Dumpling', 'dome', '#f4ecd8'], jackfruit: ['Satay', 'long', '#c9503a'], umbrella: ['Lantern', 'ball', '#e8452c'], banana: ['Gold coin', 'coin', '#ffd23f'] },
  istanbul: { flower: ['Tulip', 'flower', '#e8452c'], mango: ['Baklava', 'box', '#d9a05a'], jackfruit: ['Tea glass', 'cup', '#c0302a'], umbrella: ['Lantern', 'ball', '#ffb43a'], banana: ['Evil-eye charm', 'ring', '#2f7bd9'] },
};

/* ---------- landmarks (all built from primitives) ---------- */
let londonDialMaterial = null; // reuse one tiny generated texture across city reloads
const LM = {
  gateway(g) {
    // Gateway-of-India-inspired, grounded in waterfront reference photos (Wikimedia Commons): yellow basalt
    // triumphal arch, 4 corner chhatri turrets, central dome, jali lattice panels, stepped base.
    // Honest closed stand-in: a waist-high plinth with a lattice balustrade fills the arch opening so the
    // visible arch never invites walking into the unchanged collider disc. Natural height <= 13 avoids the
    // old cap-squash (13/18); return 6.5 keeps the effective collider disc identical to the squashed 9.
    const basalt = '#c9a46a', trim = '#b98f55', dark = '#8f6a3c';
    const eB = { emissive: basalt, emissiveIntensity: .16 }, eT = { emissive: trim, emissiveIntensity: .15 };
    put(g, box(16, .7, 9, trim), 0, .35, 0);
    put(g, box(15, .35, 8, basalt, eB), 0, .85, 0);
    for (const sx of [-1, 1]) {
      put(g, box(4.05, 8.4, 6.4, basalt, eB), sx * 4.325, 5.25, 0);
      put(g, box(4.35, .45, 6.7, trim), sx * 4.325, 6.35, 0);
    }
    put(g, box(13.4, 1.8, 6.4, basalt, eB), 0, 9.65, 0);
    put(g, box(13.8, .4, 6.8, trim), 0, 10.75, 0);
    put(g, box(5.4, 1.3, 5.6, trim), 0, 1.7, 0);
    // (the old 7.6-tall rear basalt block sealed the arch void - removed so the opening reads open
    // through to the sky/waterfront like the Delhi arch, the accepted open-void pattern; the waist-high
    // plinth + lattice balustrade still keep the visible arch from inviting a walk into the unchanged disc)
    // jali TRANSOM lattice in the upper arch only, as in the reference photos (Wikimedia Commons): a thin
    // barred screen high in the opening, never a solid panel - the mid-void stays fully open to the view through
    put(g, box(4.4, .18, .18, trim, eT), 0, 8.0, -1.55); // transom frame
    put(g, box(4.4, .18, .18, trim, eT), 0, 6.9, -1.55);
    for (const sx of [-1, 1]) put(g, box(.18, 1.28, .18, trim, eT), sx * 2.11, 7.45, -1.55);
    for (const bx of [-1.4, -.7, 0, .7, 1.4]) put(g, box(.14, 1.0, .14, '#a8804a', { emissive: '#a8804a', emissiveIntensity: .12 }), bx, 7.45, -1.55); // lattice bars with open gaps
    for (const sx of [-1, 1]) {
      put(g, box(.9, .5, 6.4, trim), sx * 1.95, 7.95, 0);
      put(g, box(.55, .5, 6.4, trim), sx * 1.7, 8.45, 0);
    }
    for (const sz of [-1, 1]) {
      for (let i = -2; i <= 2; i++) put(g, box(.5, .8, .16, dark), i * 1.05, 2.85, sz * 2.85);
      put(g, box(5.4, .3, .26, trim), 0, 3.4, sz * 2.85);
      for (const sx of [-1, 1]) {
        put(g, box(.3, 6.5, .3, trim), sx * 2.3, 5.3, sz * 3.05);
        for (let r2 = 0; r2 < 2; r2++) put(g, box(1.0, 1.3, .14, dark), sx * 4.325, 5.3 + r2 * 2.1, sz * 3.28);
      }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      put(g, cyl(.5, .65, 1.0, 8, basalt, eB), sx * 5.9, 11.95, sz * 2.6);
      put(g, sph(.8, trim, eT), sx * 5.9, 12.45, sz * 2.6).scale.y = .62;
    }
    put(g, cyl(1.7, 2.0, .4, 10, basalt, eB), 0, 11.15, 0);
    put(g, sph(1.35, trim, eT), 0, 11.55, 0).scale.y = .6;
    return 6.5;
  },
  indiagate(g) {
    // India-Gate-inspired, grounded in Rajpath reference photos (Wikimedia Commons): warm sandstone triumphal
    // arch, tapered pylons, cornice band, small domed chhatri canopy on top. Honest closed stand-in: a
    // waist-high plinth with a flame pedestal fills the arch opening so the visible arch never invites walking
    // into the unchanged collider disc. Natural height <= 13 avoids the old cap-squash (13/19.9); return
    // 6.53266 keeps the effective collider disc identical to the squashed 10.
    const stone = '#d68c5a', light = '#e8a06a', dark = '#a8643c';
    const eS = { emissive: stone, emissiveIntensity: .18 }, eL = { emissive: light, emissiveIntensity: .15 };
    put(g, box(15, .6, 7.5, light, eL), 0, .3, 0);
    put(g, box(14, .3, 6.8, stone, eS), 0, .75, 0);
    for (const sx of [-1, 1]) {
      put(g, box(4.4, 3.2, 6.2, stone, eS), sx * 5.0, 2.5, 0);
      put(g, box(4.0, 3.2, 5.8, stone, eS), sx * 5.0, 5.7, 0);
      put(g, box(3.6, 2.6, 5.4, stone, eS), sx * 5.0, 8.6, 0);
      put(g, box(3.8, .35, 5.6, light, eL), sx * 5.0, 7.3, 0);
      for (const sz of [-1, 1]) {
        put(g, box(1.7, 2.1, .14, dark), sx * 5.0, 5.6, sz * 2.98);
        put(g, box(2.1, .3, .14, dark), sx * 5.0, 9.0, sz * 2.78);
      }
    }
    put(g, box(13.6, 1.5, 5.8, stone, eS), 0, 10.65, 0);
    put(g, box(14.1, .35, 6.2, light, eL), 0, 11.575, 0);
    put(g, box(6.2, .5, 5.6, light, eL), 0, 9.7, 0);
    put(g, box(5.6, 1.3, 5.2, stone, eS), 0, 1.55, 0);
    put(g, box(1.3, 1.0, 1.3, dark), 0, 2.7, 0);
    put(g, cone(.5, .9, 6, '#ffb43a', { emissive: '#ff9a2a', emissiveIntensity: .8 }), 0, 3.65, 0);
    // Corbel-stepped arch frames at the front and back faces: the opening keeps real depth and parallax
    // (nothing seals the void; the city stays visible through it), while the stepped profile + dark soffit
    // and reveal frames make the arch read from the player's approach against the same-hue city backdrop.
    // Row ends embed .1 into the stepped pylon faces, each upper row rests on the row below, the top row
    // embeds .05 into the architrave; all inside the existing silhouette. Disc/height unchanged.
    for (const sz of [-1, 1]) {
      put(g, box(6.6, .5, .7, stone, eS), 0, 7.95, sz * 2.75);
      put(g, box(5.4, .5, .7, stone, eS), 0, 8.45, sz * 2.75);
      put(g, box(4.2, .5, .7, stone, eS), 0, 8.95, sz * 2.75);
      put(g, box(3.0, .3, .7, light, eL), 0, 9.35, sz * 2.75);
      put(g, box(.14, 7.35, .5, dark), 2.79, 5.825, sz * 2.8);
      put(g, box(.14, 7.35, .5, dark), -2.79, 5.825, sz * 2.8);
    }
    put(g, box(6.6, .12, 4.9, dark), 0, 9.43, 0); // soffit lining the opening ceiling; edges embed into tier faces and frames
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, cyl(.16, .16, .75, 6, stone, eS), sx * 1.7, 12.125, sz * 1.7);
    put(g, sph(.75, light, eL), 0, 12.5, 0).scale.y = .55;
    return 6.53266;
  },
  spire(g) { // Burj-Khalifa-inspired, grounded in the architect's project page (SOM - som.com/projects/burj-khalifa, '828 meters', 'Y-shaped floor plan', 'buttressed core', 'setbacks occur in an upward spiraling pattern, which reduces the building's mass as it reaches skyward').
    // Stylized silhouette grammar, not surveyed: Y tripod wing slabs at the base, a very slender telescoping shaft of hex tiers stepping down in width as they rise, each tier twisted a touch further for the spiraling-setback read, central needle. Dubai's landmark cap is raised to 20 (NY already 14) because the Burj's identity IS its slenderness - at the generic 13 cap the shaft squashes into a ziggurat. return 7 keeps the effective collider disc identical to the old stacked cylinders, so no nearby spot changes reachability.
    const glass = '#dfe9ee', glass2 = '#c2d8e4', opt = { metalness: .3, roughness: .4, emissive: '#9ab8c8', emissiveIntensity: .15 };
    for (const a of [0, 2.094, 4.189]) { const wng = put(g, box(5.6, .7, 1.4, glass2, opt), Math.cos(a) * 2.5, .35, Math.sin(a) * 2.5); wng.rotation.y = -a; } // Y-shaped plan wings at ground
    const tiers = [[2.2, 1.9], [1.9, 1.9], [1.65, 1.9], [1.4, 1.9], [1.2, 1.9], [1.0, 1.9], [.82, 1.9], [.66, 1.9], [.52, 1.9]]; // spiraling setbacks: mass reduces skyward
    let y = .7;
    for (let i = 0; i < tiers.length; i++) { const [w, h] = tiers[i];
      const t = put(g, cyl(w * .86, w, h, 6, i % 2 ? glass2 : glass, opt), 0, y + h / 2, 0);
      t.rotation.y = i * .18; // stepped twist: the upward spiraling setback pattern
      if (i < 2) for (const a of [0, 2.094, 4.189]) { const lob = put(g, box(w * 1.2, h, w * .4, glass2, opt), Math.cos(a) * w * .7, y + h / 2, Math.sin(a) * w * .7); lob.rotation.y = -a + i * .18; } // wing lobes on the lowest tiers only
      y += h; }
    put(g, cyl(.08, .26, 2.0, 5, '#f0f4f6', opt), 0, y + 1.0, 0); // needle
    return 7; },
  clock(g) {
    // Elizabeth-Tower-inspired clock tower, rebuilt against Parliament's facts (Update 57): 96 m tall, square
    // base 12.2 m, dial centres 54.9 m up, dials 6.9 m across, belfry and corner pinnacles above, spire with the
    // Ayrton Light. H=40 keeps the sourced proportions: slim 5.1-unit shaft, dial centres at 22.9, dials 2.9
    // across. London cap .5 shows it at 20; disc 5.5 still covers the palace annex.
    put(g, box(6.2, 2.2, 6.2, '#c9a56a'), 0, 1.1, 0); // base plinth, slightly wider like the real footing
    put(g, box(5.2, 19.6, 5.2, '#c9a56a'), 0, 12, 0); // slim shaft: the real base is 12.2 m square ~ 5.1 units
    for (const y of [7, 14, 20.9]) put(g, box(5.5, .35, 5.5, '#b88b4a'), 0, y, 0); // stone string courses
    put(g, box(5.8, 4.6, 5.8, '#c9a56a'), 0, 23.2, 0); // projecting clock stage around the dials
    put(g, box(6.0, 4.4, 6.0, '#bfa06b'), 0, 27.6, 0); // belfry stage above the dials
    for (const [px, pz] of [[2.7, 2.7], [-2.7, 2.7], [-2.7, -2.7], [2.7, -2.7]]) put(g, cone(.55, 3, 4, '#b88b4a'), px, 31.4, pz).rotation.y = .78; // Pugin's corner pinnacles
    for (let f = 0; f < 4; f++) { const a = f * Math.PI / 2, sx = Math.sin(a), cz = Math.cos(a); for (const off of [-1.1, 1.1]) { const m = box(.6, 3, .2, '#3d3428'); m.position.set(sx * 3.01 + cz * off, 27.6, cz * 3.01 - sx * off); m.rotation.y = a; g.add(m); } } // paired belfry openings
    put(g, cone(3.4, 10.2, 4, '#4a5a68'), 0, 34.9, 0).rotation.y = .78; // the cast-iron tiled spire
    put(g, box(.9, 1.2, .9, '#ffe9a8'), 0, 30.4, 3.3); // the Ayrton Light above the belfry, lit when Parliament sits
    // Four outward opal-style dials, based on Parliament's Great Clock description.
    // Original generated drawing, fixed decorative hands, not a real-time clock.
    if (!londonDialMaterial) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const c = cv.getContext('2d'); c.fillStyle = '#fff6dc'; c.fillRect(0, 0, 256, 256);
    c.translate(128, 128); c.strokeStyle = '#283b48'; c.lineWidth = 9;
    c.beginPath(); c.arc(0, 0, 117, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 92, 0, Math.PI * 2); c.stroke();
    for (let n = 0; n < 60; n++) { c.save(); c.rotate(n * Math.PI / 30); c.lineWidth = n % 5 ? 2 : 5; c.beginPath(); c.moveTo(0, -108); c.lineTo(0, n % 5 ? -102 : -94); c.stroke(); c.restore(); }
    c.fillStyle = '#283b48'; c.font = 'bold 19px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const roman = ['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
    roman.forEach((t,n) => { const a=n*Math.PI/6;c.fillText(t,Math.sin(a)*77,-Math.cos(a)*77); });
    c.lineCap = 'round'; for (const [a,len,w] of [[Math.PI/3,66,7],[-Math.PI/3,47,10]]) { c.save(); c.rotate(a); c.lineWidth=w;c.beginPath();c.moveTo(0,9);c.lineTo(0,-len);c.stroke();c.restore(); }
    c.beginPath();c.arc(0,0,8,0,Math.PI*2);c.fill();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    londonDialMaterial = new THREE.MeshBasicMaterial({map:tex});
    }
    const dialMat = londonDialMaterial;
    for (let k = 0; k < 4; k++) { const a=k*Math.PI/2, face=new THREE.Mesh(new THREE.CircleGeometry(1.45,32),dialMat); // 6.9 m across ~ 2.9 units
      face.position.set(Math.sin(a)*2.92,22.9,Math.cos(a)*2.92); face.rotation.y=a; face.name='london-clock-face'; g.add(face); // dial centres 54.9 m up ~ 22.9 units
    }
    put(g, box(8, 10, 16, '#d4b27a'), 0, 5, 10); /* Update 109: palace wing now runs SOUTH from the tower along the west bank, the real Palace of Westminster arrangement (Elizabeth Tower at its north end); the east-reaching wing's footing stood in the Update-109 river band (band edge 7.6u east of the plaza centre, wing east end at 10) - rotating the wing keeps the sourced course AND a dry footing, no river nudge */
    return 11;
  },
  // Eiffel-inspired lattice. Proportions from Wikipedia (Eiffel_Tower): 330 m tall, 125 m square base, top platform 276 m.
  // Scale here: 40 units = 330 m (1 unit ~ 8.25 m) so base half-width = 62.5 m ~ 7.6 u. Leg curve is a stylised power curve, not surveyed.
  eiffel(g) {
    /* Eiffel-tower-inspired lattice, rebuilt against the official key figures (Update 56): 330 m total, 312 m
       without the antenna; four pillars on a 125 m square; floors at 57/115/276 m; pillars 25 m wide at the
       ground; Sauvestre's decorative arches between the pillars below the first floor. H=40 keeps the sourced
       proportions: floor decks at 6.9/13.9/33.5 and the 7.6 base half-width match 57/115/276 m and 125 m. */
    const H = 40, col = '#5b4b3d', col2 = '#4a3c30', colD = '#6a5a4a', Y = new THREE.Vector3(0, 1, 0);
    const beam = (a, b, t, c) => { const d = new THREE.Vector3().subVectors(b, a), len = d.length(); const m = box(t, 1, t, c || col); m.scale.y = len; m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(Y, d.normalize()); m.castShadow = true; g.add(m); };
    const hw = y => y >= 33.5 ? .55 : 0.9 + 6.7 * Math.pow(1 - y / 33.5, 2.6); // half-width of the frame at height y
    const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    const P = (cx, cz, y) => new THREE.Vector3(cx * hw(y), y, cz * hw(y));
    const levels = [0, 1.4, 2.8, 4.2, 5.6, 6.9, 8.2, 9.5, 11, 12.5, 13.9, 17, 20.5, 24.5, 28.5, 31, 33.5]; // finer steps smooth the parabolic leg curve
    for (let k = 0; k < levels.length - 1; k++) {
      const y0 = levels[k], y1 = levels[k + 1];
      const thick = y0 < 7 ? .85 : y0 < 14 ? .5 : .3; // the pillars are 25 m wide at the ground
      for (const [cx, cz] of corners) beam(P(cx, cz, y0), P(cx, cz, y1), thick);
      if (y0 >= 6.9) for (let c = 0; c < 4; c++) { // X-bracing on each of the four faces, above the first floor only: below it the pillars stand open like the real tower, so the arches frame open voids
        const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
        beam(P(ax, az, y0), P(bx, bz, y1), .13, col2); beam(P(bx, bz, y0), P(ax, az, y1), .13, col2);
        beam(P(ax, az, y1), P(bx, bz, y1), .16, col2);
      }
    }
    for (let f = 0; f < 4; f++) { // the retained arches: a semicircle between the pillars of each face, ground to first floor
      const rot = f * Math.PI / 2, R = 6.9;
      for (let q = 0; q < 7; q++) {
        const a0 = Math.PI * (q + .02) / 7, a1 = Math.PI * (q + .98) / 7;
        const A = new THREE.Vector3(Math.cos(a0) * R, Math.sin(a0) * R, -hw(Math.sin(a0) * R)), B = new THREE.Vector3(Math.cos(a1) * R, Math.sin(a1) * R, -hw(Math.sin(a1) * R));
        A.applyAxisAngle(Y, rot); B.applyAxisAngle(Y, rot); beam(A, B, .3, colD);
      }
    }
    for (const y of [6.9, 13.9, 33.5]) put(g, box(2 * hw(y) + 1.2, .6, 2 * hw(y) + 1.2, colD), 0, y, 0); // the three floor decks
    put(g, box(2.4, 1.1, 2.4, col), 0, 16.6, 0); // the second floor's housing
    put(g, box(1.5, 1.6, 1.5, col), 0, 34.3, 0); // the top floor's housing
    beam(new THREE.Vector3(0, 35.1, 0), new THREE.Vector3(0, 37.8, 0), .3, col2); // summit mast
    beam(new THREE.Vector3(0, 37.8, 0), new THREE.Vector3(0, H, 0), .13, col2); // the antenna: 18 of the 330 m
    return 8;
  },  liberty(g) {
    // Statue-of-Liberty-inspired, grounded in Liberty-Island reference photos (Wikimedia Commons): star-fort
    // stone pedestal, patina-green robed figure with draped folds, seven-ray crown, raised torch with a warm
    // flame, tablet in the lowered left arm. Natural height 13.75 avoids the old cap-squash (14/31.5 ~ .444,
    // rendered under half-height); return 4 keeps the effective collider disc identical to the squashed 9.
    const stone = '#a8a8a0', stone2 = '#b4b4ac', patina = '#6fb8a0', patinaD = '#5da68f';
    const eS = { emissive: stone, emissiveIntensity: .15 }, eP = { emissive: patina, emissiveIntensity: .18 }, eD = { emissive: patinaD, emissiveIntensity: .15 };
    put(g, cyl(3.95, 4.0, .9, 12, stone, eS), 0, .45, 0); // fort base: dodecagon inscribed in the r=4 collider disc - the walk-up edge meets visible stone from EVERY approach angle, corners included (a square base would clip diagonally: corner 5.66 > disc 4)
    put(g, box(5.6, 2.1, 5.6, stone2, eS), 0, 1.95, 0); // lower pedestal
    put(g, box(4.4, 1.7, 4.4, stone, eS), 0, 3.85, 0); // upper pedestal
    put(g, box(4.7, .35, 4.7, stone2, eS), 0, 4.85, 0); // pedestal cap lip
    put(g, cyl(1.05, 1.75, 4.0, 8, patina, eP), 0, 7.0, 0); // robed body, tapering up
    for (let k = 0; k < 4; k++) put(g, box(.16, 3.4, .3, patinaD, eD), Math.sin(k * 1.57 + .4) * 1.15, 6.7, Math.cos(k * 1.57 + .4) * 1.15).rotation.y = k * 1.57 + .4; // drape folds
    put(g, cyl(.8, 1.05, 1.3, 8, patina, eP), 0, 9.6, 0); // shoulders
    put(g, sph(.6, patina, eP), 0, 10.75, 0); // head
    for (let k = 0; k < 7; k++) { const a = k * .8976; put(g, cone(.09, .85, 4, patina, eP), Math.sin(a) * .62, 11.25, Math.cos(a) * .62).rotation.set(Math.cos(a) * .9, 0, -Math.sin(a) * .9); } // seven-ray crown
    put(g, cyl(.15, .15, 2.3, 5, patina, eP), 1.05, 11.15, 0).rotation.z = -.75; // raised right arm
    put(g, cyl(.1, .2, .5, 5, '#c9a64a', { emissive: '#c9a64a', emissiveIntensity: .3 }), 1.92, 12.35, 0); // torch cup
    put(g, sph(.3, '#ffd23f', { emissive: '#ffd23f', emissiveIntensity: .85 }), 1.92, 12.75, 0); // flame
    put(g, cyl(.14, .14, 1.5, 5, patina, eP), -1.0, 9.9, 0).rotation.z = .55; // lowered left arm
    put(g, box(.75, .95, .14, patinaD, eD), -1.55, 10.55, .1).rotation.z = .12; // tablet
    return 4;
  },
  redtower(g) { // Tokyo-Tower-inspired OPEN lattice, stylized silhouette not surveyed, sourced key figures (https://en.wikipedia.org/wiki/Tokyo_Tower): lattice tower inspired by the Eiffel Tower, painted white and international orange for air safety, architectural height 333 m, Main Deck 150 m (0.45H), Top Deck 249.6 m (0.75H). Four splayed legs with open gaps and X-braced faces (the eiffel(g) beam idiom) - a 10-29 first pass used solid 4-sided frusta and was rejected on pixels as not lattice. Natural H ~19.5 at scale 1 under the raised tokyo:20 cap (dubai/toronto/berlin/seoul precedent: the tower's identity IS its height; the 10-28 build deliberately stayed at 12.8 to preserve the old squashed disc). Deck placements keep the sourced 0.45/0.75 height ratios; banding is alternating orange/white without a claimed band count.
    const ORG = '#e8502c', WHT = '#f4f4f4', Y = new THREE.Vector3(0, 1, 0);
    const beam = (a, b, t, c) => { const d = new THREE.Vector3().subVectors(b, a), len = d.length(); const m = box(t, 1, t, c); m.scale.y = len; m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(Y, d.normalize()); m.castShadow = true; g.add(m); };
    const hw = y => y <= 8.8 ? 1.0 + 1.4 * Math.pow(1 - y / 8.8, 1.6) : Math.max(.55, 1.0 - (y - 8.8) * .07); // frame half-width: legs splay to the waist at the Main Deck, slimmer shaft above
    const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    const P = (cx, cz, y) => new THREE.Vector3(cx * hw(y), y, cz * hw(y));
    const band = y => (y >= 4.8 && y < 6.4) || (y >= 11.8 && y < 13.3) ? WHT : ORG; // alternating air-safety bands, count not claimed
    const levels = [0, 1.6, 3.2, 4.8, 6.4, 8.0, 8.8, 10.3, 11.8, 13.3, 14.9];
    for (let k = 0; k < levels.length - 1; k++) {
      const y0 = levels[k], y1 = levels[k + 1], thick = y0 < 8.8 ? .42 : .24;
      for (const [cx, cz] of corners) beam(P(cx, cz, y0), P(cx, cz, y1), thick, band(y0)); // the four open legs
      for (let c = 0; c < 4; c++) { // X-bracing + top rail on each of the four faces
        const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
        beam(P(ax, az, y0), P(bx, bz, y1), .1, band(y0)); beam(P(bx, bz, y0), P(ax, az, y1), .1, band(y0));
        beam(P(ax, az, y1), P(bx, bz, y1), .12, band(y0));
      }
    }
    put(g, box(3.3, .8, 3.3, WHT), 0, 8.8, 0); // Main Deck at 0.45H (150 m of 333 m), wider than the waist like the real deck
    put(g, box(1.7, .6, 1.7, WHT), 0, 14.9, 0); // Top Deck at 0.75H (249.6 m)
    put(g, cyl(.07, .28, 3.6, 5, ORG), 0, 16.9, 0); // antenna spire
    put(g, sph(.13, '#ff5a5a', { emissive: '#ff5a5a', emissiveIntensity: .8 }), 0, 19.4, 0); // aviation light
    return 3.6; }, // lr 2.275->3.6 covers the splayed-leg footprint (base half-width 2.4/axis -> corner 3.39 + member margin) at any scale; old value was a cap-squash artifact. Nearest seeded spot 16.61 from the anchor, far outside disc+1.5.
  // Sydney-Opera-House-inspired: terraced podium + two clusters of ascending shell sails.
  // Each shell is a solid pointed lancet profile thinly extruded (convex faces, closed from every angle) - the silhouette grammar from the reference photos, not a replica.
  // Kept naturally <=13 tall so the height cap does not rescale it; return 9.2 keeps the effective collider disc identical to the old squashed 12 (9.18), so no nearby spot changes reachability.
  sails(g) {
    /* Sydney-Opera-House-inspired shells, grounded in the official figures (Update 58): 65 m high, 183 m x
       120 m on a monumental podium, and Utzon's spherical solution (all real shells derive from one 75.2 m
       sphere) used here as the apex-proportion source: at 6.5 m/unit that sphere is R=11.6, so each shell's
       apex back-sweep is h*h/(2R). The shell surfaces themselves are a custom lancet extrusion, NOT spherical
       sections - spherical inspiration and proportion, not a reconstruction. Collider disc unchanged
       (return 9.1); the shells stay visual, not walkable. */
    put(g, box(26, 1.2, 14, '#b39a7d'), 0, .6, 0);
    put(g, box(22, 1.2, 11, '#c0a888'), 0, 1.8, 0);
    const sailGeo = (w, h, t, curl) => { // solid sail: pointed lancet profile, thin extrusion, apex pulled back by curl*(y/h)^2 - a curved shell edge-on, not an upright slab; closed from every angle (thin open wedges read as separated fins)
      const sh = new THREE.Shape();
      sh.moveTo(-w / 2, 0);
      sh.quadraticCurveTo(-w * .30, h * .62, 0, h);
      sh.quadraticCurveTo(w * .30, h * .62, w / 2, 0);
      sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: t * .4, bevelSize: w * .03, bevelSegments: 2, curveSegments: 12 });
      geo.translate(0, 0, -t / 2);
      const pos = geo.attributes.position; // back-sweep: apex curls away like the real shells; a straight extrusion reads as a flat slab edge-on
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setZ(i, pos.getZ(i) - curl * (y / h) * (y / h)); }
      geo.computeVertexNormals();
      return geo;
    };
    const sailMat = M('#f6f1e6', { roughness: .5, emissive: '#ffffff', emissiveIntensity: .32 }); // lifted self-light so the shadow side stays near-white, but low enough that face-angle shading still separates the sails
    const shell = (x, z, w, h, t, lean, ry, curl) => {
      const m = new THREE.Mesh(sailGeo(w, h, t, curl), sailMat);
      m.castShadow = m.receiveShadow = true;
      m.position.set(x, 2.15, z); m.rotation.order = 'YXZ'; m.rotation.y = ry; m.rotation.x = lean;
      g.add(m);
    };
    // main cluster: three solid sails fanned around one shared buried base - tall center-back, shorter flankers swung open, bases interpenetrating into one scalloped mass with splayed apexes (botanic-gardens reference grammar)
    shell(-4.2, -.9, 9.0, 2.3, 1.6, .02, .05, .23); shell(-5.8, -3.2, 6.4, 10.0, .7, .13, 0, 4.31); shell(-4.2, -.4, 5.4, 7.9, .65, .10, .28, 2.69); shell(-2.8, 2.2, 4.4, 6.1, .55, .07, .55, 1.60); // lateral fan over one low scalloped base shell: apexes splay, swung open at rising angles so the shells separate from every side - no blob merge, no sky fins
    shell(5.1, -.7, 5.6, 1.9, 1.3, .02, .1, .16); shell(4.2, -2.2, 4.4, 7.2, .6, .12, .1, 2.23); shell(6.0, .6, 3.7, 5.4, .5, .08, .5, 1.26); // small cluster: same fan grammar, lower rise
    return 9.1;
  },
  statue(g) {
    /* Christ-the-Redeemer-inspired, grounded in the published figures (Update 61): statue 30 m on an 8 m
       pedestal, arms 28 m fingertip to fingertip (~0.93x the statue height) and angled gently upward, head
       3.75 m (the figure is ~12 heads tall), hands 3.2 m, pale soapstone cladding; 700 m Corcovado below.
       Rio cap 20 - the figure-over-mountain composition reads at size. Collider disc unchanged (return 11). */
    put(g, cyl(3.4, 11, 8.4, 9, '#5f8a4a'), 0, 4.2, 0); // Corcovado
    put(g, box(4.2, 3.6, 4.2, '#4a4038'), 0, 10.2, 0); // the 8 m pedestal (~27% of the statue height)
    put(g, cyl(1.5, 2.2, 10.5, 8, '#dcdcd2'), 0, 17.2, 0); // the robed figure, columnar and widening to the base
    for (const y of [13.6, 16.4, 19.4]) put(g, cyl(1.72, 1.92, .35, 8, '#cfcfc2'), 0, y, 0); // the robe's transverse folds
    const armSide = (sgn) => { const a = new THREE.Group(); a.position.set(0, 23.0, 0); a.rotation.z = sgn * .22; g.add(a); // arms angled gently upward (~13 deg); total span ~0.93x the figure height
      put(a, box(6.9, 1.2, 1.5, '#dcdcd2'), sgn * 3.4, 0, 0); // the arm, one rigid transform with the hand
      put(a, box(.5, 1.4, 1.3, '#dcdcd2'), sgn * 6.8, -.35, 0); }; // the 3.2 m hand joined at the tip, palm down like the real statue
    armSide(-1); armSide(1);
    put(g, box(2.4, 3.4, 1.5, '#dcdcd2'), 0, 22.0, 0); // shoulders into the arms
    put(g, cyl(.55, .75, 1.5, 8, '#dcdcd2'), 0, 24.1, 0); // the neck - spans the shoulder top (23.7) into the head, closing the .45 sky gap
    put(g, sph(.95, '#dcdcd2'), 0, 25.3, 0); // the 3.75 m head, base embedded .5 into the neck
    return 11; // mountain cone base radius - the disc must cover the slope, not just the pedestal
  },
  pyramid(g) { // Giza-inspired, grounded in the 'All Gizah Pyramids' reference (Wikimedia Commons): three smooth-faced 4-sided pyramids of descending size on a sand plateau, the second carrying a pale casing-stone cap at its apex, small stepped satellite pyramids in front. Natural height <=13 avoids the old h18 cap-squash (.722, stubby); return 10.111... keeps the effective collider disc identical to the squashed 14.
    const stone = '#d9b872', stone2 = '#cfa862', stone3 = '#d4b068', sand = '#dcc48e', casing = '#efe3c0', eSt = { emissive: '#d9b872', emissiveIntensity: .2 }, eSt2 = { emissive: '#cfa862', emissiveIntensity: .2 }, eSt3 = { emissive: '#d4b068', emissiveIntensity: .2 }; // spawn-facing sides sit in shadow; a gentle self-light keeps the faces readable
    put(g, box(40, .6, 24, sand), 0, .3, -1); // plateau slab grounding the group
    put(g, cone(11, 11.9, 4, stone, eSt), 0, 6.55, 0).rotation.y = .78; // Khufu-style main pyramid, apex 12.5
    put(g, cone(7.5, 9.5, 4, stone2, eSt2), 12.5, 5.35, -5.5).rotation.y = .78; // Khafre-style second
    put(g, cone(1.45, 2, 4, casing, { emissive: '#efe3c0', emissiveIntensity: .12 }), 12.5, 9.3, -5.5).rotation.y = .78; // pale casing-stone cap: faces sit ~0.02 proud of the pyramid faces and its apex (10.3) clears the pyramid tip (10.1) - no coplanar contact band, no z-speckle, no visible brim
    put(g, cone(5, 7, 4, stone3, eSt3), -11.5, 4.1, -2).rotation.y = .78; // Menkaure-style third
    for (const [sx, sz] of [[-8, 5], [-4, 5.5], [-11.5, 6]]) { // stepped satellite pyramids / mastabas in front
      put(g, box(2.8, .45, 2.8, stone3), sx, .825, sz);
      put(g, box(2, .45, 2, stone2), sx, 1.275, sz);
      put(g, box(1.2, .45, 1.2, stone), sx, 1.725, sz);
    }
    return 10.11111111111111; },
  tablemtn(g) { // Table Mountain-inspired massif, fourth build (v1 facade, v2 outward wings, v3 box-on-pyramid all held). Grounded in the city-bowl reference silhouette (Wikimedia Commons: 'Cape Town City Bowl and Table Mountain at dawn'): the mountain is stacked 4-sided FRUSTUMS, so the rock body tapers continuously from a broad base to the plateau and the flat table is the frustum's own top face - the same sandstone as the cliff below it. No roof slab, no vertical wall block, no colour break at the top: the plateau edge is where the slope stops, exactly like the reference. Lion's Head rounded shoulder + Kloof Nek saddle + Signal Hill left, Devil's Peak point right.
    const rock = '#c2ab84', rockD = '#a08a66', slope = '#7a7a52';
    const eR = { emissive: rock, emissiveIntensity: .45 }, eD = { emissive: rockD, emissiveIntensity: .45 }, eS = { emissive: slope, emissiveIntensity: .35 }; // the spawn-facing side sits in shadow; a gentle self-light keeps the sandstone readable
    put(g, cyl(10, 14.5, 4, 4, slope, eS), 0, 2, -25).rotation.y = Math.PI / 4; // talus foot: broad base flaring to the plaza edge, grounded - no floating sections from any angle
    put(g, cyl(8.2, 11, 4, 4, slope, eS), 0, 5.5, -25).rotation.y = Math.PI / 4; // mid slopes continuing inward
    put(g, cyl(8, 8.6, 2.8, 4, rock, eR), 0, 8.6, -25).rotation.y = Math.PI / 4; // upper cliff with a gentle 12-degree taper (not vertical walls); its own flat top face at 10.0 IS the table - continuous rock, no cap, plateau about 55% of the base width as in the reference
    put(g, box(2.2, .7, 2.2, rockD, eD), -2.2, 10.3, -25); // Maclear's Beacon-inspired rock cairn at the off-centre high point
    put(g, cone(4.2, 7, 7, rock, eR), -15.5, 3.5, -22); // Lion's Head-inspired rounded shoulder, clearly lower than the table
    put(g, sph(1.2, rockD, eD), -15.5, 7.2, -22); // its knob
    put(g, cone(3, 2.5, 6, slope, eS), -11.5, 1.25, -21); // Kloof-Nek-inspired saddle between the table and Lion's Head
    put(g, cone(2.6, 2, 5, slope, eS), -19.5, 1, -20); // Signal Hill-inspired low bump further left
    put(g, cone(5, 8.5, 6, rockD, eD), 15.5, 4.25, -25); // Devil's Peak-inspired pointed summit right, below the plateau
    return 5.673514470887352; }, // exact live effective disc, derived from the real renderer (Chrome/V8 + the game's THREE, probed on the live v145 build): Box3 min.y -2.9480921982415227, max.y 10.799999994039535, hgt 13.748092192281057, k = 13/hgt = 0.9455857451478921, live lr = 6 * k = 5.673514470887352. (A vendored-THREE stub rebuild lands 1 ulp higher on hgt (...058) and hence ...351 - a stub artifact; the served runtime is the ...352 value probed here.) This rebuild's own bounding height is 10.65 (cairn top) <= 13, so no cap-squash applies and the literal return preserves the live disc float-exactly; collider semantics unchanged from the original landmark (walk-through geometry is pre-existing baseline; solid colliders would block existing pickup spots = economy decision, not taken)
  // Supertree-Grove-inspired: slender tapered trunks carrying wide flared funnel canopies (rusty rim + green crown), two joined by a skyway.
  // Kept naturally <=13 tall so the height cap does not rescale it; return 4.9 keeps the effective collider disc identical to the old squashed 11 (4.93).
  supertrees(g) {
    /* Supertree-Grove-inspired, grounded in the Gardens' official figures (Update 59): Supertrees of 25-50 m, each
       a concrete core + trunk + planting-panel living skin (162,900 plants) + canopy; the OCBC Skyway links two
       42 m trees at 22 m; an observatory deck tops the tallest 50 m tree; some canopies carry photovoltaic
       panels. Scale: tallest 9.6 units ~ 50 m, so the skyway sits at 4.2 (~22 m). Collider disc unchanged. */
    const trees = [[-7, 7.6], [0, 9.6], [7, 6.8], [-12.5, 5.6], [12.5, 6]];
    for (const [x, h] of trees) { put(g, cyl(.45, 1, h, 7, '#5a4a40'), x, h / 2, 0);
      put(g, cyl(.5, .95, h * .94, 7, '#4a7a3f', { emissive: '#3f6a34', emissiveIntensity: .15 }), x, h * .48, 0); // the planting-panel living skin over the trunk
      put(g, cone(4.2, 3, 10, '#7a4a3a', { emissive: '#7a4a3a', emissiveIntensity: .18 }), x, h + 1.1, 0).scale.y = -1;
      put(g, cyl(3.1, 3.1, .5, 10, '#3f8a4a', { emissive: '#3f8a4a', emissiveIntensity: .3 }), x, h + 2.4, 0); }
    put(g, cyl(2.2, 2.2, .18, 12, '#2a3a4a', { emissive: '#2a3a4a', emissiveIntensity: .25 }), -12.5, 8.42, 0); // photovoltaic-panel canopy (the solar trees), on top of the planting disc
    put(g, cyl(2.2, 2.2, .18, 12, '#2a3a4a', { emissive: '#2a3a4a', emissiveIntensity: .25 }), 12.5, 8.82, 0); // photovoltaic-panel canopy
    put(g, box(7.6, .5, 1.2, '#bcbcb4'), -3.5, 4.2, 0); // the OCBC Skyway, 22 m up ~ 4.2 units, linking the two tall trees
    put(g, cyl(1.7, 1.7, .12, 12, '#bcbcb4'), 0, 12.38, 0); // the observatory deck on the tallest tree, above the canopy disc
    put(g, cyl(1.5, 1.5, .4, 12, '#8a8a84'), 0, 12.6, 0);
    return 4.9; },
  mosque(g) {
    // Blue-Mosque-inspired, stylized silhouette not surveyed, sourced key figures (https://en.wikipedia.org/wiki/Blue_Mosque,_Istanbul): classical Ottoman layout - central dome (23.5 m dia, 43 m outer height) surrounded by four semi-domes, four smaller corner domes, fronted by a large courtyard, flanked by six minarets (64 m; minaret-to-dome ratio ~1.49). Natural H ~15.7 at scale 1 under the raised istanbul:20 cap (rio/buenosaires precedent; the 10-28 build stayed at 12.95 to preserve the old squashed disc). Composition kept: main dome, 4 cardinal semi-domes, 4 corner domes on weight towers, low courtyard front, 4 corner minarets + 2 shorter front minarets; the twelve exedrae are skipped (stylized simplification, noted not claimed). Minaret/dome ratio ~1.58 vs real 1.49.
    const CRM = '#e6dccb', DM = '#9aa3ab', DML = '#a6aeb5', GLD = '#c9a64a';
    put(g, box(15, 3.2, 15, CRM), 0, 1.6, 0); // prayer-hall body (real 64 x 72 m footprint class)
    put(g, box(12, 1.8, 12, '#ddd2bc'), 0, 4.1, 0); // upper mass the domes rise from
    put(g, box(12, 1.4, 2, CRM), 0, .7, 8.4); // low courtyard front (the real courtyard precedes the prayer hall)
    put(g, cyl(4.7, 4.7, 1.0, 14, '#ddd2bc'), 0, 5.5, 0); // drum under the main dome; drum top = dome equator so no lower half is exposed
    put(g, sph(4.8, DM, { emissive: DM, emissiveIntensity: .12 }), 0, 6.0, 0).scale.y = .82; // main dome
    put(g, cyl(.07, .07, 1.3, 5, GLD, { emissive: GLD, emissiveIntensity: .3 }), 0, 10.2, 0); // gold finial
    for (const [x, z] of [[4.2, 0], [-4.2, 0], [0, 4.2], [0, -4.2]]) {
      put(g, cyl(2.55, 2.55, 1.4, 10, '#ddd2bc'), x, 3.9, z); // semi-dome drum rising from the body, top at the equator
      put(g, sph(2.6, DML, { emissive: DML, emissiveIntensity: .12 }), x, 4.6, z).scale.y = .78; // four semi-domes (hemispherical caps on drums)
    }
    for (const [x, z] of [[-5.2, -5.2], [5.2, -5.2], [-5.2, 5.2], [5.2, 5.2]]) {
      put(g, box(2, 4.0, 2, '#ddd2bc'), x, 2.0, z); // corner weight towers reaching the dome line
      put(g, cyl(1.66, 1.66, .9, 8, '#ddd2bc'), x, 4.45, z); // corner drum, top at the equator
      put(g, sph(1.7, DML, { emissive: DML, emissiveIntensity: .12 }), x, 4.9, z).scale.y = .8; // four smaller corner domes (seated)
    }
    const minaret = (x, z, h, rings) => { // pencil-slim shaft, balcony ring(s), tall conical cap
      put(g, cyl(.3, .4, h, 6, CRM), x, h / 2, z);
      for (let i = 0; i < rings; i++) put(g, cyl(.5, .5, .35, 6, '#ddd2bc'), x, h * (.62 + i * .24), z);
      put(g, cone(.45, 2.8, 6, DM), x, h + 1.2, z);
    };
    minaret(-7.6, -7.6, 13, 2); minaret(7.6, -7.6, 13, 2); minaret(-7.6, 7.6, 13, 2); minaret(7.6, 7.6, 13, 2); // four at the prayer-hall corners
    minaret(-6.8, 8.4, 11, 1); minaret(6.8, 8.4, 11, 1); // two shorter at the courtyard front
    return 11.5; }, // lr 8.5->11.5 covers the rebuilt footprint (body corner 10.6, corner-minaret corner 11.46, front-minaret corner 11.36) at any scale; old value was the preserved squash artifact. Nearest seeded spot 22.44 from the anchor, well outside disc+1.5.  },
};


/* ---------- stylized named places (inspired, not replicas) ---------- */
function extrasNY(world, colliders, places, R) {
  const stone = '#bdb6a6', stone2 = '#cbc6b9', glow = (c) => ({ emissive: c, emissiveIntensity: .9 });
  // Empire State Building-inspired: stepped limestone tower with a mast
  { const x = -26, z = -30; let y = .6;
    // Source: roof 381 m, antenna 62.2 m, tip 443.2 m (en.wikipedia.org/wiki/Empire_State_Building). Scale 1 u = 10 m. Setback widths and heights are stylised.
    const lim = (w, d, h, yy) => { put(world, box(w, h, d, stone), x, yy + h / 2, z); for (let k = 0; k < h / 1.8; k++) { put(world, box(w + .06, .22, d + .06, '#8fa3b0', { emissive: '#7fb8e8', emissiveIntensity: .1 }), x, yy + .9 + k * 1.8, z).castShadow = false; } };
    lim(15, 15, 6, y); y += 6;
    [[-1, 0], [1, 0]].forEach(([s1]) => { put(world, box(4, 5, 11, stone2), x + s1 * 7.2, y - 3.5, z); });
    lim(11, 11, 11.4, y); y += 11.4;
    [[9.4, 5], [8, 4.5], [6.4, 4], [4.8, 3.5], [3.4, 3]].forEach(([w, h]) => { lim(w, w, h, y); y += h; });
    put(world, cyl(1.5, 1.9, 1.2, 8, stone2), x, y + .6, z); y += 1.2;
    put(world, cyl(.9, 1.3, 1.6, 8, '#b4bcc2', { emissive: '#e8e0b0', emissiveIntensity: .35 }), x, y + .8, z); y += 1.6;
    put(world, cyl(.08, .5, 6.2, 6, '#d8d8d8'), x, y + 3.1, z); colliders.push({ x, z, r: 8.5 });
    places.push({ name: 'Empire State Building-inspired tower', x, z, r: 10 }); }
  // Chrysler Building-inspired: brick shaft, silver stepped crown with arches, spire
  { const x = 28, z = -34; put(world, box(9, 14, 9, '#a98e78'), x, 7.6, z); put(world, box(7, 4, 7, '#a98e78'), x, 16.6, z);
    [[6, 3.2], [5, 2.8], [4, 2.4], [3, 2.2], [2.1, 2]].forEach(([r, h], i) => { const yy = 18.6 + [0, 3.2, 6, 8.4, 10.6][i]; put(world, cyl(r * .6, r * .75, h, 8, '#d5dce4', { metalness: .5, roughness: .25 }), x, yy + h / 2, z); for (const a of [0, 1.57, 3.14, 4.71]) put(world, box(.5, h * .55, .2, '#8fa3b0'), x + Math.sin(a) * r * .55, yy + h / 2, z + Math.cos(a) * r * .55); });
    put(world, cyl(.08, .35, 7, 5, '#e8eef2', { metalness: .6 }), x, 18.6 + 12.6 + 3.5, z); colliders.push({ x, z, r: 6.5 });
    places.push({ name: 'Chrysler Building-inspired tower', x, z, r: 9 }); }
  // Flatiron-inspired wedge
  { const x = 16, z = -14; const w = put(world, cyl(6, 6, 15, 3, '#d3a37a'), x, 8.1, z); w.scale.z = .55; w.rotation.y = 1.3;
    for (let k = 0; k < 5; k++) { const m = put(world, cyl(6.06, 6.06, .6, 3, '#9fb6c4', { emissive: '#7fb8e8', emissiveIntensity: .1 }), x, 3 + k * 2.8, z); m.scale.z = .55; m.rotation.y = 1.3; m.castShadow = false; }
    colliders.push({ x, z, r: 4.5 }); places.push({ name: 'Flatiron Building-inspired wedge', x, z, r: 7 }); }
  // Times Square-style plaza: tiled floor, bright billboards
  { const x = 28, z = 16; put(world, box(24, .1, 18, '#6f737c'), x, .72, z).castShadow = false;
    for (let i = -4; i <= 4; i++) put(world, box(1.2, .12, 18, i % 2 ? '#8b3a3a' : '#7c8088'), x + i * 2.4, .74, z).castShadow = false;
    const cols = ['#ff3d7f', '#35d0ff', '#ffe03a', '#9d6bff', '#4dff88', '#ff8a2a'];
    for (const side of [-1, 1]) { put(world, box(8, 18, 4, '#2c3038'), x + side * 14.5, 9.6, z - 3); 
      for (let k = 0; k < 6; k++) { const c = cols[(k + (side > 0 ? 3 : 0)) % 6]; put(world, box(3.4, 2.1, .25, c, glow(c)), x + side * 12.35 + (k % 2) * side * .1, 3 + Math.floor(k / 2) * 4.6 + (k % 2) * .4, z - 3 + (k % 2 ? -1 : 1) * 1).castShadow = false; } }
    for (const dz of [-6, 6]) { put(world, cyl(.2, .25, 7, 6, '#333'), x, 4, z + dz); const c = cols[(dz > 0 ? 1 : 4)]; put(world, box(6, 3, .3, c, glow(c)), x, 8.5, z + dz).castShadow = false; }
    colliders.push({ x: x + 14.5, z: z - 3, r: 5 }, { x: x - 14.5, z: z - 3, r: 5 });
    places.push({ name: 'Times Square-style plaza (billboards only)', x, z, r: 16 }); }
  // Central Park-style green with pond and paths
  { const x = 56, z = 60; put(world, box(26, .2, 22, '#4aa356'), x, .72, z).castShadow = false;
    put(world, cyl(5.5, 5.5, .15, 18, '#3f8fd0', { roughness: .15 }), x + 3, .85, z + 2).castShadow = false;
    put(world, box(26, .22, 1.4, '#c8b890'), x, .76, z - 5).castShadow = false; put(world, box(1.4, .22, 22, '#c8b890'), x - 7, .76, z).castShadow = false;
    for (let i = 0; i < 16; i++) { const tx = x + (R() * 2 - 1) * 11.5, tz = z + (R() * 2 - 1) * 9.5; if (Math.hypot(tx - (x + 3), tz - (z + 2)) < 7) continue; const t = leafyTree(1, '#3f9a4a'); t.position.set(tx, .7, tz); t.scale.setScalar(.8 + R() * .5); world.add(t); colliders.push({ x: tx, z: tz, r: .6 }); }
    colliders.push({ x: x + 3, z: z + 2, r: 5 }); places.push({ name: 'Central Park-style green', x, z, r: 15 }); }
  // Brooklyn Bridge-inspired stone arches with cables, over the x=-40 road
  for (const z of [-34, 22]) { const x = -40;
    for (const sx of [-5.5, 5.5]) { put(world, box(2.6, 14, 3.4, '#b09a82'), x + sx, 7.7, z); put(world, box(2.6, 2, 3.4, '#b09a82'), x + sx, 15.6, z); colliders.push({ x: x + sx, z, r: 1.9 }); }
    put(world, box(13.6, 2.2, 3.4, '#b09a82'), x, 11.5, z); }
  put(world, box(7, .6, 56, '#8c8f96'), -40, 9.6, -6).castShadow = false;
  for (const sx of [-3.2, 3.2]) for (let i = 0; i < 8; i++) { const t = i / 7, zz = -34 + t * 56, sag = 4 * (1 - Math.pow(2 * t - 1, 2)); put(world, box(.12, 7.5 - sag * 1.1 + 1, .12, '#454a52'), -40 + sx * 1.5, 12.2 - sag * .5 - 2, zz).castShadow = false; }
  places.push({ name: 'Brooklyn Bridge-inspired stone arches', x: -40, z: -6, r: 32 });
}

/* ---------- city builder ---------- */
function seeded(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }


/* Merge static meshes that share a material into one mesh each (draw calls drop, look is identical). Animated groups are skipped. */


/* ---------- more world cities (original primitives; footprints and names only, no third-party assets) ---------- */
Object.assign(CITY_DEFS, {
  rome: { name: 'Rome', sun: ['#ffdf9f', 2.0], ground: '#b5a78a', sky: '#a9d2ee', fog: '#d8dcd0', bld: ['#e0b88a', '#d49a6a', '#ecd2a8', '#c98258'], water: null, landmark: 'colosseum', tree: '#4a8a46' , river: [[-99.31,-110.01,-112.00,-104.83],[-112.00,-46.70,-107.84,-42.36],[-107.84,-42.36,-100.42,-34.62],[-100.42,-34.62,-70.21,-22.55],[-70.21,-22.55,-61.96,-14.36],[-61.96,-14.36,-63.34,-4.37],[-63.34,-4.37,-68.35,3.27],[-68.35,3.27,-76.80,13.75],[-76.80,13.75,-101.97,37.68],[-101.97,37.68,-109.32,51.46],[-109.32,51.46,-110.13,60.03],[-110.13,60.03,-108.15,69.76],[-108.15,69.76,-94.77,110.33]] }, /* Update 115: Tiber CENTRELINE course from OSM relation 1827384 main_stream ways (16 stitched), node-id stitched chains, DP 1.2u, placed through the EXISTING shared extrasRome landmark transform X=(lon-12.4922)*4930, Z=-26-(lat-41.8903)*6672 - river and places share one transform (109/114 precedent). The course leaves the +-112 window at the SW corner (x<-112 between z -104.8 and z -46.7); the two drawn runs are the truthful in-window reaches, NOT a chord across the out-of-window bend. Sourced anchor: Tiber Island 41.89083333N 12.47722222E -> game (-73.8,-29.6), 4.75u from the drawn centreline - the main stem passes east of the island (side channel not drawn, same class as the berlin Spreekanal simplification); plaza centre 63.04u clear (no notch). Width-8 band is our stylization, NOT sourced bank/width evidence; transformed game-scale arrangement, not a real-relationship map; ODbL attribution obligation recorded, public-rollout hold unchanged (dev/HK-SOURCES.md) */
  berlin: { name: 'Berlin', sun: ['#dde4ea', 1.65], ground: '#8f9488', sky: '#a8bccb', fog: '#c4ced4', bld: ['#c4c0b4', '#a9a498', '#d4cfc0', '#8f8c82'], water: null, landmark: 'tvtower', tree: '#4a7f46',
    river: [[111.96, 77.48, 77.56, 50.02],[77.56, 50.02, 61.31, 34.42],[61.31, 34.42, 35.37, 18.56],[35.37, 18.56, 26.63, 15.17],[26.63, 15.17, 9.68, 15.98],[9.68, 15.98, -3.09, 14.22],[-3.09, 14.22, -12.90, 9.81],[-12.90, 9.81, -41.83, -29.68],[-41.83, -29.68, -55.58, -34.95],[-55.58, -34.95, -71.57, -37.03],[-71.57, -37.03, -81.67, -35.88],[-81.67, -35.88, -86.52, -34.55],[-86.52, -34.55, -98.41, -23.34],[-98.41, -23.34, -109.74, -17.07]] }, /* Update 114: Spree CENTRELINE course from OSM relation 390274 main_stream ways (248 ways, node-id stitched, the one window-crossing chain clipped, DP 1.2u), placed through the EXISTING shared extrasBerlin landmark transform X=(lon-13.40944)*4030, Z=-26-(lat-52.52083)*6672 (cities.js extrasBerlin) - river and places share one transform (109/113 pattern). Sourced anchor check: Museum Island 52.52138889N 13.39555556E (MediaWiki API) -> game (-56.0,-29.7), 5.05u from the computed course - consistent, the island sits between the Spree main stem (east) and the Spreekanal (west, relation 412110; NOT drawn - recorded simplification). Plaza centre nearest distance 31.6u > 24.6 - no PLAZA_NOTCH needed. Width-8 band is our stylization, NOT sourced bank/width evidence; transformed game-scale arrangement, not a real-relationship map. RELATIONSHIP LIMITATION (recorded, not resolved): the accepted Berlin Cathedral extras placement at (-33.57,-14.92) is 2.06u from the centreline, INSIDE the h=4 stylized band - the sourced main stem genuinely passes ~45-50m east of the real cathedral, so the overlap is an artifact of the stylized width, not a course error; the accepted placement is preserved (extrasSet free() adds no river check) and a quay/embankment treatment (Berlin's central Spree IS embanked; 109 plaza-quay precedent) is the candidate resolution - Main's call. ODbL attribution obligation recorded, public-rollout hold unchanged (dev/HK-SOURCES.md) */
  moscow: { name: 'Moscow', sun: ['#cfe0f4', 1.6], ground: '#a4a89c', sky: '#b4c4d6', fog: '#d0d8e0', bld: ['#d8c0a0', '#c4a484', '#e8d8bc', '#b48f78'], water: null, landmark: 'onion', tree: '#3f7a46',
    river: [[-93.61, 104.52, -86.14, 93.52],[-86.14, 93.52, -61.03, 70.17],[-61.03, 70.17, -55.11, 36.60],[-55.11, 36.60, -48.43, 22.28],[-48.43, 22.28, -40.63, 12.26],[-40.63, 12.26, -20.26, 1.93],[-20.26, 1.93, -6.38, -1.48],[-6.38, -1.48, 19.65, -4.09],[19.65, -4.09, 41.62, 1.16],[41.62, 1.16, 54.78, 8.25],[54.78, 8.25, 60.63, 13.47],[60.63, 13.47, 68.24, 24.00],[68.24, 24.00, 81.58, 49.84],[81.58, 49.84, 97.47, 101.90]] }, /* Update 113: Moskva CENTRELINE course from OSM relation 389341 main_stream ways (clip lon 37.593..37.653), node-id stitched, DP 1.2u, placed through the EXISTING shared extrasMoscow landmark transform X=(lon-37.62306)*3740, Z=-26-(lat-55.7525)*6672 (cities.js extrasMoscow) - river and places share one transform (109 pattern). Sourced anchor check: Bolshoy Kamenny Bridge 55.74666667N 37.61222222E -> game (-40.5,12.9), 0.53u from the computed course. Width-8 band is our stylization, NOT sourced bank/width evidence; transformed game-scale arrangement, not a real-relationship map; ODbL attribution obligation recorded, public-rollout hold unchanged (dev/HK-SOURCES.md) */
  beijing: { name: 'Beijing', sun: ['#f0dcb0', 1.75], ground: '#b4a88a', sky: '#d4cfb8', fog: '#d8d4c0', bld: ['#c8553a', '#b44a32', '#d9b87a', '#9a4a38'], water: null, landmark: 'pagoda', tree: '#5a8a3a' },
  seoul: { name: 'Seoul', sun: ['#e4e8ee', 1.8], ground: '#8f9c8a', sky: '#b4d4ec', fog: '#cfe0ea', bld: ['#d4d8dc', '#b4bcc4', '#e4e8ec', '#9aa4ae'], water: null, landmark: 'ntower', tree: '#d88a4a' },
  bangkok: { name: 'Bangkok', sun: ['#ffe8a8', 2.05], ground: '#a4a07a', sky: '#bcdcec', fog: '#d4e0d0', bld: ['#e8c870', '#d9a04a', '#f0e0b0', '#c88a44'], water: 'west', river: [[-3.41,-122.00,-5.82,-116.15],[-5.82,-116.15,-7.32,-106.62],[-7.32,-106.62,-8.42,-85.05],[-8.42,-85.05,-6.46,-65.72],[-6.46,-65.72,-1.25,-47.67],[-1.25,-47.67,4.36,-38.30],[4.36,-38.30,21.93,-15.43],[21.93,-15.43,37.77,-3.14],[37.77,-3.14,110.53,17.79],[110.53,17.79,122.00,22.87]], /* Update 118k: Chao Phraya CENTRELINE course from OSM relation 227317 (MultiLineString, Nominatim fetch, dev/research/chao-phraya-r227317.json + bangkok-chaophraya.md), the stitched in-region chain clipped to the DRAWN LAND edge (+-122 = S+10; the 118k first cut stopped at the +-112 playable window and left a rounded cap visibly inside land - Main 15:58 pixel review; extended along the same sourced centerline, no invented chord), DP 1.2u, placed through the EXISTING shared extrasSet bangkok landmark transform X=(lon-100.48889)*6430, Z=-26-(lat-13.74361)*6672 - river and places share one transform (109/113/118 pattern). Sourced anchor checks: Grand Palace extras (20.0,-69.3) sits ~27u east of the course, Wat Pho (30.3,-44.6) ~30u east - both real east-bank landmarks, consistent; the (0,-26) landmark anchor reads as the Wat Arun west bank, centreline nearest approach 13.5u (real temple-to-water gap compressed, recorded). Course enters the r20 plaza pad -> plaza outline notched to the near bank (PLAZA_NOTCH.bangkok, 109 pattern). Width-8 band is our stylization, NOT sourced bank/width evidence (sourced range for the whole river: 200-1200m - LSU WDD/UNESCO + ResearchGate captions - NOT measured at this reach; uncertainty recorded); transformed game-scale arrangement, not a real-relationship map. The pre-existing water:'west' shore + promenade is generic waterfront fabric, NOT the Chao Phraya (the river enters from the NORTH and exits EAST); coexistence is a recorded design limitation, inspected in the 118k stills. ODbL attribution obligation recorded, public-rollout hold unchanged (dev/HK-SOURCES.md) */ landmark: 'stupa', tree: '#2f9a4a' },
  hongkong: { name: 'Hong Kong', sun: ['#ffedc4', 1.9], ground: '#8fa098', sky: '#a8cce0', fog: '#c4dae4', bld: ['#a8c4d4', '#88a8bc', '#c8dce8', '#6f90a8'], water: 'south', landmark: 'harbour', tree: '#2f8f50' },
  losangeles: { name: 'Los Angeles', sun: ['#ffe2a4', 2.05], ground: '#c4b890', sky: '#8fd0f2', fog: '#d4e4e8', bld: ['#f0e0c0', '#e8c8a0', '#f8f0dc', '#d8b890'], water: 'west', landmark: 'hillsign', tree: '#4a9a4a' },
  mexicocity: { name: 'Mexico City', sun: ['#ffe6b0', 2.0], ground: '#b4a484', sky: '#a4d0ec', fog: '#d4dccc', bld: ['#e8845a', '#f0c870', '#7fc4b0', '#e86a8a'], water: null, diagonal: { p0: [-40, 18], p1: [0, -2], hw: 4 }, landmark: 'steppyramid', tree: '#3f8f4a' },
  buenosaires: { name: 'Buenos Aires', sun: ['#fff0cc', 1.9], ground: '#9aa092', sky: '#a4c8e8', fog: '#c8d8e4', bld: ['#e8dcc4', '#d4c4a4', '#c4a484', '#e0b898'], water: 'east', diagonal: { p0: [44.1, 0], p1: [15.5, -16.9], hw: 4 }, landmark: 'obelisk', tree: '#4a9a4a' },
  /* LICENCE TAG: toronto.shorePoly is a 27-point subsample of GSHHG 2.3.7 GSHHS_f L2 Lake Ontario (LGPLv3+, (c) NOAA/Univ. of Hawaii - dev/gshhg-2.3.7-LICENSE.TXT, dev/PROVENANCE.md). INTERNAL-ONLY hold: do not deploy publicly without the owner decision recorded in dev/PROVENANCE.md. */
  toronto: { name: 'Toronto', sun: ['#d8e6f4', 1.7], ground: '#8f9890', sky: '#a4c4e4', fog: '#c8d6e0', bld: ['#a4b4c4', '#8498ac', '#c4d0dc', '#6a7e94'], water: 'south', shoreShift: 60, shorePoly: [[-104,-66],[-96,-65],[-88,-63],[-80,-60],[-72,-57],[-64,-55],[-56,-52],[-48,-48],[-40,-44],[-32,-39],[-24,-35],[-16,-32],[-8,-29],[0,-26],[8,-23],[16,-20],[24,-17],[32,-14],[40,-11],[48,-8],[56,-5],[64,-8],[72,-11],[80,-13],[88,-17],[96,-20],[104,-24]], landmark: 'cntower', tree: '#3f8a4a' },
  athens: { name: 'Athens', sun: ['#ffedbb', 2.05], ground: '#c4b894', sky: '#8fcdf0', fog: '#dcdcc8', bld: ['#f4f0e4', '#e4dcc8', '#f0e8d4', '#d4c8ac'], water: 'south', landmark: 'parthenon', tree: '#7a9a46' },
  amsterdam: { name: 'Amsterdam', sun: ['#f0eadc', 1.7], ground: '#9ab07a', sky: '#b4cade', fog: '#d4dad8', bld: ['#a8502e', '#b86a46', '#8f4a34', '#c88460'], water: null, canalRing: { r0: 50, r1: 54 }, landmark: 'westerkerk', tree: '#5a9a42' },
  lisbon: { name: 'Lisbon', sun: ['#ffe8b8', 2.05], ground: '#c8b894', sky: '#a4d0ee', fog: '#e0dccc', bld: ['#f0e0b8', '#e8c898', '#d8b890', '#f2d8a8'], water: 'south', landmark: 'pombal', tree: '#6a9a4a' },
  lima: { name: 'Lima', sun: ['#f4e8d0', 1.8], ground: '#b0a488', sky: '#b8cce0', fog: '#d4d8d4', bld: ['#e8c860', '#d4a85a', '#f0e0a8', '#c8b080'], water: null, river: [[110.56, -97.45, 105.74, -74.28], [105.74, -74.28, 98.01, -59.31], [98.01, -59.31, 84.89, -48.78], [84.89, -48.78, 69.56, -44.51], [69.56, -44.51, 28.85, -48.87], [28.85, -48.87, 1.76, -49.75], [1.76, -49.75, -66.39, -79.78], [-66.39, -79.78, -101.05, -80.07], [-101.05, -80.07, -104.85, -82.03], [-104.85, -82.03, -107.36, -86.80]], /* Update 118: sourced Rimac course (OSM relation 4637139, 21 main_stream ways, DP 1.2u); research + segment list: dev/research-next-city.md, dev/harness/rimac-course.py */ landmark: 'limacath', tree: '#5a9a4a' },
  marrakesh: { name: 'Marrakesh', sun: ['#ffd8a0', 2.1], ground: '#d4b488', sky: '#a4d4ee', fog: '#ecd8b8', bld: ['#d89a6a', '#c8805a', '#e8b888', '#b8704a'], water: null, landmark: 'koutoubia', tree: '#6a9a3a' },
  madrid: { name: 'Madrid', sun: ['#ffe6b0', 2.05], ground: '#bfa882', sky: '#9ccdee', fog: '#dcd8c8', bld: ['#e8c9a0', '#d4a878', '#f0dcb8', '#c88a5a'], water: null, landmark: 'alcala', tree: '#6a9a46' },
  nairobi: { name: 'Nairobi', sun: ['#fff0c4', 2.0], ground: '#a89a6a', sky: '#9ad0ee', fog: '#d4e0d0', bld: ['#d9c8a0', '#c9a878', '#e8dcc0', '#9ab0a0'], water: null, river: [[-85.5,-122,-66.55,-120.82],[-66.55,-120.82,-57.52,-114.62],[-57.52,-114.62,-48.3,-111.33],[-48.3,-111.33,-35.78,-105.94],[-35.78,-105.94,-16.31,-96.21],[-16.31,-96.21,-8.62,-90.77],[-8.62,-90.77,10.83,-92.31],[10.83,-92.31,21.12,-91],[21.12,-91,50.77,-76.33],[50.77,-76.33,61.44,-74.99],[61.44,-74.99,72.72,-60.19],[72.72,-60.19,84.78,-50.23],[84.78,-50.23,89.44,-43.3],[89.44,-43.3,99.8,-41.04],[99.8,-41.04,113.85,-41.1],[113.85,-41.1,122,-33.85]], /* Update 118s (Main 17:27/17:30 pixel review: exposed rounded terminal on bare ground + braid loop/triangular land slivers in the south-entry frame): (1) TERMINALS - the 118r 40u UNSOURCED RENDERING EXTENSIONS are REMOVED; the course is clipped exactly at the +-122 drawn-land edge and rendered with SQUARED caps flush at the edge (bangkok 118p pattern: drawn subset of the h=4 predicate tube, nothing sites past the edge, inLand-gated). Map-boundary termination, NOT claimed geography: the real Mto Nairobi continues beyond the window both ways (recorded; the 700x700 base plane is ground-colored for water:null cities, so any past-edge cap renders on bare ground - fog-hiding rejected as view-limited, Main 17:30). (2) COURSE APPROXIMATION/GENERALIZATION (Main 17:30 term - NOT "no course change"): the DP-1.2 rendered centerline braided at the stylized 8u width through the western meander reach (20 segment pairs < 8u apart, worst 2.22u at the (-33.5,-108.8) hairpin; bandOutline self-overlap enclosed false land slivers). 9 of 26 in-window vertices removed by iterative smallest-deviation elimination until min non-adjacent segment distance >= 8u; removed-vertex deviations 0.11..3.47u from the DP-1.2 line (max 3.47u at the eliminated hairpin apex); entry/exit edge points unchanged; the eastern reach (x > -8.6) is byte-identical to 118r. The FULL source chain stays preserved separately: dev/research/nairobi-r10726136.json (raw OSM r10726136) + dev/research/nairobi-river.md (the DP-1.2 polyline this generalizes). Sub-width meanders are smoothed as a RENDERING generalization, not erased from the record. Width-8 band remains our stylization, NOT sourced bank/width evidence. All other 118r facts stand (transform, anchors, plaza 65.25u, airport, water:null). ODbL attribution obligation recorded, public-rollout hold unchanged (dev/HK-SOURCES.md) */ landmark: 'kicc', tree: '#5a9a3a' },
  jakarta: { name: 'Jakarta', sun: ['#ffe8b0', 2.0], ground: '#9aa078', sky: '#a8d8ee', fog: '#d0e4dc', bld: ['#e8d8b8', '#d4b890', '#f0e4c8', '#b8a07c'], water: null, river: [[61.80,-161.35,72.39,-103.32],[72.39,-103.32,29.57,-78.22],[29.57,-78.22,28.73,-73.10],[28.73,-73.10,31.01,-64.06],[31.01,-64.06,35.37,-58.40],[35.37,-58.40,28.96,-50.08],[28.96,-50.08,31.37,-47.41],[31.37,-47.41,38.92,-46.35],[38.92,-46.35,39.86,-44.71],[39.86,-44.71,36.20,-37.92],[36.20,-37.92,33.56,-25.83],[33.56,-25.83,34.85,-24.00],[34.85,-24.00,39.67,-23.67],[39.67,-23.67,47.03,-30.78],[47.03,-30.78,52.38,-18.91],[52.38,-18.91,49.50,-10.44],[49.50,-10.44,50.28,-7.22],[50.28,-7.22,55.04,-5.99],[55.04,-5.99,64.51,-9.57],[64.51,-9.57,62.28,-1.23],[62.28,-1.23,52.40,8.36],[52.40,8.36,54.18,11.93],[54.18,11.93,64.32,17.17],[64.32,17.17,59.71,32.27],[59.71,32.27,60.42,35.97],[60.42,35.97,71.52,45.47],[71.52,45.47,82.09,41.38],[82.09,41.38,90.02,41.93],[90.02,41.93,90.54,46.03],[90.54,46.03,88.15,51.51],[88.15,51.51,97.47,57.35],[97.47,57.35,92.47,64.07],[92.47,64.07,93.18,67.90],[93.18,67.90,102.63,76.29],[102.63,76.29,120.98,85.74],[120.98,85.74,109.09,96.93],[109.09,96.93,109.95,106.88],[109.95,106.88,113.63,109.97],[113.63,109.97,162.00,109.33]], /* Update 118l: Ciliwung CENTRELINE course from OSM relation 21468367 (MultiLineString, 2686 pts, Nominatim fetch, dev/research/ciliwung-r21468367.json + jakarta-ciliwung.md), endpoint-stitched main chain clipped EXACTLY to the DRAWN LAND edge +-122 (S*2+20; 118k bounds lesson), DP 1.2u, placed through the EXISTING shared extrasSet jakarta landmark transform X=(lon-106.82714)*6625, Z=-26-(lat+6.17539)*6672 (Monas anchor) - river and places share one transform (109/113/118 pattern). Entry (68.98,-122.00) north edge, exit (122.00,109.86) east edge; the canalized urban reach. End tangents extended 40u past the drawn edge - UNSOURCED RENDERING EXTENSIONS, NOT part of the verified OSM source course (Main 16:41: label as such) - so the band end caps render far OFF-MAP in the base plane (out-of-frame caps only, NOT claimed map-boundary continuity; 8u still read as a visible terminus in outside-camera stills) (the ledgered 118k-fix junction-cap candidate fix, applied jakarta-first: jakarta has water:null - no sea to hide a cap - and the north still showed the entry cap visibly against open ground; bangkok unchanged, its sea-junction tongue stays the recorded open limitation). Sourced anchor checks: Istiqlal extras anchor ~6u WEST of the course, Katedral anchor 8.29u EAST (118n correction: the 118l comment wrongly said west - the sourced course passes BETWEEN the two landmarks; measured signed sides) - both real near-river landmarks, consistent; Monas anchor 33.56u west (real ~600m gap compressed, recorded). Plaza centre 33.56u clear - no PLAZA_NOTCH (berlin 31.6u precedent). Width-8 band is our stylization, NOT sourced bank/width evidence (sourced whole-river planning figures: 35-50m normal / 10-20m narrowed, setkab.go.id PUPR/BBWSCC - NOT reach-measured; uncertainty recorded). COEXISTENCE (Main 16:25 coherence ask): the pre-existing x=-40 water street is generic Batavia-canal flavour (its comment: gameplay arrangement, not a surveyed canal) on the WEST half; the sourced Ciliwung runs entirely on the EAST half (x 28.7..122) - no spatial overlap or crossing; coexistence recorded as a design limitation, not a conflict resolution. OVERLAP RESOLVED (Update 118o, berlin-cathedral rv class): the 118l Istiqlal site (27.04,-62.8) sat 4.17u from the centreline (footprint inside the stylized band - a width-stylization artifact, not a course error) and the Cathedral site (41.79,-67.4) had a ~0.6u corner overlap; both re-sited DRY on their SOURCED banks via the new bank-side-preserving rv:2 (Istiqlal (18.04,-61.3) west, 13.26u off the centreline, 1.26u land gap; Cathedral (43.29,-67.4) east) - the naive rv:1 flipped both across the river and was rejected (118n); one blocking scattered tree cleared via NEWCLEAR.jakarta. ODbL attribution obligation recorded, public-rollout hold unchanged (dev/HK-SOURCES.md) */ landmark: 'monas', tree: '#2f9a4a' },
  bogota: { name: 'Bogotá', sun: ['#e8f0e0', 1.8], ground: '#8a9478', sky: '#a8c8e0', fog: '#c8d4dc', bld: ['#c9a878', '#b8734a', '#e8d8b8', '#9a6a4a'], water: null, landmark: 'monserrate', tree: '#3a7a3a' },
  bogotadowntown: { name: 'Bogotá - La Candelaria', sun: ['#e8f0e0', 1.8], ground: '#8a9478', sky: '#a8c8e0', fog: '#c8d4dc', bld: ['#c9a878', '#b8734a', '#e8d8b8', '#9a6a4a'], water: null, landmark: 'plazacathedral', tree: '#3a7a3a', noAirport: 1 }, /* Update 123: ANCHORED DISTRICT of bogota (Main 9:40 direction + 9:42 approval): one own anchor (Primatial Cathedral 4.59796,-74.07524, MediaWiki API) so every member sits at EXACT sourced relative geography; the parent/district offset is explicit (map pin at the real district coordinate + travel-row note). Replaces the provisional 122 translated cluster. noAirport: a downtown district has no airfield */
  lagosisland: { name: 'Lagos - Lagos Island', sun: ['#ffe8c0', 2.0], ground: '#a89a7a', sky: '#a8d0e8', fog: '#d8e0d8', bld: ['#e8d8b0', '#d4a878', '#c88a5a', '#e0c890'], water: 'south', landmark: 'marinacathedral', tree: '#3a8a3a', noAirport: 1, diagonals: [{ p0: [53.2, 0.2], p1: [42.1, -8.3], hw: 1.5 }, { p0: [42.1, -8.3], p1: [32.8, -13.5], hw: 1.0 }, { p0: [32.8, -13.5], p1: [19.1, -21.8], hw: 1.0 }, { p0: [19.1, -21.8], p1: [12.5, -25.7], hw: 1.0 }, { p0: [12.5, -25.7], p1: [10.3, -27.2], hw: 1.0 }, { p0: [10.3, -27.2], p1: [7.9, -28.9], hw: 1.0 }, { p0: [7.9, -28.9], p1: [6.3, -30.0], hw: 1.0 }, { p0: [6.3, -30.0], p1: [3.3, -32.0], hw: 1.0 }, { p0: [3.3, -32.0], p1: [0.8, -37.2], hw: 1.0 }, { p0: [0.8, -37.2], p1: [-1.13, -41.0], hw: 1.0 } /* Update 133: trimmed to the Tinubu pad's N edge - the sourced terminus (-2.3,-43.3) is the square's NE corner (Broad St flows INTO the square, real relationship); the untrimmed band clipped the re-sited pad's NE corner (probe133 dLine 0.83 < hw 1.0). The sourced end point is absorbed within the square pad - recorded. Update 132: dogleg REMOVED - the reshaped (grounded-footprint) cathedral clears the exact sourced line by 1.23u of band edge; segs 5-10 track sourced points 10-17 with max deviation 0.36u (point 16). Update 131: segs 4-9 follow the sourced way to its end (-2.3,-43.3) through a PLAZA_NOTCH bite - seg 6/7 dogleg at (8.5,-32.1) bows 1.7u off sourced point 13 (6.32,-29.99) to clear the schematic nave's SE corner (band gap 0.29u measured; oversized-model-bulk compromise, recorded); max other deviation 0.4u */ /* Update 130: segs 2-3 at hw 1.0 - the real Broad St frontage passes ~15-25m (~1-1.5u) off Freedom Park's NE edge; the narrower band threads it with a measured 0.10u drawn gap to the re-sited pad; seg 1 stays hw 1.5 (129 accepted pixels) - the taper is a fit compromise, recorded */] }, /* Update 129: Broad-Street-inspired diagonal (Main 10:50 real-street-alignment slice) - OSM way 762582690 geojson (Nominatim lookup 2026-10-29, ODbL ledgered) fitted over its sourced points 1-3 ((53.0,-0.1)/(48.5,-3.5)/(42.1,-8.3) local): max deviation 0.4u over the span. hw 1.5 = narrow-street language (real Broad St ~20m vs the 8-9u schematic avenues; the compressed cluster cannot take a wider band: Freedom Park's pinned site sits 3.4-4.66u from the sourced line, matching the real ~64m gap). OPEN LIMIT: the sourced way CONTINUES SW past Freedom Park/Holy Cross then curves N ~11u W of the cathedral anchor (points 4-18 of the way) - continuing it needs cluster-scale fabric design; ends at (42.1,-8.3), 4.66u NE of Freedom Park's pin, clear by 0.66u at hw 1.5 (probe-measured). East end meets the z=0 generic avenue as a natural junction. */ /* Update 124: ANCHORED DISTRICT of lagos (123 mechanism; Main 9:42 approval + 9:54 continue-Lagos direction): one own anchor (Cathedral Church of Christ 6.4508,3.3902, MediaWiki API 2026-10-29) so members sit at sourced relative geography; parent/district offset explicit (map pin + travel-row note). water south = the Marina harbour frontage (schematic shore, like every city water edge). noAirport: an island district has no airfield */
  auckland: { name: 'Auckland', sun: ['#f2f4e4', 1.95], ground: '#8fa08a', sky: '#a4d2ee', fog: '#cfe0e6', bld: ['#e0dcd0', '#c2ccd4', '#a8b6be', '#d8c9a8'], water: 'east', landmark: 'skytower', tree: '#35804a' },
  lagos: { name: 'Lagos', sun: ['#ffe8c0', 2.0], ground: '#a89a7a', sky: '#a8d0e8', fog: '#d8e0d8', bld: ['#e8d8b0', '#d4a878', '#c88a5a', '#e0c890'], water: 'east', landmark: 'lagoslight', tree: '#3a8a3a' },
  stockholm: { name: 'Stockholm', sun: ['#f0e8d0', 1.85], ground: '#9a9a8a', sky: '#a8c8e0', fog: '#d0dce4', bld: ['#e8d0a8', '#c8784a', '#d8a86a', '#b86a4a'], water: 'east', landmark: 'cityhall', tree: '#4a8a4a' },
  kualalumpur: { name: 'Kuala Lumpur', sun: ['#fff0c8', 2.05], ground: '#8fa878', sky: '#a4d8f0', fog: '#d0e4e4', bld: ['#c8d8dc', '#a4bcc4', '#e4dcc8', '#8fa8b4'], water: null, landmark: 'petronas', tree: '#3a8a46', river: [[34, -110, -26, -56], [-28, -110, -26, -56], [-26, -56, -46, 26], [-46, 26, -30, 48], [-30, 48, -30, 110]] }, /* Update 90: Klang NE arm + Gombak N arm meet at the sourced confluence (Masjid Jamek NW of KLCC), merged Klang exits toward the SW - bearings sourced, schematic straight bands, dev/HK-SOURCES.md */
});
Object.assign(LANDMARK_NAMES, {
  rome: 'Colosseum-inspired arena (Rome)', berlin: 'TV tower-inspired spire (Berlin)', moscow: 'Onion-domed cathedral-inspired landmark (Moscow)', beijing: 'Tiered-roof temple-inspired hall (Beijing)',
  seoul: 'Hilltop tower-inspired landmark (Seoul)', bangkok: 'Wat Arun-inspired riverside prangs (Bangkok)', hongkong: 'Harbour skyline-inspired towers (Hong Kong)', losangeles: 'Hillside letters-inspired sign (Los Angeles)',
  mexicocity: 'Stepped pyramid-inspired landmark (Mexico City)', buenosaires: 'Obelisk-inspired landmark (Buenos Aires)', lisbon: 'Column monument-inspired landmark (Lisbon)', amsterdam: 'Church tower-inspired landmark (Amsterdam)', madrid: 'Neoclassical gate-inspired landmark (Madrid)', marrakesh: 'Minaret-inspired landmark (Marrakesh)', lima: 'Twin-tower cathedral-inspired landmark (Lima)', nairobi: 'Conference tower-inspired landmark (Nairobi)', jakarta: 'Obelisk-and-flame-inspired landmark (Jakarta)', bogota: 'Hilltop church-inspired landmark (Bogotá)', auckland: 'Needle tower-inspired landmark (Auckland)', lagos: 'Harbour lighthouse-inspired landmark (Lagos)', stockholm: 'City hall tower-inspired landmark (Stockholm)', kualalumpur: 'Twin towers-inspired landmark (Kuala Lumpur)', toronto: 'Needle tower-inspired landmark (Toronto)', athens: 'Columned hilltop temple-inspired landmark (Athens)',
});
Object.assign(STYLE, {
  rome: { roof: 'slant', hmax: 10 }, berlin: { roof: 'flat', hmax: 14, prop: 'vending', pc: '#3a8a5a' }, // Späti-style corner kiosk
  moscow: { roof: 'dome', hmax: 14, prop: 'taxi', pc: '#e8c43a' }, // yellow cabs
  beijing: { roof: 'slant', hmax: 9, prop: 'lantern', pc: '#e83a2c', colorful: true }, // red lantern streets seoul: { roof: 'neon', hmin: 8, hmax: 28, prop: 'vending', pc: '#4a8ae8' }, bangkok: { roof: 'slant', hmax: 10, prop: 'rickshaw', pc: '#e8a02a' },
  hongkong: { roof: 'neon', hmin: 14, hmax: 44, prop: 'lantern', pc: '#ff6a3a' }, losangeles: { roof: 'flat', hmax: 10, prop: 'palm' }, mexicocity: { roof: 'flat', hmax: 9, prop: 'cafe', pc: '#e8553a', colorful: true }, // street-food stand colour
  buenosaires: { roof: 'mansard', hmax: 12, prop: 'cafe', pc: '#d9ccb0' }, toronto: { roof: 'glass', hmin: 10, hmax: 38, prop: 'cafe', pc: '#d94a38' }, // coffee-shop density
  athens: { roof: 'flat', hmax: 9 },
  amsterdam: { roof: 'gable', hmax: 9, prop: 'cafe', pc: '#e8782a' },
  lisbon: { roof: 'flat', hmax: 10, prop: 'cafe', pc: '#2f6fb0' },
  lima: { roof: 'flat', hmax: 11, prop: 'cafe', pc: '#c8302a' },
  marrakesh: { roof: 'flat', hmax: 9, prop: 'lantern', pc: '#d9802a' },
  madrid: { roof: 'flat', hmax: 12, prop: 'cafe', pc: '#c8452e' },
  nairobi: { roof: 'flat', hmax: 12, prop: 'cafe', pc: '#d9a63a' }, jakarta: { roof: 'flat', hmax: 11, prop: 'lantern', pc: '#d94a38' },
  bogota: { roof: 'slant', hmax: 10, prop: 'cafe', pc: '#8a4a3a' },
  bogotadowntown: { roof: 'slant', hmax: 8, prop: 'cafe', pc: '#8a4a3a' }, /* La Candelaria low colonial */
  lagosisland: { roof: 'flat', hmax: 9, prop: 'cafe', pc: '#d9802a' }, /* Lagos Island mid-rise commercial */
  auckland: { roof: 'flat', hmax: 13, prop: 'cafe', pc: '#2a6a7a' },
  lagos: { roof: 'flat', hmax: 12, prop: 'cafe', pc: '#d9802a' },
  stockholm: { roof: 'slant', hmax: 9, prop: 'cafe', pc: '#b86a4a' },
  kualalumpur: { roof: 'flat', hmax: 14, prop: 'cafe', pc: '#2a7a6a' },
});
{ const mk = (a, b, c, d, e) => ({ flower: a, mango: b, jackfruit: c, umbrella: d, banana: e }), coin = ['Gold coin', 'coin', '#ffd23f'];
  Object.assign(CITY_ITEMS, {
    rome: mk(['Poppy', 'flower', '#e8452c'], ['Gelato', 'cone', '#f4e4c8'], ['Espresso', 'cup', '#6a3f2a'], ['Mosaic tile', 'gem', '#2f7bd9'], coin),
    berlin: mk(['Cornflower', 'flower', '#4a7fe8'], ['Pretzel', 'ring', '#c98a4a'], ['Coffee mug', 'cup', '#c0302a'], ['Bear badge', 'gem', '#e8b923'], coin),
    moscow: mk(['Daisy', 'flower', '#ffffff'], ['Pirozhki', 'dome', '#d9a05a'], ['Tea glass', 'cup', '#a0522d'], ['Nesting doll', 'ball', '#e8452c'], coin),
    beijing: mk(['Peony', 'flower', '#ff7fa8'], ['Bao bun', 'dome', '#f4ecd8'], ['Tea cup', 'cup', '#7fae5c'], ['Paper lantern', 'ball', '#e8452c'], coin),
    seoul: mk(['Camellia', 'flower', '#e84a6a'], ['Kimbap', 'disc', '#2a3a2a'], ['Tea cup', 'cup', '#c98a4a'], ['Lantern', 'ball', '#ff9fb8'], coin),
    bangkok: mk(['Orchid', 'flower', '#b06ae8'], ['Mango', 'dome', '#ffb43a'], ['Coconut', 'ball', '#8a6a3a'], ['Lotus lamp', 'gem', '#ff8fb0'], coin),
    hongkong: mk(['Bauhinia', 'flower', '#d63a8a'], ['Egg tart', 'disc', '#f0c870'], ['Milk tea', 'cup', '#c98a4a'], ['Red lantern', 'ball', '#e8452c'], coin),
    losangeles: mk(['Poppy', 'flower', '#ff9a23'], ['Orange', 'ball', '#ff9a23'], ['Smoothie', 'cup', '#ff6ab0'], ['Skate wheel', 'ring', '#2a2a2a'], coin),
    mexicocity: mk(['Marigold', 'flower', '#f59a23'], ['Taco', 'dome', '#e8c870'], ['Hot chocolate', 'cup', '#6a3f2a'], ['Papel picado', 'gem', '#e86a8a'], coin),
    buenosaires: mk(['Ceibo flower', 'flower', '#e8302c'], ['Empanada', 'dome', '#d9a05a'], ['Mate gourd', 'cup', '#6a8a3a'], ['Tango shoe', 'gem', '#2a2a2a'], coin),
    toronto: mk(['Trillium', 'flower', '#ffffff'], ['Maple leaf', 'flower', '#d63a2a'], ['Hot chocolate', 'cup', '#6a3f2a'], ['Hockey puck', 'disc', '#2a2a2a'], coin),
    athens: mk(['Olive blossom', 'flower', '#cfe8b0'], ['Olive', 'ball', '#4a6a3a'], ['Coffee cup', 'cup', '#c98a4a'], ['Clay vase', 'dome', '#c9602a'], coin),
    amsterdam: mk(['Tulip', 'flower', '#e8402c'], ['Stroopwafel', 'disc', '#c8923a'], ['Bicycle bell', 'dome', '#d8d8dc'], ['Wooden clog', 'long', '#d8a040'], coin),
    lisbon: mk(['Pastel de nata', 'disc', '#e8b858'], ['Blue tile', 'box', '#3f7fc8'], ['Sardine', 'long', '#a8b8c0'], ['Jacaranda', 'flower', '#9a7ad8'], coin),
    lima: mk(['Cantuta', 'flower', '#e8404a'], ['Lucuma', 'ball', '#e8b838'], ['Inca Kola', 'cup', '#e8d040'], ['Pan flute', 'disc', '#c89a5a'], coin),
    marrakesh: mk(['Orange blossom', 'flower', '#ffe8b8'], ['Date', 'ball', '#6a3f2a'], ['Mint tea', 'cup', '#7ab888'], ['Brass lantern', 'dome', '#d9a63a'], coin),
    madrid: mk(['Orange blossom', 'flower', '#ffe0b0'], ['Churro', 'disc', '#d9a05a'], ['Cafe con leche', 'cup', '#a8683a'], ['Flamenco fan', 'disc', '#c8302a'], coin),
    nairobi: mk(['Acacia flower', 'flower', '#e8c050'], ['Coffee bean', 'ball', '#5a3a2a'], ['Safari tea', 'cup', '#c98a4a'], ['Kiondo basket', 'dome', '#c98a4a'], coin),
    jakarta: mk(['Jasmine', 'flower', '#ffffff'], ['Orchid', 'flower', '#c46ad8'], ['Iced kopi', 'cup', '#8a5a3a'], ['Batik fan', 'disc', '#3a6aa8'], coin),
    bogota: mk(['Frailejón', 'flower', '#c8d46a'], ['Emerald', 'gem', '#2ab87a'], ['Tinto coffee', 'cup', '#4a2e1a'], ['Ruana poncho', 'disc', '#8a5a3a'], coin),
    bogotadowntown: mk(['Frailejón', 'flower', '#c8d46a'], ['Emerald', 'gem', '#2ab87a'], ['Tinto coffee', 'cup', '#4a2e1a'], ['Chicha', 'cup', '#d9b06a'], coin),
    lagosisland: mk(['Hibiscus (zobo)', 'flower', '#c8302a'], ['Kola nut', 'ball', '#8a5a3a'], ['Jollof rice', 'dome', '#d9702a'], ['Suya skewers', 'ball', '#a8502a'], coin),
    auckland: mk(['Pohutukawa blossom', 'flower', '#e03a2a'], ['Paua shell', 'gem', '#3aa89a'], ['Flat white', 'cup', '#c9a06a'], ['Silver fern', 'disc', '#b8c4b0'], coin),
    lagos: mk(['Hibiscus (zobo)', 'flower', '#c8302a'], ['Kola nut', 'ball', '#8a5a3a'], ['Jollof rice', 'dome', '#d9702a'], ['Ankara print', 'disc', '#e8a02a'], coin),
    stockholm: mk(['Wildflower', 'flower', '#7ab8e0'], ['Lingonberry', 'ball', '#c03040'], ['Kanelbulle', 'dome', '#c98a4a'], ['Dala horse', 'disc', '#c8302a'], coin),
    kualalumpur: mk(['Bunga raya', 'flower', '#e0304a'], ['Durian', 'ball', '#9ab83a'], ['Teh tarik', 'cup', '#d9a35a'], ['Wau kite', 'disc', '#3a8ac8'], coin),
  }); }
Object.assign(LM, {
  colosseum(g) { // Colosseum-inspired amphitheatre, grounded in exterior reference photos (Wikimedia Commons: 'Rome Colosseum exterior 2'): elliptical ring, three open arcade tiers separated by entablature bands, solid attic with small windows on the surviving side, and the iconic broken silhouette where the ruined half drops to two tiers
    const stone = '#d8c8a4', band = '#cbb98f', shadow = '#4a3f30';
    const eS = { emissive: stone, emissiveIntensity: .3 }, eB = { emissive: band, emissiveIntensity: .3 }; // spawn-facing side sits in shadow
    const archCache = {};
    const EX = 1.22; // the real plan is an ellipse, longer than deep
    const px = (a, r) => [Math.cos(a) * r * EX, Math.sin(a) * r];
    put(g, cyl(15, 16, 1, 28, '#d0bf98'), 0, .5, 0).scale.x = EX; // base platform
    put(g, cyl(8.6, 9.2, 9.4, 28, shadow), 0, 5.7, 0).scale.x = EX; // dark interior mass: shows through the arcade openings, leaves the arena floor ring visible from above
    put(g, cyl(9, 9, .2, 20, '#c9a46a'), 0, 1.1, 0).scale.x = EX; // arena floor
    const ruined = a => Math.cos(a) > .35; // ruined half: right side as seen from spawn
    for (let t = 0; t < 3; t++) for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2, [x, z] = px(a, 13.4), baseY = 1.2 + t * 3.4;
      if (ruined(a) && t === 2) { // stepped break: a couple of broken stubs where the wall fell
        if (Math.cos(a) < .6) put(g, box(3, 1.4, 1.3, stone, eS), x, baseY + .7, z).rotation.y = -a + Math.PI / 2;
        continue;
      }
      put(g, box(3, 3, 1.3, i % 2 ? stone : '#cdbc96', eS), x, baseY + 1.5, z).rotation.y = -a + Math.PI / 2; // piers; the dark core reads as the arched openings between them
      { const [qx, qz] = px(a, 13.95); put(g, box(.55, 3, .4, band, eB), qx, baseY + 1.5, qz).rotation.y = -a + Math.PI / 2; // engaged pilaster: vertical relief on the pier face for close views
        put(g, box(.8, .22, .55, stone, eS), qx, baseY + 3.05, qz).rotation.y = -a + Math.PI / 2; } // pilaster capital
      { // arch head: a stone spandrel block with a real semicircular arch cut out of it, set in the top of the bay between this pier and the next. The cut-out is empty (no geometry inside it), so the bay stays an open void under a rounded arch.
        const a2 = (i + 1) / 20 * Math.PI * 2, [x2, z2] = px(a2, 13.4), ab = (a + a2) / 2, [bx, bz] = px(ab, 13.4), gap = Math.hypot(x2 - x, z2 - z) - 3;
        if (!(t === 2 && (ruined(a) || ruined(a2))) && gap > .9) {
          const r = gap / 2 - .02, H = r + .3, key = Math.round(gap * 20), W = gap + .12;
          const cache = archCache;
          if (!cache[key]) { const sh = new THREE.Shape(); sh.moveTo(-W / 2, 0); sh.lineTo(-r, 0); sh.absarc(0, 0, r, Math.PI, 0, true); sh.lineTo(W / 2, 0); sh.lineTo(W / 2, H); sh.lineTo(-W / 2, H); sh.closePath(); const ge = new THREE.ExtrudeGeometry(sh, { depth: .8, bevelEnabled: false, curveSegments: 6 }); ge.translate(0, 0, -.4); cache[key] = ge; }
          const m = box(1, 1, 1, band, eB); m.geometry = cache[key]; put(g, m, bx, baseY + 3 - H, bz).rotation.y = -ab + Math.PI / 2; } }
    }
    put(g, cyl(14.1, 14.1, .45, 28, band, eB), 0, 4.35, 0).scale.x = EX; // entablature bands between the tiers
    put(g, cyl(14.1, 14.1, .45, 28, band, eB), 0, 7.75, 0).scale.x = EX;
    for (let i = 0; i < 20; i += 1) { const a = i / 20 * Math.PI * 2; if (ruined(a)) continue; const [x, z] = px(a, 13.6); put(g, box(4.2, 2, 1.2, stone, eS), x, 11.9, z).rotation.y = -a + Math.PI / 2; if (i % 2 === 0) { const [wx, wz] = px(a, 14.35); put(g, box(.7, .7, .3, shadow), wx, 11.9, wz).rotation.y = -a + Math.PI / 2; } } // attic with small square windows, tall side only
    return 17.5; }, // collider covers the ellipse long axis; Rome has no pickup spots so the larger disc blocks no pickups
  tvtower(g) {
    // Stylized Berlin TV tower-inspired landmark (Fernsehturm, Alexanderplatz): tapered concrete shaft,
    // the 203 m visitor sphere with its red band, red antenna above to 368 m. Stylized, not surveyed.
    // Source: https://en.wikipedia.org/wiki/Fernsehturm_Berlin ('368 metres', sphere at '203 metres' with
    // visitor platform and revolving restaurant, red-and-white antenna). Built at natural height ~19.6
    // under the raised berlin landmark cap so it is no longer cap-squashed (old build was 53 tall,
    // squashed .245, which collapsed the effective disc to 1.226 and read as a bollard at street level).
    put(g, cyl(.55, 1.15, 10.8, 10, '#c4c8cc'), 0, 5.4, 0);
    put(g, cyl(1.05, 1.25, 1, 10, '#b8bcc0'), 0, 10.6, 0);
    put(g, sph(2.45, '#d4d8dc', { metalness: .3, roughness: .3 }), 0, 10.9, 0);
    put(g, cyl(2.47, 2.47, .45, 14, '#e8402c'), 0, 10.9, 0);
    put(g, cyl(.09, .32, 6.1, 5, '#e8402c'), 0, 16.4, 0);
    return 2;
  },
  onion(g) { // St Basil's-inspired cluster, stylized silhouette not surveyed, sourced plan grammar: a tall central tent-roof tower ringed by 8 chapels (4 larger octagonal at the cardinal points, 4 smaller at the diagonals), 9 patterned onion domes in all (https://en.wikipedia.org/wiki/Saint_Basil%27s_Cathedral: "eight chapels arranged around a ninth, central chapel", "nine distinctive onion domes", height max 47.5 m, deep red/green palette). Natural H ~18.7 (central tent + gold onion + finial) reads over the hmax-14 skyline at scale 1 under the raised moscow:20 cap (rio/buenosaires precedent: the landmark's identity is its silhouette height; old build topped out at 13.1 and barely cleared the cap-13 squash). Central-to-chapel top ratio ~1.8 vs the real ~47.5/28 ~1.7.
    const RED = '#d94a38', CRM = '#f6efe2', GLD = '#e8b923', GRN = '#2f5d3a';
    put(g, box(17, 1.9, 13, RED), 0, .95, 0); put(g, box(17.6, .5, 13.6, CRM), 0, 2.1, 0); // common gallery platform, white string course (footprint corner r 10.70)
    put(g, cyl(1.9, 2.3, 6.5, 8, RED), 0, 5.6, 0); put(g, cyl(2.05, 2.05, .45, 8, CRM), 0, 8.9, 0); // central octagonal drum + trim ring
    put(g, cone(2.45, 7.2, 8, '#b03a30'), 0, 12.6, 0); // tall shater tent
    const cg = put(g, sph(.85, GLD, { metalness: .25, emissive: GLD, emissiveIntensity: .15 }), 0, 16.6, 0); cg.scale.y = 1.35; put(g, cone(.26, .95, 6, GLD), 0, 18.2, 0);
    const chapel = (x, z, dr, h, domeR, c, stripe) => { // one chapel: brick drum, trim band, coloured onion, gold finial
      put(g, cyl(dr * .8, dr, h, 8, RED), x, 2.35 + h / 2, z);
      put(g, cyl(dr * 1.06, dr * 1.06, .4, 8, CRM), x, 2.35 + h + .1, z);
      const d = put(g, sph(domeR, c, { metalness: .15, emissive: c, emissiveIntensity: .18 }), x, 2.35 + h + .35 + domeR * .78, z); d.scale.y = 1.3;
      if (stripe) put(g, cyl(domeR * 1.01, domeR * 1.01, .34, 10, CRM), x, 2.35 + h + .35 + domeR * .78, z); // pale swirl band at the dome equator
      put(g, cone(.22, .8, 6, GLD), x, 2.35 + h + .35 + domeR * 1.98, z);
    };
    chapel(5.6, 0, 1.45, 4.8, 1.55, '#e8452c'); chapel(-5.6, 0, 1.45, 4.8, 1.55, GLD); // larger cardinal chapels
    chapel(0, -4.4, 1.45, 5.4, 1.55, '#2f7bd9'); chapel(0, 4.4, 1.45, 4.4, 1.55, '#2f8f58');
    chapel(5.4, -4.0, 1.05, 3.6, 1.1, '#2f7bd9', true); chapel(-5.4, -4.0, 1.05, 3.9, 1.1, '#e8452c'); // smaller diagonal chapels
    chapel(5.4, 4.0, 1.05, 3.3, 1.1, '#2f8f58', true); chapel(-5.4, 4.0, 1.05, 3.6, 1.1, GLD);
    put(g, box(2.2, 1.6, 2.2, RED), -7.5, 3.15, -5.2); put(g, cone(1.3, 1.8, 4, GRN), -7.5, 4.85, -5.2); // gallery tents (wrap-around galleries with tented roofs)
    put(g, box(2.2, 1.6, 2.2, RED), 7.5, 3.15, 5.2); put(g, cone(1.3, 1.8, 4, GRN), 7.5, 4.85, 5.2);
    return 11; }, // lr 10->11 covers the rebuilt platform corner (10.70) and gallery-tent corner (10.94) at any scale; every seeded collectible spot stays outside the disc+1.5 walk band (nearest spot is 17.48 from the anchor).
  pagoda(g) { put(g, cyl(12, 13, 1.5, 24, '#e8e0d0'), 0, .75, 0); put(g, cyl(10, 11, 1.2, 24, '#d8d0c0'), 0, 2.1, 0); put(g, cyl(5.5, 5.5, 8.6, 16, '#c8402f'), 0, 6.7, 0); for (let i = 0; i < 3; i++) { put(g, cone(9 - i * 1.8, 3.2, 16, '#2a5a9a'), 0, 11.5 + i * 5.2, 0); if (i < 2) { put(g, cyl(3.6 - i * .6, 1.2 - i * .2, 2.4, 12, '#c8402f'), 0, 12 + i * 5.2, 0); put(g, cyl(3.6 - i * .6, 3.6 - i * .6, 2, 16, '#c8402f'), 0, 14.2 + i * 5.2, 0); } } put(g, cyl(.16, .3, 1.7, 6, '#e8b923'), 0, 24.1, 0); put(g, sph(.8, '#e8b923', { metalness: .25 }), 0, 25.3, 0); return 13; }, // finial sits on the top roof apex (was a floating ball 2.7u above it). Tier drums now structurally supported at full width (seoul floating-shaft fix class): main drum lengthened 8->8.6 to embed .3 into the terrace, and a tapered neck under each upper drum rises from inside the roof cone to carry the drum's full r3.6/3.0 width (was a wide disc balanced on the cone apex with a visible sky ring at the rim). Temple-of-Heaven-inspired tiered pagoda, stylized silhouette not surveyed. Natural H 26.1; under the old h13 cap it squashed to .498 = a gazebo, disc collapsed 13->5.98 leaving the r13 round base outside collision. beijing cap raised to 20 (rio/buenosaires precedent); lr 12->13 covers the base radius at any scale, same fix class as rio's cone base.
  ntower(g) {
    // Stylized N-Seoul-Tower-inspired landmark: a 236 m broadcast tower (the nation's first
    // multi-broadcaster tower, public since 1980) on its Namsan hill, observatory deck with the
    // blue-lit ring, antenna mast. Source: https://en.wikipedia.org/wiki/N_Seoul_Tower ('236-metre-tall',
    // 'first tower servicing multiple TV and radio broadcasters', 'landmark and symbol of the city').
    // Stylized, not surveyed. Rebuilt at natural ~18.0 under the raised seoul landmark cap (old build
    // was 44 tall, cap-squashed to .295, which collapsed the effective disc to 1.77 - inside the shaft).
    // Disc 4.5 = the visible hill footprint, so the stamp fires at the foot of the hill, not mid-slope.
    put(g, cone(4.5, 2.6, 12, '#6f9a56'), 0, 1.3, 0);
    put(g, cyl(.6, 1.3, 8.5, 10, '#e4e8ec'), 0, 6, 0); // base sunk to y1.75, inside the cone (surface r1.47 there) - no float
    put(g, cyl(3, 2.2, 2.4, 12, '#f4f4f4'), 0, 10.65, 0);
    put(g, cyl(3.05, 3.05, .9, 12, '#4a8ae8', { emissive: '#4a8ae8', emissiveIntensity: .5 }), 0, 11.95, 0);
    put(g, cyl(.09, .3, 5.6, 5, '#c0c4c8'), 0, 15.2, 0);
    return 4.5;
  },
  kicc(g) { // KICC-inspired, stylised (not surveyed), sourced key features (https://en.wikipedia.org/wiki/Kenyatta_International_Convention_Centre): just over 105 m, 32 floors, completed 1973 (architect Karl Henrik Nostvik with David Mutiso); light terracotta facade; "the tower consists of a cylinder composed of several cuboids and the amphitheatre and helipad both resemble cones"; revolving restaurant with panoramic views near the top; construction phased podium -> main tower -> Plenary. Rebuilt at natural ~19.85 under the nairobi:20 cap (old build was 28.7, squashed .697). Floor bands now ring the full shaft (the old build drew 8 glass slabs on the +z face only, so three sides read blank). Plenary hall and amphitheatre are skipped (noted, not claimed).
    put(g, cyl(4.8, 5.2, 1.1, 20, '#d8d0bc'), 0, .55, 0); // low circular podium (phase I)
    put(g, cyl(1.8, 2.1, 15.3, 16, '#cd8f62'), 0, 8.75, 0); // main tower, light terracotta (1.1..16.4); "cylinder composed of several cuboids" stylised as the ring bands
    for (let k = 0; k < 6; k++) { const bh = 3.95 + k * 2.1, br = 2.1 - (bh - 1.1) * (.3 / 15.3) + .045; // full-ring floor bands on all faces, flush with the taper (last at 14.45, clear of the crown)
      put(g, cyl(br, br, .3, 16, '#8fa8b0'), 0, bh, 0).castShadow = false; }
    put(g, cyl(2.5, 2.3, 1.2, 16, '#b8b09a'), 0, 17, 0); // wider crown ring (16.4..17.6)
    put(g, cyl(2.42, 2.42, .5, 16, '#8fa8b0', { emissive: '#8fa8b0', emissiveIntensity: .25 }), 0, 17, 0).castShadow = false; // revolving-restaurant panoramic band
    put(g, cyl(2.5, 2.5, .18, 16, '#c8c4b8'), 0, 17.7, 0); // helipad deck
    put(g, cone(.8, 2, 12, '#d8d4c8'), 0, 18.85, 0); // the helipad's cone (17.85..19.85)
    return 7.6 * (20 / 28.7); }, // identical effective collider disc to the pre-rebuild build (old return 7.6 x old cap squash 20/28.7): unchanged placement stream
  monas(g) { // Monas-inspired, stylised (not surveyed), sourced key features (https://en.wikipedia.org/wiki/National_Monument_(Indonesia)): 132 m marble obelisk; a 117.7 m shaft on a 45 m square goblet-yard platform 17 m tall (the yoni; the shaft is the lingga); observation deck at 115 m; the Flame of Independence is 14.5 t bronze covered in gold leaf, 14 m high and 6 m across in 77 sections, on a 3 m goblet-shaped base. Rebuilt at natural ~19.45 under the jakarta:20 cap (old build was 38.3 squashed .522). Flame now reads as a teardrop-and-tip flame rather than a plain cone; the top cluster is slimmer, toward the sourced 6 m flame vs 45 m platform proportion. Reliefs, museum dioramas and the 77 flame sections are stylised away (noted, not claimed).
    put(g, box(9.4, .6, 9.4, '#d8d4c8'), 0, .3, 0); // plaza slab (same rendered extent as the old squashed 18x1.2)
    put(g, box(6.3, .4, 6.3, '#e4e0d4'), 0, .8, 0); // inner slab
    put(g, box(4.2, 2.1, 4.2, '#ece8de'), 0, 2.05, 0); // goblet-yard platform (the yoni; 45 m x 17 m class)
    put(g, cyl(.8, 1.1, 13.2, 4, '#f4f0e6'), 0, 9.7, 0).rotation.y = Math.PI / 4; // marble obelisk shaft, square section (3.1..16.3)
    put(g, cyl(.95, .6, .45, 4, '#ece8de'), 0, 16.5, 0).rotation.y = Math.PI / 4; // the flame's goblet-shaped base
    put(g, box(1.6, .25, 1.6, '#e4e0d4'), 0, 16.85, 0); // observation deck (115 m class)
    const flameM = { emissive: '#e8a010', emissiveIntensity: .5, metalness: .4, roughness: .35 };
    put(g, sph(.55, '#e8b923', flameM), 0, 17.75, 0).scale.y = 1.45; // gold-leaf flame body (teardrop)
    put(g, cone(.3, 1.1, 8, '#e8b923', flameM), 0, 18.9, 0); // flame tip (top ~19.45)
    return 9 * (20 / 38.3); }, // identical effective collider disc to the pre-rebuild build (old return 9 x old cap squash 20/38.3): unchanged placement stream
  alcala(g) { // Puerta-de-Alcala-inspired, stylised (not surveyed), sourced key features: neoclassical granite city gate (Francesco Sabatini, inaugurated 1778, gate of the Walls of Philip IV), 19.5 m tall x 43 m wide - a LOW, WIDE monument, real aspect ~2.2:1 - with FIVE bays: three rounded carriage arches in the centre and two smaller linteled rectangular pedestrian doorways at the sides (https://en.wikipedia.org/wiki/Puerta_de_Alcal%C3%A1; https://www.esmadrid.com/en/tourist-information/puerta-alcala; https://madridauthority.com/en/attractions/puerta-de-alcala). Central plaque REGE CAROLO III ANNO MDCCLXXVIII; the two faces are decorated differently. Update-101 rebuild after main's 9:01 review: the Update-100 build kept height (14.3) at the expense of silhouette (~1.23:1); this build fits a PROPORTIONATE SMALLER gate inside the unchanged 9.5 disc - 18.4 cornice width x ~8.3 apex = ~2.2:1, the sourced aspect. IMPORTANT HONESTY: the five "openings" are OPAQUE DARK FACADE INSETS (proud boxes), not true voids; the whole monument sits inside the r9.5 collider disc and players CANNOT walk through it - "openings" here means the visual bay rhythm only. Pilasters on both faces; the faces' distinct sculpture (war trophies vs royal arms) stylised to matching pilasters + plaque blocks, difference stylised away. Natural top ~8.3 < madrid:20, no squash; return 9.5 unchanged - identical effective collider disc; footprint corner 9.22 (base/cornice 9.46) inside it. No R() use.
    put(g, box(18.4, .5, 4.4, '#d8d0bc'), 0, .25, 0); put(g, box(18, 5.3, 4.0, '#e4dcc4'), 0, 3.15, 0);
    for (const x of [-4.8, 0, 4.8]) { put(g, box(2.6, 3.4, 4.2, '#2a2a30'), x, 2.2, 0).castShadow = false; put(g, cyl(1.3, 1.3, 4.2, 12, '#2a2a30'), x, 3.9, 0).rotation.x = Math.PI / 2; } /* three rounded carriage-arch INSETS (opaque, not voids) */
    for (const x of [-7.7, 7.7]) put(g, box(1.5, 3.0, 4.2, '#2a2a30'), x, 2.0, 0).castShadow = false; /* two flat-topped linteled doorway INSETS */
    put(g, box(18.4, .5, 4.4, '#bfb69a'), 0, 6.05, 0); put(g, box(8, .7, 3.6, '#e4dcc4'), 0, 6.65, 0);
    { const ped = put(g, cyl(1.3, 1.3, 2.6, 3, '#cfc4a4'), 0, 7.0, 0); ped.rotation.x = -Math.PI / 2; ped.scale.z = .32; } // triangular pediment, apex ~8.3
    for (const zs of [-2.13, 2.13]) for (const x of [-6.5, -2.4, 2.4, 6.5]) put(g, cyl(.26, .3, 5.0, 8, '#f0e8d0'), x, 3.0, zs); // half-columns between the bays, BOTH faces
    for (const zs of [-2.06, 2.06]) put(g, box(1.3, .5, .12, '#f0e8d0'), 0, 5.5, zs).castShadow = false; /* the REGE CAROLO III plaque, stylised as a pale block */
    return 9.5; },
  koutoubia(g) { // Koutoubia-inspired, stylised (not surveyed), sourced key features (https://en.wikipedia.org/wiki/Koutoubia_Mosque): 77 m minaret; square main shaft 12.81 m per side and 55.68 m tall, about four fifths of the tower; height-to-width slightly over 5:1; top edge crowned by stepped merlons; smaller secondary shaft with paired windows on each facade; fluted dome; finial pole with three spheres decreasing in size upward. Kept at ~5:1 in natural units under the marrakesh:20 cap (no squash). Sebka lattice, zellij band and dome fluting are stylised away (noted, not claimed).
    put(g, box(6, .8, 6, '#d8c4a0'), 0, .4, 0); // low plinth
    put(g, box(4, 13.5, 4, '#c8805a'), 0, 7.55, 0); // main square shaft (0.8..14.3), ~5:1 silhouette
    for (const s of [-1, 1]) { // inset panel relief on all four shaft faces (the source's varying arch motifs, stylised as plain insets)
      for (const dx of [-1.1, 0, 1.1]) { put(g, box(.6, 2.6, .12, '#8a4a30'), dx, 11.4, s * 2.02).castShadow = false; put(g, box(.6, 2.6, .12, '#8a4a30'), s * 2.02, 11.4, dx).castShadow = false; }
      for (const dx of [-.7, .7]) { put(g, box(.5, 1.4, .12, '#8a4a30'), dx, 7.2, s * 2.02).castShadow = false; put(g, box(.5, 1.4, .12, '#8a4a30'), s * 2.02, 7.2, dx).castShadow = false; }
    }
    put(g, box(4.5, .5, 4.5, '#e8d4b0'), 0, 14.55, 0); // open-air platform at the shaft top (14.3..14.8)
    for (const s of [-1, 1]) for (let k = -2; k <= 2; k++) { const h = (k & 1) ? .3 : .5; // stepped merlons crowning the top edge
      put(g, box(.38, h, .38, '#c8805a'), k * .85, 14.8 + h / 2, s * 2.05); put(g, box(.38, h, .38, '#c8805a'), s * 2.05, 14.8 + h / 2, k * .85); }
    put(g, box(2, 2.4, 2, '#d4a070'), 0, 16, 0); // secondary shaft (14.8..17.2)
    for (const s of [-1, 1]) for (const dx of [-.45, .45]) { put(g, box(.3, .9, .1, '#8a4a30'), dx, 16.1, s * 1.02).castShadow = false; put(g, box(.3, .9, .1, '#8a4a30'), s * 1.02, 16.1, dx).castShadow = false; } // paired windows per facade
    const dome = put(g, sph(1.05, '#c8a050'), 0, 17.5, 0); dome.scale.y = .75; // fluted dome (stylised smooth)
    put(g, cyl(.08, .08, 1.9, 6, '#e8c050', { metalness: .5, roughness: .3 }), 0, 18.6, 0); // finial pole
    for (const [r2, y2] of [[.42, 18.25], [.3, 18.85], [.2, 19.3]]) put(g, sph(r2, '#e8c050', { metalness: .5, roughness: .3 }), 0, y2, 0); // three spheres, decreasing upward
    return 5 * (20 / 29.6); }, // identical effective collider disc to the pre-rebuild build (old return 5 x old cap squash 20/29.6): unchanged placement stream
  limacath(g) { // Lima-Cathedral-inspired, stylised (not surveyed), sourced key features (https://en.wikipedia.org/wiki/Metropolitan_Cathedral_of_Lima): construction 1535-1797 (present form 1602-1797, begun by Pizarro); Renaissance wide facade with THREE main-facade doors and a Plateresque main portal; TWIN BELL TOWERS with open belfry levels (current towers rebuilt 1794-1797; left tower holds the "la Cantabria" bell, right tower "la Purisima" and "la Vieja"). Update-102 rebuild: the old towers were plain slabs with a single front-face-only window box and no belfry; now belfry opening INSETS (opaque dark boxes, not voids) on all four faces of each tower, slimmer towers and spires, a low central gable and cornice over the central body, and three door insets (centre larger) instead of one. Facade detail remains +z-face-oriented per the real single main facade. Natural top ~18.3 < lima:20, no squash (old 18.9 < 20 also unsquashed); return 9.5 unchanged - identical effective collider disc; base trimmed 18x8 -> 17.6x6.8 (corner 9.43; the old base corner poked to 9.85, outside the disc). No R() use.
    put(g, box(17.6, 1, 6.8, '#d8c8a0'), 0, .5, 0); put(g, box(12, 8, 6, '#e8c860'), 0, 5, 0);
    put(g, box(12.4, .5, 6.4, '#d8b84e'), 0, 9.25, 0); /* central cornice */
    { const gab = put(g, cyl(3, 3, 4, 3, '#e8c860'), 0, 9.5, 0); gab.rotation.x = -Math.PI / 2; gab.scale.z = .3; } /* low central gable between the towers, apex ~12.5 */
    for (const x of [-6, 6]) { put(g, box(3.6, 14, 4, '#e0b84e'), x, 8, 0); put(g, box(4, .6, 4.4, '#c8a040'), x, 15.3, 0); put(g, cone(1.9, 3.0, 4, '#8a6a3a'), x, 16.8, 0).rotation.y = Math.PI / 4;
      for (const s of [-1, 1]) { put(g, box(1.6, 1.8, .12, '#4a3a22'), x, 13.2, s * 2.06).castShadow = false; put(g, box(.12, 1.8, 1.6, '#4a3a22'), x + s * 1.86, 13.2, 0).castShadow = false; } } /* open-belfry insets, all four tower faces */
    put(g, box(2.2, 4.6, .4, '#8a5a30'), 0, 3.3, 3.06).castShadow = false; for (const x of [-2.9, 2.9]) put(g, box(1.5, 3.2, .4, '#7a4a28'), x, 2.6, 3.06).castShadow = false; /* three main-facade door insets, centre larger */
    for (const x of [-3.6, 3.6]) put(g, box(2, 1.4, 1.2, '#7a4a28'), x, 6, 3.3).castShadow = false; /* balcony boxes */
    return 9.5; },
  pombal(g) { // Marquis of Pombal Square monument-inspired, stylised (not surveyed), sourced key features (https://en.wikipedia.org/wiki/Marquis_of_Pombal_Square): the column monument was built 1917-1934 (Adaes Bermudes, Antonio Couto, Francisco Santos); a bronze statue of the Marquess stands on top with a lion - symbol of power - BY HIS SIDE (pt.wiki: his arm rests on the lion's back); the lower base is surrounded by allegorical figures (the female "re-built Lisbon" figure and three sculptural groups for the reforms, looking towards the Baixa he rebuilt after the 1755 earthquake); four medallions on the upper pedestal figure his collaborators. Rebuild: statue and lion move to the capital platform at the column top in bronze (the old build placed the lion mid-shaft, which the sources contradict); four abstract allegorical figures stand on the top step; one medallion block per pedestal face. Natural top ~18.0 under the lisbon:20 cap, no squash (the old 21.0 build squashed to .952); the return literal is the old squashed disc captured live from the running game so the effective collider disc is byte-identical. The statue's gaze direction toward the Baixa is not reproduced; medallion portraits and figure grouping are stylised away.
    put(g, cyl(8.57, 9.14, .8, 20, '#d4cbb2'), 0, .4, 0); put(g, box(9, 1.6, 9, '#cfc6ac'), 0, 1.6, 0); put(g, box(7, 1.6, 7, '#d8cfb6'), 0, 3.2, 0); put(g, box(5, 5, 5, '#e0d8c0'), 0, 6.5, 0);
    for (const [fx, fz] of [[-2.9, 0], [2.9, 0], [0, -2.9], [0, 2.9]]) { put(g, cyl(.3, .42, 1.3, 6, '#c8bfa4'), fx, 4.65, fz); put(g, sph(.22, '#c8bfa4'), fx, 5.42, fz); } /* allegorical figures round the base, stylised as robed cylinders + heads */
    for (const a of [0, 1.57, 3.14, 4.71]) { const md = put(g, box(.7, .7, .1, '#c8bfa4'), Math.sin(a) * 2.53, 8.2, Math.cos(a) * 2.53); md.rotation.y = a; md.castShadow = false; } /* collaborator medallion blocks, one per pedestal face */
    put(g, box(2.2, 6, 2.2, '#e8e0c8'), 0, 12, 0); /* column shaft */
    put(g, box(3.6, .5, 2.8, '#e0d8c0'), 0, 15.25, 0); /* capital platform (wide enough for the statue and the lion side by side) */
    const BZ = '#5f4a2e';
    put(g, box(.5, 1, .45, BZ), -.5, 16, 0); put(g, box(.75, 1, .5, BZ), -.5, 17, 0); put(g, sph(.24, BZ), -.5, 17.74, 0); /* the Marquess */
    put(g, box(1.2, .14, .14, BZ), .3, 16.44, 0); /* his arm resting toward the lion's back */
    for (const lx of [.65, 1.2]) for (const lz of [-.19, .19]) put(g, box(.16, .55, .16, BZ), lx, 15.775, lz); /* four grounded legs */
    put(g, box(.95, .42, .55, BZ), .95, 16.18, 0); /* lion body */
    put(g, sph(.34, BZ), 1.35, 16.43, 0); put(g, box(.32, .2, .26, BZ), 1.68, 16.43, 0); /* mane and projecting muzzle */
    for (const lz of [-.17, .17]) put(g, sph(.09, BZ), 1.4, 16.72, lz); /* ears */
    const tail = put(g, cyl(.055, .055, .65, 5, BZ), .38, 16.23, 0); tail.rotation.z = -.55; /* tail at the haunch */
    return 9.523809526512682; }, // old effective disc captured live pre-rebuild (probe of the running game); natural top 17.98 < 20 so no squash re-scales it
  belem(g) { // Belem Tower-inspired, stylised (not surveyed): a square limestone bastion tower on a low riverside platform, four corner turrets with domed caps, crenellated terrace, a loggia and a rope-moulded cornice.
    put(g, box(22, 1.2, 16, '#d8cfb4'), 0, .6, 0); put(g, box(14, 4, 11, '#e6dcc0'), 0, 3.2, 0); put(g, box(8, 9, 8, '#eadfc4'), 0, 9, 1);
    for (const [x, z] of [[-4.6, -3.8], [4.6, -3.8], [-4.6, 5.6], [4.6, 5.6]]) { put(g, cyl(1.1, 1.2, 4, 10, '#e0d4b4'), x, 6, z); put(g, cone(1.4, 2, 10, '#b8c4b8'), x, 9, z); }
    for (let k = -3; k <= 3; k++) put(g, box(.9, .9, .9, '#e6dcc0'), k * 1.1, 13.9, 5.2).castShadow = false;
    put(g, box(5.4, 2.4, .6, '#2a2a30'), 0, 8, 5.2).castShadow = false; put(g, box(8.4, .5, 8.4, '#d4c8a8'), 0, 13.5, 1); put(g, cone(1.9, 3.2, 10, '#b8c4b8'), 0, 15.6, 1);
    return 11.5; },
  westerkerk(g) { // Westerkerk-inspired, stylised (not surveyed), sourced key features (https://en.wikipedia.org/wiki/Westerkerk): built 1620-1631 in Renaissance style (Hendrick de Keyser); the Westertoren is the highest church tower in Amsterdam at 87 m; the crown topping the spire is the Imperial Crown of Austria of Maximilian I, painted in its original BLUE colour in 2006; carillon above the clock faces. Update-103 rebuild: the old build ran to natural 27.4 and squashed .73 under the amsterdam:20 cap, shrinking the whole church and leaving the rendered base corners ~.9 OUTSIDE the effective disc; and its crown was gilded (the sourced present-day colour is blue). Rebuilt at natural ~19.9 (no squash): brick tower + pale clock stage with clock faces on all four sides, blue-grey octagonal spire, and a BLUE imperial-crown top with gold arches + orb. Footprint now fits inside the disc (base corner 7.5 < 7.66). Return is the old squashed disc captured live pre-edit - effective collider disc byte-identical. Carillon chamber and the tower's paired sound holes stylised away; clocks are plain discs.
    const BLUE = '#2f4fd0', GOLD = { metalness: .4, roughness: .35 };
    put(g, box(13, 1, 7.5, '#cfc4ac'), 0, .5, 0); put(g, box(10, 5, 6.5, '#a8502e'), 0, 3.5, 1.2);
    put(g, box(5, 11, 5, '#b4583a'), 0, 6.5, -2); put(g, box(4.4, 3.4, 4.4, '#c8b8a0'), 0, 13.7, -2); put(g, box(4.8, .5, 4.8, '#d8d0b8'), 0, 15.65, -2);
    { const cg = new THREE.CylinderGeometry(.85, .85, .12, 14); cg.rotateX(Math.PI / 2); const cmat = M('#f0ead0'); /* disc geometry pre-rotated: composing rotation.x then .y left the +-x faces edge-on (107d, main 9:49) */
      for (const a of [0, 1.57, 3.14, 4.71]) { const ck = put(g, new THREE.Mesh(cg, cmat), Math.sin(a) * 2.26, 14.3, -2 + Math.cos(a) * 2.26); ck.rotation.y = a; ck.castShadow = false; } } /* clock faces, four sides */
    for (const a of [0, 1.57, 3.14, 4.71]) { // Update 107b: hands on all four faces (was blank discs, main 9:14 recorded limit) - dark hands proud of the cream face
      const hx = Math.sin(a), hz = Math.cos(a);
      const h1 = put(g, box(.09, .62, .06, '#2a2a30'), hx * 2.38, 14.52, -2 + hz * 2.38); h1.rotation.y = a; h1.castShadow = false; /* minute hand up; .065 proud of the disc face (107d: .025 was near-flush and vanished edge-on, main 9:49) */
      const h2 = put(g, box(.09, .44, .06, '#2a2a30'), hx * 2.38 + hz * .14, 14.28, -2 + hz * 2.38 - hx * .14); h2.rotation.y = a; h2.rotation.z = -2.1; h2.castShadow = false; /* hour hand ~4 o'clock */ }
    put(g, cyl(1.6, 1.9, 1.8, 8, '#3a5a68'), 0, 16.8, -2); put(g, cone(1.7, 1.6, 8, '#2f4a58'), 0, 18.4, -2);
    put(g, cyl(.9, 1, .4, 8, BLUE, { metalness: .3, roughness: .4 }), 0, 19.4, -2); /* the blue imperial crown band */
    for (const a of [0, Math.PI / 2]) { const arch = put(g, new THREE.Mesh(new THREE.TorusGeometry(.3, .06, 6, 12, Math.PI), M('#e8c050', GOLD)), 0, 19.58, -2); arch.rotation.y = a; arch.castShadow = false; } /* gold crown arches: two crossed half-tori so the arches read from every side (was two flat crossing bars, not clearly readable - main 9:14) */
    put(g, sph(.1, '#e8c050', GOLD), 0, 19.86, -2); /* orb at the arch crossing; crown top ~19.96 stays under the amsterdam:20 cap, no squash */
    return 7.664233573307855; }, // old effective disc captured live pre-rebuild; natural top ~19.93 < 20 so no squash re-scales it
  monserrate(g) { // Monserrate-inspired, stylised (not surveyed): a rounded green ridge above the city with a small white hilltop church - nave, gable roof, slim bell tower and cross; low-poly trees on the flanks.
    put(g, cone(15, 11, 28, '#3f8a46'), 0, 5.5, 0);
    for (const [tx2, tz2, ty] of [[-6.5, 2, 6.2], [5.5, 4.5, 6.8], [1, -6, 6.6], [-3.5, -4.5, 7.6]]) put(g, cone(1.5, 2.8, 8, '#2f6a36'), tx2, ty + 1.4, tz2);
    put(g, cyl(3.4, 4.4, 2.6, 16, '#3f8a46'), 0, 10.3, 0); /* shoulder: the cone apex is a point, so the church sits on this flat-topped knoll, no sky gap */
    put(g, box(3.6, 2.8, 2.8, '#f4f0e6'), 0, 13, 0); put(g, cone(2.3, 1.6, 4, '#c95a3a'), 0, 15.2, 0).rotation.y = Math.PI / 4;
    put(g, box(1.2, 3.6, 1.2, '#f4f0e6'), 2.4, 13.4, 0); put(g, cone(1, 1.2, 4, '#c95a3a'), 2.4, 15.8, 0).rotation.y = Math.PI / 4;
    put(g, box(.14, 1, .14, '#f4f0e6'), 2.4, 16.9, 0); put(g, box(.56, .14, .14, '#f4f0e6'), 2.4, 17.05, 0);
    return 15; },
  plazacathedral(g) { // Primatial-Cathedral-inspired, stylised (not surveyed): broad neoclassical nave on the plaza, six-column portico with pediment, tiered bell tower with cross. Update 123 anchored-district landmark (Bogota - La Candelaria); the real cathedral stands ON Plaza de Bolivar, so the plaza pad is its honest home.
    put(g, box(14, 6, 9, '#ddd2b8'), 0, 3.7, 0);
    put(g, box(14.5, .6, 9.5, '#c9bfa2'), 0, 6.9, 0);
    for (let k = 0; k < 6; k++) put(g, cyl(.45, .5, 5, 8, '#ece4ce'), -5 + k * 2, 3.2, 5);
    put(g, box(13.4, .8, 1.6, '#c9bfa2'), 0, 6, 5);
    put(g, cone(3.2, 2.6, 4, '#c9bfa2'), 0, 7.7, 5).rotation.y = Math.PI / 4;
    put(g, box(3, 8.5, 3, '#ddd2b8'), -6, 5, 1);
    put(g, box(3.4, 1.2, 3.4, '#c9bfa2'), -6, 9.8, 1);
    put(g, cone(2, 2.4, 8, '#8a5a3a'), -6, 11.6, 1);
    put(g, box(.16, 1.2, .16, '#f4f0e6'), -6, 13.4, 1); put(g, box(.64, .16, .16, '#f4f0e6'), -6, 13.6, 1);
    return 10; },
  marinacathedral(g) { // Cathedral-Church-of-Christ-inspired, stylised (not surveyed): pale nave with pitched roof mass, four-column west porch, square tower with pyramid cap and corner pinnacles. Update 124 anchored-district landmark (Lagos - Lagos Island); the cathedral stands on the Marina. Update 132 (Main 11:10: correct model footprints where grounded rather than bending routes around oversized masses): footprint RESHAPED to the sourced OSM way 669975482 polygon (Nominatim 2026-10-29, ODbL ledgered) - real bbox ~2.9x2.8u (~49x48m) centred on our anchor; the old 13x9u nave was ~4.5x oversized and forced the 131 Broad-Street dogleg. New nave 6x4.5u (still ~2x real bulk, recorded schematic-presence compromise); heights kept for landmark presence; collider 10 -> 5.
    put(g, box(6, 5.5, 4.5, '#ece2c8'), 0, 3.4, 0);
    put(g, cone(2.4, 2.8, 4, '#7a6a52'), 0, 7.6, 0).rotation.y = Math.PI / 4;
    for (let k = 0; k < 4; k++) put(g, cyl(.35, .4, 3.6, 8, '#f4ecd4'), -2.1 + k * 1.4, 2.4, 3);
    put(g, box(5.6, .6, .9, '#d8cba6'), 0, 4.5, 3);
    put(g, box(2, 10.5, 2, '#ece2c8'), 0, 6, -0.5);
    put(g, box(2.2, .9, 2.2, '#d8cba6'), 0, 11.4, -0.5);
    put(g, cone(1.4, 2.6, 4, '#7a6a52'), 0, 13.2, -0.5).rotation.y = Math.PI / 4;
    for (const [px, pz] of [[-0.95, -1.45], [0.95, -1.45], [-0.95, 0.45], [0.95, 0.45]]) put(g, cone(.4, 1.2, 4, '#d8cba6'), px, 12.4, pz).rotation.y = Math.PI / 4;
    /* facade detail (127, rescaled 132): windows, door, rose, belfry slots, cross finial, buttresses - render-only */
    for (const sg of [-1, 1]) for (const wx of [-2.0, -0.7, 0.7, 2.0]) { put(g, box(.7, 2.2, .14, '#3a3230'), wx, 3.2, sg * 2.31); put(g, box(.9, .3, .16, '#d8cba6'), wx, 4.5, sg * 2.31); }
    for (const sg of [-1, 1]) for (const wz of [-1.2, 0.8]) { put(g, box(.14, 2.2, .7, '#3a3230'), sg * 3.06, 3.2, wz); put(g, box(.16, .3, .9, '#d8cba6'), sg * 3.06, 4.5, wz); }
    put(g, box(1.1, 2.6, .16, '#3a3230'), 0, 1.9, 2.31); /* west door between the porch columns */
    { const rose = put(g, cyl(.6, .6, .14, 12, '#e8c766'), 0, 4.1, 2.31); rose.rotation.x = Math.PI / 2; } /* rose window over the door */
    for (const sg of [-1, 1]) put(g, box(.45, 1.5, .1, '#3a3230'), 0, 8.6, -0.5 + sg * 1.06); /* tower belfry slots, front+back */
    for (const sg of [-1, 1]) put(g, box(.1, 1.5, .45, '#3a3230'), sg * 1.06, 8.6, -0.5); /* tower belfry slots, sides */
    put(g, box(.12, 1.3, .12, '#e8c766'), 0, 14.6, -0.5); put(g, box(.72, .12, .12, '#e8c766'), 0, 14.75, -0.5); /* cross finial on the tower cap */
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, box(.5, 3.8, .5, '#e0d4b8'), sx * 2.9, 2.5, sz * 2.15); /* corner buttresses */
    return 5; },
  skytower(g) { // Sky-Tower-inspired, stylised (not surveyed): slim tapering concrete needle, wide lookout ring with a blue glass band near the top, antenna mast.
    put(g, cyl(2.2, 3, 2.4, 12, '#c8c4b8'), 0, 1.2, 0);
    put(g, cyl(1, 1.7, 13.4, 12, '#d4d0c4'), 0, 7.9, 0);
    put(g, cyl(1.7, 1.05, 1.7, 12, '#d4d0c4'), 0, 15.5, 0); /* flared collar under the deck */
    put(g, cyl(4, 4, .9, 16, '#e4e0d4'), 0, 16.8, 0);
    put(g, cyl(3.5, 3.5, 1, 16, '#6ab0d8'), 0, 17.75, 0); /* glass lookout band */
    put(g, cyl(4, 4, .5, 16, '#e4e0d4'), 0, 18.45, 0);
    put(g, cyl(1.1, 1.4, .9, 12, '#d4d0c4'), 0, 19.15, 0);
    put(g, cyl(.08, .22, 1.4, 6, '#8a8f94'), 0, 20.3, 0); /* antenna mast */
    return 3.2; },
  lagoslight(g) { // Tarkwa-Bay-(Beecroft-Point)-Lighthouse-inspired, stylised (not surveyed), sourced key features: 1891 (station established 1877), 27 m stone tower with lantern and gallery, focal plane 26 m, two white flashes every 15 s, about 1.5 km northwest of the western entrance to Lagos Harbour (https://ibiblio.org/lighthouse/ngr.htm Rowlett Lighthouse Directory; https://en.wikipedia.org/wiki/List_of_lighthouses_in_Nigeria). Daymark per Rowlett citing 2024 photos, "white with two black horizontal bands... the present daymark seems to be of long standing"; Chance Heritage Trust's "black round tower, white band" record conflicts - the white/two-black-bands daymark is built, the conflict is noted not resolved. The tower stands at the city plaza as the landmark; the real harbour-entrance axis is not reproduced.
    put(g, cyl(3.2, 3.8, 1.4, 8, '#d8d0b8'), 0, .7, 0);
    put(g, cyl(1.5, 2.2, 11, 12, '#f0ead8'), 0, 6.9, 0);
    put(g, cyl(2.05, 2.15, 1.6, 12, '#2a2a30'), 0, 4.6, 0); /* lower black band - must exceed the tapering shaft radius (2.05-1.95) across its span or it hides inside */
    put(g, cyl(1.78, 1.87, 1.6, 12, '#2a2a30'), 0, 9, 0); /* upper black band - shaft is 1.77-1.67 here */
    put(g, cyl(2.1, 2.1, .5, 12, '#8a8f94'), 0, 12.65, 0); /* gallery deck */
    put(g, cyl(1.1, 1.1, 1.5, 10, '#ffe9a8', { emissive: '#ffd23f', emissiveIntensity: .35 }), 0, 13.65, 0); /* lamp room */
    put(g, cyl(1.3, 1.3, .3, 10, '#c03028'), 0, 14.55, 0);
    put(g, sph(1.05, '#c03028'), 0, 15, 0); /* domed cap */
    return 4; },
  petronas(g) { // Petronas-Towers-inspired, stylized silhouette not surveyed, sourced key figures (https://en.wikipedia.org/wiki/Petronas_Towers): twin 88-storey towers, architectural height 451.9 m, double-deck skybridge between the 41st and 42nd floors at 170 m (0.376H), 58.4 m long (https://www.guinnessworldrecords.com/world-records/113245-highest-sky-bridge); postmodern Islamic design by Cesar Pelli. Composition kept: identical tapering tiered shafts with ring bands, double-deck bridge at the sourced height ratio with V struts below, ball-and-spire pinnacles; the rub-el-hizb star plan and facade mullions are stylized away (noted, not claimed). Natural H ~19.7 under the raised kualalumpur:20 cap (dubai/toronto/tokyo precedent: the towers' identity IS their height).
    const tw = (sx) => { // one tower, mirrored at sx
      put(g, cyl(1.75, 1.9, 1.1, 16, '#b8c8cc', { metalness: .2, roughness: .5 }), sx * 2.92, .55, 0); // podium ring
      put(g, cyl(1.5, 1.65, 5.2, 16, '#ccd8da', { metalness: .2, roughness: .5 }), sx * 2.92, 3.7, 0); // lower shaft
      put(g, cyl(1.68, 1.68, .4, 16, '#93aab2'), sx * 2.92, 6.5, 0); // setback ring
      put(g, cyl(1.28, 1.45, 4.4, 16, '#ccd8da', { metalness: .2, roughness: .5 }), sx * 2.92, 8.9, 0); // mid shaft
      put(g, cyl(1.46, 1.46, .35, 16, '#93aab2'), sx * 2.92, 11.3, 0); // setback ring
      put(g, cyl(1.02, 1.22, 3.9, 16, '#d4dee0', { metalness: .2, roughness: .5 }), sx * 2.92, 13.4, 0); // upper shaft
      put(g, cyl(1.18, 1.18, .3, 16, '#93aab2'), sx * 2.92, 15.5, 0); // setback ring
      put(g, cyl(.5, .95, 1.5, 12, '#d4dee0', { metalness: .2, roughness: .5 }), sx * 2.92, 16.4, 0); // crown
      put(g, sph(.48, '#e8ecec', { metalness: .3, roughness: .35 }), sx * 2.92, 17.35, 0); // ball
      put(g, cyl(.05, .16, 2.3, 6, '#c8d4d6', { metalness: .3, roughness: .4 }), sx * 2.92, 18.6, 0); // spire, tip ~19.75
    };
    tw(1); tw(-1);
    // double-deck skybridge at 0.376H (sourced 170 m of 451.9 m): two decks with a gap between
    put(g, box(6.9, .3, 1.05, '#c4d2d6', { metalness: .2, roughness: .5 }), 0, 7.25, 0);
    put(g, box(6.9, .3, 1.05, '#c4d2d6', { metalness: .2, roughness: .5 }), 0, 8.05, 0);
    for (const sx of [-1, 1]) { const st = put(g, box(.28, 1.6, .28, '#93aab2'), sx * 1.1, 6.3, 0); st.rotation.z = sx * .5; } // V struts under the bridge
    return 5; }, // disc covers tower centres +-2.92 + base radius 1.9 at any scale
  cityhall(g) { // Stockholm-city-hall-tower-inspired, stylised (not surveyed), sourced key features (https://en.wikipedia.org/wiki/Stockholm_City_Hall): completed 1923 (Ragnar Ostberg), ~8 million dark red "munktegel" bricks; the 106 m southeast-corner tower is topped with the Three Crowns (tre kronor, the Swedish national symbol); lantern added during construction; 365-step stair. Rebuilt crown: the old single crown BALL is replaced by three gilded crowns in the tre-kronor arrangement (two above, one below) on a small gilt mount. Belfry gains arched opening insets on all four faces. Natural top ~20.8 under the stockholm:21 cap; return unchanged. Balconies, turret starlets, the Birger Jarl cenotaph and the Blue Hall are stylised away (noted, not claimed).
    put(g, box(5, 10.8, 5, '#a85838'), 0, 5.3, 0); /* base embedded .1 under the walk surface (local 0 = world .7): the old shaft bottomed at local .7 and floated ~.7 above the ground (found in the 98 base view). -.1 bottom keeps bbox hgt 20.87 under the 21 cap */
    put(g, box(5.6, .8, 5.6, '#8a4828'), 0, 10.9, 0); /* corbel band */
    put(g, box(4.4, 3.4, 4.4, '#b86848'), 0, 13, 0); /* belfry */
    for (const s of [-1, 1]) for (const d of [-.8, .8]) { put(g, box(.7, 2.2, .12, '#5a2a1a'), d, 13, s * 2.21).castShadow = false; put(g, box(.12, 2.2, .7, '#5a2a1a'), s * 2.21, 13, d).castShadow = false; } /* belfry arched openings, stylised as plain insets */
    put(g, cyl(2.4, 2.9, 2, 8, '#4a8a6a'), 0, 15.7, 0); /* copper lantern */
    put(g, cone(1.3, 2.6, 8, '#4a8a6a'), 0, 18, 0); /* spire */
    const GOLD = { metalness: .4, roughness: .35 };
    put(g, cyl(.05, .05, 1.1, 5, '#e8c050', GOLD), 0, 19.85, 0); /* mount rod from the spire tip up through the lower crown */
    put(g, box(1.05, .06, .06, '#e8c050', GOLD), 0, 20.44, 0); /* mount bar for the upper pair */
    const crown = (cx, cy) => { put(g, cyl(.18, .18, .12, 8, '#e8c050', GOLD), cx, cy, 0); for (const a of [0, 1.57, 3.14, 4.71]) put(g, cone(.055, .2, 4, '#e8c050', GOLD), cx + Math.sin(a) * .13, cy + .16, Math.cos(a) * .13); }; /* one crown: band + 4 points */
    crown(0, 20.06); crown(-.45, 20.51); crown(.45, 20.51); /* tre kronor: one below, two above; ball removed (it merged with the lower crown in the 97 closeup) */
    return 3.6; }, // disc unchanged (3.6 covers the 2.5 half-width shaft); no squash (top ~20.66 < 21), no stream shift
  stupa(g) { // Wat-Arun-inspired (Bangkok Yai district, Thonburi west bank of the Chao Phraya - matches the sourced (0,-26) west-bank anchor), stylised (not surveyed), fact-level key features (Wikipedia, 'Wat Arun': central prang built under Rama II/III - 61.2 m over the original 16 m prang, variously reported 66.8-86 m incl. finial; four smaller satellite prangs at the corners; brick core plastered and encrusted with colourful Chinese porcelain shards + Mauritia shells). Replaces the prior Shwedagon (Yangon, Myanmar) stand-in: Bangkok's central landmark was the wrong country's monument. Two-step terrace + tapering 8-seg prang frusta with alternating porcelain-band accents + trident-crown finial; effective collider disc kept numerically identical to the pre-rebuild build (return = old-lr 14.5 * old-scale 19/33.5).
    const pl = '#efe9da', b1 = '#d2603a', b2 = '#4a8a5a', trim = '#c8c0ae';
    put(g, box(11.3, .8, 11.3, '#e8e2d2'), 0, .4, 0); put(g, box(9.4, .8, 9.4, '#ddd6c4'), 0, 1.2, 0); // two-step terrace (old 20x20 platform at the 19/33.5 cap scale = 11.3 across)
    const tiers = [[3.9, 3.3, 2.2, pl], [3.45, 3.45, .5, b1], [3.3, 2.8, 2, pl], [2.9, 2.9, .5, b2], [2.7, 2.25, 2, pl], [2.35, 2.35, .5, b1], [2.15, 1.7, 1.9, pl], [1.75, 1.75, .45, b2], [1.6, 1.25, 1.6, pl]];
    let ty = 1.6; for (const [rb, rt, h, c] of tiers) { put(g, cyl(rt, rb, h, 8, c), 0, ty + h / 2, 0); ty += h; }
    put(g, cone(1.2, 1.2, 8, pl), 0, ty + .6, 0); put(g, cone(.85, 1.1, 8, b1), 0, ty + 1.2, 0); put(g, cone(.55, 1, 8, pl), 0, ty + 1.6, 0); // crown cones (nophasun stylised) - each base rim sunk into the slope below (157 fix: apex-to-base point contacts read as floating pieces with sky gaps)
    put(g, cyl(.09, .16, 2.2, 6, trim), 0, ty + 3.0, 0); put(g, cone(.16, .5, 6, '#e8b923', { metalness: .4, roughness: .35 }), 0, ty + 4.15, 0); // trident rod embedded in cone3 + gilded tip over the rod top (H ~17.7 < cap 19)
    for (const [x, z] of [[-5.2, -5.2], [5.2, -5.2], [-5.2, 5.2], [5.2, 5.2]]) { // four satellite prangs (sourced: corners)
      put(g, cyl(1.25, 1.5, 1.2, 8, pl), x, 2.2, z); put(g, cyl(1.3, 1.3, .35, 8, b2), x, 2.98, z); put(g, cyl(.85, 1.15, 1.1, 8, pl), x, 3.7, z);
      put(g, cone(.8, .9, 8, b1), x, 4.5, z); put(g, cone(.5, .8, 8, pl), x, 5.15, z); put(g, cyl(.06, .1, 1.1, 5, trim), x, 5.85, z); // same embedded-stack fix (157)
    }
    return 14.5 * 19 / 33.5; },
  harbour(g) {
    // Victoria-Harbour-inspired, grounded in harbour reference photos (Wikimedia Commons): a round kerbed
    // harbour basin (water recessed below a stone rim) with a Star-Ferry-inspired green-and-white ferry,
    // the zigzag-braced Bank-of-China-inspired tower and a slim tapered IFC2-inspired tower rising from the
    // water behind, plus a small Tsim-Sha-Tsui-style clock tower on the rim. Recognition by composition and
    // silhouette: the anchor towers now use the full 13 cap (BOC mast tips 12.4, IFC2 11.7) and a
    // harbour-promenade height falloff (in the building loop) clears near-field towers so the composition
    // reads from the approach. Physical honesty: the
    // whole build sits inside r 3.95 of the landmark center, inside the player's 4.2 stop ring (collider
    // 3.75 + body .45), so nobody can step into the water or clip a tower - you walk up to the rim and
    // stop. Natural height <= 13 avoids the old cap-squash; return 3.75 keeps the effective collider disc
    // identical to r116.
    const rim = '#bcbcb4', water = '#2f6f9f';
    put(g, cyl(3.95, 3.95, .45, 24, rim), 0, .225, 0);
    put(g, cyl(3.5, 3.5, .7, 24, '#d8d4c8'), 0, .8, 0);
    put(g, cyl(3.05, 3.05, .14, 24, water, { roughness: .2, metalness: .1, emissive: '#1b4f7c', emissiveIntensity: .2 }), 0, .86, 0).castShadow = false;
    const fg = new THREE.Group();
    put(fg, box(2.3, .45, .95, '#f2f2ea'), 0, .22, 0);
    put(fg, box(2.35, .18, 1.0, '#2f8f5a', { emissive: '#2f8f5a', emissiveIntensity: .15 }), 0, .53, 0);
    put(fg, box(1.7, .42, .8, '#f2f2ea'), 0, .83, 0);
    for (let i = -1; i <= 1; i++) put(fg, box(.1, .42, .1, '#d8d8ce'), i * .7, .83, .32);
    put(fg, box(1.35, .3, .65, '#e8e8da'), 0, 1.19, 0);
    put(fg, cyl(.1, .12, .45, 8, '#2a2a2a'), .3, 1.5, 0);
    fg.position.set(-.9, .93, .95);
    fg.rotation.y = .5;
    g.add(fg);
    const glass = { metalness: .3, roughness: .4 };
    const braceE = { emissive: '#dfe8f0', emissiveIntensity: .3 };
    put(g, box(1.7, 9.4, 1.7, '#6f8499', glass), 1.1, 5.5, -2.0);
    put(g, box(1.3, 1.8, 1.3, '#8298ab', glass), 1.1, 10.9, -2.0);
    for (const k of [2.9, 5.9, 8.9]) put(g, box(1.75, .18, 1.75, '#a8b8c4', braceE), 1.1, k, -2.0).castShadow = false;
    for (const face of [0, 1.57, 3.14, 4.71]) {
      for (const [cy, s2] of [[4.2, 1], [7.6, -1]]) {
        const d1 = put(g, box(.16, 2.6, .12, '#e8ecf0', braceE), 1.1 + Math.sin(face) * .88, cy, -2.0 + Math.cos(face) * .88);
        d1.rotation.y = face;
        d1.rotation.z = s2 * .5;
        const d2 = put(g, box(.16, 2.6, .12, '#e8ecf0', braceE), 1.1 + Math.sin(face) * .88, cy, -2.0 + Math.cos(face) * .88);
        d2.rotation.y = face;
        d2.rotation.z = -s2 * .5;
      }
    }
    for (const mx of [.85, 1.35]) put(g, cyl(.05, .05, .8, 5, '#c8ccd0'), mx, 12.0, -2.0);
    put(g, cyl(.5, .72, 10.4, 10, '#9fc4d8', { metalness: .35, roughness: .35 }), -1.9, 6.0, -1.8);
    put(g, cyl(.45, .5, .5, 10, '#b8d4e4'), -1.9, 11.45, -1.8);
    put(g, box(.9, 3.4, .9, '#d8cbb0'), -3.0, 2.85, .4);
    put(g, box(1.05, .25, 1.05, '#c4b696'), -3.0, 4.68, .4);
    put(g, cyl(.34, .34, .12, 12, '#fff6dc', { emissive: '#fff0c0', emissiveIntensity: .4 }), -3.0, 4.1, .86).rotation.x = 1.57;
    put(g, cone(.7, .8, 4, '#6a5a44'), -3.0, 5.15, .4).rotation.y = .78;
    return 3.75;
  },
  hillsign(g) { // Hollywood-sign-inspired: nine white letters following the city-facing hillside curve (earlier builds floated above the apex and read as 'LH', then a two-letter 'LA' whose tilted A read as 'Y' from the walk)
    // Hill recomposed r18 at z=-12 (was r22 at z=-10): the front toe now ends at z=+6, 2u inside the r8 collider disc, so the stamp pose and the frontal walk arc stand fully clear of the slope (the old cone reached z=+12 and buried the stamping avatar chest-deep). Footprint is a strict subset of the old one (x +/-18<22, z -30..6 within -32..12), so no new terrain/road contact; apex stays 12 (cap 13, no squash); slope angle steepens to 33.7 deg and the letters' tilt follows it.
    put(g, cone(18, 12, 10, '#a8a07a'), 0, 6, -12);
    const W = '#f4f4f4', eW = { emissive: '#ffffff', emissiveIntensity: .25 };
    const HH = 2.8, TILT = .588, cT = Math.cos(TILT), sT = Math.sin(TILT), Z0 = -3; // letters lie back on the slope (tilt = cone slope angle atan(12/18))
    const surf = x => 12 * (1 - Math.hypot(x, Z0 + 12) / 18); // cone surface height at letter bottom edge (x, Z0); cone axis at z=-12
    const seg = (x, y, z, w, h, rz) => { const m = put(g, box(w, h, .55, W, eW), x, y, z); m.rotation.x = -TILT; if (rz) m.rotation.z = rz; return m; };
    const LET = (xi, parts) => { const yb = surf(xi) - .3; // base embeds .3 into the slope so no letter floats
      for (const [lx, ly, w, h, rz] of parts) seg(xi + lx, yb + ly * cT, Z0 + ly * sT, w, h, rz); };
    const v = (lx, h) => [lx, h / 2, .55, h]; // vertical stroke centered lx, base y0
    // H O L L Y W O O D - nine white letters on the hillside since 1923; 14u span fits a portrait-mobile follow-cam frame on the normal walk
    LET(-7,    [v(-.35, HH), v(.35, HH), [0, 1.4, .75, .55]]);                                                      // H
    LET(-5.25, [v(-.35, HH), v(.35, HH), [0, 2.525, .75, .55], [0, .275, .75, .55]]);                               // O
    LET(-3.5,  [v(-.35, HH), [0, .275, 1.25, .55]]);                                                                // L
    LET(-1.75, [v(-.35, HH), [0, .275, 1.25, .55]]);                                                                // L
    LET(0,     [[0, .8, .55, 1.6], [-.5, 2.41, .55, 1.9, .55], [.5, 2.41, .55, 1.9, -.55]]);                      // Y: stem 0..1.6, arms fork UP-OUT from its top (rz>0 leans a top toward -x)
    LET(1.75,  [[-.6, 1.4, .55, 2.83, .142], [-.2, 1.4, .55, 2.83, -.142], [.2, 1.4, .55, 2.83, .142], [.6, 1.4, .55, 2.83, -.142]]); // W: 4 strokes, tops at +/-.8/.0 bottoms at +/-.4/.0 (rz sign: top toward -x is +)
    LET(3.5,   [v(-.35, HH), v(.35, HH), [0, 2.525, .75, .55], [0, .275, .75, .55]]);                               // O
    LET(5.25,  [v(-.35, HH), v(.35, HH), [0, 2.525, .75, .55], [0, .275, .75, .55]]);                               // O
    LET(7,     [v(-.35, HH), [.38, 1.4, .55, 2.3], [.05, 2.525, .95, .55], [.05, .275, .95, .55]]);                 // D
    for (const [x, z] of [[-14, 6], [14, 6], [-10, 12], [10, 12]]) { put(g, cyl(.35, .5, 11, 6, '#8a6a3a'), x, 5.5, z); put(g, sph(2.2, '#4a9a3a'), x, 11.5, z).scale.y = .6; } return 8; },
  steppyramid(g) {
    // Templo-Mayor-inspired, grounded in excavation reference photos (Wikimedia Commons): stepped limestone
    // pyramid with TWIN frontal staircases climbing to twin shrines (blue Tlaloc side, red Huitzilopochtli
    // side), serpent-head blocks at the stair bases. Warm lifted stone fixes the old dark mud-mass read.
    // Natural height <= 13 avoids the old cap-squash (13/16.4); the return value keeps the effective
    // collider disc identical to the squashed 14.
    const stone = '#cbb287', stone2 = '#c0a97b', dark = '#8a744e';
    const eS = { emissive: stone, emissiveIntensity: .22 }, e2 = { emissive: stone2, emissiveIntensity: .22 };
    put(g, box(27, .5, 27, stone2, e2), 0, .25, 0);
    const tiers = [[24, stone, eS], [19, stone2, e2], [14, stone, eS], [9, stone2, e2]];
    let y = .5;
    for (const [w, c, e] of tiers) { put(g, box(w, 1.9, w, c, e), 0, y + .95, 0); y += 1.9; }
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 10; k++) {
        const t = k / 9;
        put(g, box(2.0, .38, 1.6, '#d8c8a0', { emissive: '#d8c8a0', emissiveIntensity: .2 }), sx * 1.75, .7 + t * 7.2, 12.2 - t * 10.4);
      }
      put(g, box(.7, .7, 1.1, dark), sx * 1.75, .85, 13.0);
      put(g, cone(.45, .8, 6, dark), sx * 1.75, 1.6, 13.0);
    }
    put(g, box(10, .5, 10, stone, eS), 0, y + .25, 0);
    for (const sx of [-1, 1]) {
      const roof = sx < 0 ? '#3a6ea8' : '#a03434';
      const eR = { emissive: roof, emissiveIntensity: .25 };
      put(g, box(3.4, 2.2, 3.4, stone, eS), sx * 2.4, y + 1.6, 0);
      put(g, box(1.1, 1.5, .2, dark), sx * 2.4, y + 1.2, 1.72);
      put(g, box(3.9, .5, 3.9, roof, eR), sx * 2.4, y + 2.95, 0);
      put(g, box(2.6, .45, 2.6, roof, eR), sx * 2.4, y + 3.4, 0);
    }
    return 11.09756;
  },
  obelisk(g) { // Obelisco-inspired, stylised (not surveyed), sourced key features (Presidencia de la Nacion ficha + Wikipedia 'Obelisco de Buenos Aires': architect Alberto Prebisch, 1936; 67 m reinforced concrete on a 49 m2 base; modern forms with NO statuary or decoration; the apex carries FOUR windows, one per side; interior 206 steps/7 landings not visible; painted white latex). Update 158: rebuild drops the invented flanking walls (no walls at the real monument - the sourced plazoletas with provincial shields are plaza fabric, not part of the shaft) and adds the sourced apex windows + door + stepped podium. Effective collider disc kept numerically identical (return = old-lr 12 * old-scale 20/42).
    const W = '#ece8de', DK = '#3a3a40';
    put(g, box(7, .7, 7, '#e2ded2'), 0, .35, 0); put(g, box(5.6, .7, 5.6, '#e8e4d8'), 0, 1.05, 0); // stepped podium (real base 7x7 m = 49 m2)
    put(g, cyl(1.5, 1.9, 16.3, 4, W), 0, 9.55, 0).rotation.y = .7854; // plain tapering square shaft (4-seg idiom, faces on the axes)
    put(g, cone(1.5, 2.0, 4, W), 0, 18.7, 0).rotation.y = .7854; // pyramidion, same radius as the shaft top - flat contact (natural H 19.7, keeps the cap-20 skyline presence)
    for (const a of [0, 1.5708, 3.1416, 4.7124]) { const wn = put(g, box(.5, .7, .1, DK), Math.sin(a) * 1.08, 16.6, Math.cos(a) * 1.08); wn.rotation.y = a; wn.castShadow = false; } // the sourced four apex windows, one per side (proud .05 of the face)
    put(g, box(.9, 1.6, .12, '#4a4640'), 0, 2.2, 1.33).castShadow = false; // entrance door on the south face
    return 12 * 20 / 42; },
  cntower(g) { // CN-Tower-inspired, grounded in Wikipedia ('CN Tower'): 553 m concrete tower; 'hexagonal core to The Top, with three support legs blended into the hexagon below the main level, forming a large Y-shape structure at the ground level'; main pod with lit ring, smaller SkyPod near the top, antenna spire.
    // Stylized silhouette grammar, not surveyed. Rebuilt at natural height 19.6 (old 58-tall build squashed to .224 under the h13 cap and read as a roadside bollard); toronto's landmark cap raised to 20 (same precedent as newyork:14/rio:12/dubai:20) because the tower's identity IS its height. return 3.5 matches the actual ground footprint (Y-leg tips ~2.5); old squashed disc was 1.345.
    const conc = '#e8e8e4', pod = '#d4d8dc', pOpt = { emissive: '#c9cdd2', emissiveIntensity: .22 }; // gentle self-light so the pod underside stays concrete, not mud
    for (const a of [0, 2.094, 4.189]) { const leg = put(g, box(1.0, 4.2, 1.6, pod, pOpt), Math.cos(a) * 1.7, 1.8, Math.sin(a) * 1.7); leg.rotation.y = -a; } // three support legs forming the Y at ground
    put(g, cyl(.5, .95, 12.6, 6, conc), 0, 6.3, 0); // hexagonal core shaft
    put(g, cyl(2.4, 2.4, .4, 14, pod, pOpt), 0, 12.7, 0); // pod under-ring
    put(g, cyl(2.3, 2.0, 1.5, 14, pod, pOpt), 0, 13.35, 0); // main pod
    put(g, cyl(1.85, 1.85, .55, 14, '#4a8ae8', { emissive: '#4a8ae8', emissiveIntensity: .35 }), 0, 14.3, 0); // lit accent ring atop the pod
    put(g, cyl(.28, .45, 2.8, 6, conc), 0, 15.75, 0); // upper shaft
    put(g, cyl(1.1, .9, .9, 10, pod, pOpt), 0, 17.55, 0); // SkyPod
    put(g, cyl(.06, .22, 1.7, 5, conc), 0, 18.8, 0); // antenna spire
    return 3.5; },
parthenon(g) { put(g, cyl(13.5, 13.1, 3.0, 12, '#b4a888'), 0, 1.5, 0); for (let i = 0; i < 3; i++) put(g, box(24 - i * 1.6, .7, 12 - i * 1.2, '#efe8d8'), 0, 2.9 + i * .7, 0); for (let i = 0; i < 8; i++) for (const z of [-4.6, 4.6]) put(g, cyl(.7, .85, 7.5, 10, '#f6f0e0'), -9.8 + i * 2.8, 7.6, z); put(g, box(23, 1.2, 11, '#e4dcc8'), 0, 11.9, 0); put(g, cone(6.6, 2.8, 3, '#e8e0cc'), 0, 13.9, 0).rotation.y = 1.57; return 13.5; }, // Parthenon-inspired hilltop temple on a low rock plinth, stylized silhouette not surveyed. Recomposed for mobile readability (visual-gate hold fix): the r22 h8 cone hill put the temple base at y8, so the ground-level follow cam at stamp range faced a featureless 7.7-tall wall. Temple lowered 5.5 (steps y2.9, columns y7.6, entablature y11.9, pediment y13.9; natural H now 15.3, under the 20 cap so scale 1 - no squash at all) on a low h3 plinth flaring r13.1 base -> r13.5 top (natural rock widening) whose top embeds .45 into the step slab and supports its full 24x12 width including the 13.42 corner diagonal (no apex float, no cantilevered corners; capsule rests at 13.95 against the rim); plinth base 13.1 < disc 13.5 keeps every walkable point outside the hill mesh (groundY is flat .62: the old r22 hill reached 21.2 world and buried stamping players to 2.5 and the traveler at disc+5.5 waist-deep; burial now impossible). lr 13->13.5 covers the step corner (13.4); disc 13.5; zero pickup spots inside disc+1.5.
});

// social stage themes: one per city, culturally themed (visual design; perform/watch logic lives in app.js)
export const STAGE_THEMES = {
    tokyo: { roof: 'tier', bd: 'rays', c1: '#c0392b', c2: '#f0e6cf', name: 'Matsuri stage' },
    newyork: { roof: 'marquee', bd: 'zigzag', c1: '#2c3e50', c2: '#f1c40f', name: 'Broadway stage' },
    london: { roof: 'marquee', bd: 'bands', c1: '#7a1f2b', c2: '#e8c766', name: 'West End stage' },
    paris: { roof: 'flat', bd: 'arch', c1: '#3a3f4a', c2: '#e8c766', name: 'Cabaret stage' },
    rome: { roof: 'pergola', bd: 'arch', c1: '#b3502e', c2: '#e8d8b8', name: 'Forum stage' },
    athens: { roof: 'pergola', bd: 'arch', c1: '#e8e4d8', c2: '#3a6ea8', name: 'Amphitheatre stage' },
    bogota: { roof: 'marquee', bd: 'bands', c1: '#8a4a3a', c2: '#e8c766', name: 'Andean stage' },
    bogotadowntown: { roof: 'marquee', bd: 'bands', c1: '#8a4a3a', c2: '#e8c766', name: 'La Candelaria stage' }, /* Update 124: the district has a real auto-sited stage - name it honestly instead of the generic 'City stage' fallback */
    lagosisland: { roof: 'marquee', bd: 'bands', c1: '#2a6a3a', c2: '#e8c766', name: 'Marina stage' }, /* Update 124: district stage honestly named (the district fronts the Marina) */
    auckland: { roof: 'marquee', bd: 'bands', c1: '#1a4a5a', c2: '#e8e4d8', name: 'City of Sails stage' },
    lagos: { roof: 'marquee', bd: 'bands', c1: '#2a6a3a', c2: '#e8c766', name: 'Afrobeats stage' },
    stockholm: { roof: 'marquee', bd: 'bands', c1: '#2a5a8a', c2: '#e8c766', name: 'Midsommar stage' },
    kualalumpur: { roof: 'tier', bd: 'rays', c1: '#1a5a4a', c2: '#e8c766', name: 'KLCC stage' },
    amsterdam: { roof: 'pergola', bd: 'arch', c1: '#e8782a', c2: '#f0e8d0', name: 'Canalside stage' },
    lisbon: { roof: 'pergola', bd: 'arch', c1: '#2f6fb0', c2: '#f2e8c8', name: 'Fado terrace' },
    lima: { roof: 'pergola', bd: 'arch', c1: '#c8302a', c2: '#f2e8c8', name: 'Plaza Mayor stage' },
    marrakesh: { roof: 'marquee', bd: 'bands', c1: '#c8452e', c2: '#e8c050', name: 'Medina stage' },
    madrid: { roof: 'pergola', bd: 'arch', c1: '#c8452e', c2: '#f2d27a', name: 'Plaza stage' },
    nairobi: { roof: 'marquee', bd: 'bands', c1: '#2f7a3a', c2: '#d9a63a', name: 'Savanna stage' },
    jakarta: { roof: 'marquee', bd: 'rays', c1: '#c83a2a', c2: '#f2ede0', name: 'Gamelan stage' },
    cairo: { roof: 'dome', bd: 'zigzag', c1: '#c9a84a', c2: '#8a5a2a', name: 'Bazaar stage' },
    istanbul: { roof: 'dome', bd: 'arch', c1: '#2e8a8a', c2: '#e8c766', name: 'Hippodrome stage' },
    moscow: { roof: 'dome', bd: 'zigzag', c1: '#a03434', c2: '#e8c766', name: 'Bolshoi stage' },
    delhi: { roof: 'dome', bd: 'arch', c1: '#d86a2a', c2: '#f0e6cf', name: 'Haveli stage' },
    mumbai: { roof: 'marquee', bd: 'rays', c1: '#b03a6a', c2: '#f1c40f', name: 'Bollywood stage' },
    beijing: { roof: 'tier', bd: 'rays', c1: '#a02828', c2: '#e8c766', name: 'Temple fair stage' },
    seoul: { roof: 'tier', bd: 'zigzag', c1: '#2a4a7a', c2: '#d8553a', name: 'Hanok stage' },
    hongkong: { roof: 'marquee', bd: 'rays', c1: '#3a3f4a', c2: '#35d0ff', name: 'Neon stage' },
    singapore: { roof: 'flat', bd: 'zigzag', c1: '#3a7a4a', c2: '#f0ede0', name: 'Garden stage' },
    bangkok: { roof: 'tier', bd: 'bands', c1: '#c9a84a', c2: '#a02828', name: 'Siam stage' },
    dubai: { roof: 'flat', bd: 'arch', c1: '#e8e4d8', c2: '#c9a84a', name: 'Marina stage' },
    sydney: { roof: 'sail', bd: 'rays', c1: '#f0ede0', c2: '#3a6ea8', name: 'Harbour stage' },
    rio: { roof: 'pergola', bd: 'zigzag', c1: '#3a9a4a', c2: '#f1c40f', name: 'Samba stage' },
    capetown: { roof: 'thatch', bd: 'bands', c1: '#8a6a3a', c2: '#c96a2a', name: 'Mzansi stage' },
    losangeles: { roof: 'marquee', bd: 'rays', c1: '#e8e4d8', c2: '#c0392b', name: 'Hollywood stage' },
    mexicocity: { roof: 'flat', bd: 'zigzag', c1: '#d84a8a', c2: '#f1a40f', name: 'Fiesta stage' },
    buenosaires: { roof: 'flat', bd: 'bands', c1: '#7ab8e8', c2: '#f0ede0', name: 'Tango stage' },
    toronto: { roof: 'marquee', bd: 'bands', c1: '#a02828', c2: '#f0ede0', name: 'Maple stage' },
    berlin: { roof: 'flat', bd: 'zigzag', c1: '#3a3f46', c2: '#35d0ff', name: 'Techno stage' },
  };


/* Regional facade grammar (design inspiration): the building SKIN varies per region while placement,
   footprints, heights, colliders and the placement RNG stream stay untouched (facades use a separate
   seeded RNG keyed by city + building index). Same building, different regional fabric:
   - glass: curtain wall (bands + vertical mullions)   - punched: masonry, small windows + cornice
   - balcony: tropical/latin slabs + street awnings    - grid: fine Manhattan curtain grid
   - band: classic strips (fallback, identical to the original look) */
const FACADE = {
  glass: ['dubai', 'singapore', 'hongkong', 'toronto', 'kualalumpur', 'auckland'], /* Update 159: kualalumpur + auckland modern curtain-wall fabric (tokyo PROBED and reverted - roof 'neon' skips facades by design, pixel-diff 0%) was on the plain band fallback (row-15 'cities share similar box-shaped buildings' gap); own per-building Rf stream, placement/colliders/slots untouched (126 class) */
  punched: ['paris', 'london', 'rome', 'athens', 'istanbul', 'moscow', 'berlin', 'buenosaires', 'delhi', 'beijing', 'cairo', 'amsterdam'], /* Update 159: amsterdam European masonry fabric (canal-district gables already in roofs) off the band fallback - same 126 class */
  balcony: ['mumbai', 'rio', 'bangkok', 'mexicocity', 'capetown', 'sydney', 'losangeles', 'lagos', 'lagosisland', 'jakarta'], /* Update 159: jakarta tropical commercial mid-rise - exact 126 Lagos class */ /* Update 126 (Main 10:13/10:37 blank-facade note): Lagos + Lagos Island tropical commercial mid-rise get the balcony skin (bands + coloured balcony slabs + street awning) - same class as mumbai/rio/bangkok; own per-building Rf stream, placement stream/colliders/slots untouched */
  grid: ['newyork'],
  medina: ['marrakesh'],
  pombaline: ['lisbon'], /* Update 164: city-specific Pombaline Baixa fabric (row-15; source https://en.wikipedia.org/wiki/Pombaline_style - up to 4 floors, ground-floor shop arcades, balconies on first and top floors, restrained neoclassical fronts); lisbon style entry already flat-roof hmax 10 pastel palette; own per-building Rf stream, placement/colliders/slots untouched */ /* Update 160: city-specific medina fabric (row-15 genuine city-specific direction, main 5:15) - deep-set small windows, crenellated parapet, tall door; NO glass storefront (wrong for medina fabric) */
};
export const facadeOf = id => Object.keys(FACADE).find(k => FACADE[k].includes(id)) || 'band';
// Update 162: facade batching - facade elements are static axis-aligned boxes; collect them per material group during building placement and merge into ONE mesh per group per city (finalizeFacades), instead of one Mesh + one MeshStandardMaterial per element. Same shapes, same positions, same materials, same shadow flags; visual output must be pixel-identical. Reversible: flip facadePut back to put().
const FACADE_BATCH = new Map(); // material key 'colorHex/emissiveHex/emissiveIntensity' -> [[w,h,d,x,y,z], ...]
function facadePut(mesh, x, y, z) {
  const p = mesh.geometry.parameters, m = mesh.material;
  const key = m.color.getHexString() + '/' + m.emissive.getHexString() + '/' + m.emissiveIntensity;
  if (!FACADE_BATCH.has(key)) FACADE_BATCH.set(key, []);
  FACADE_BATCH.get(key).push([p.width, p.height, p.depth, x, y, z]);
  if (typeof window !== 'undefined' && window.__fc) window.__fc.meshes++;
  mesh.geometry.dispose(); mesh.material.dispose(); // the element lives on as merged-geometry vertices, not this mesh
  return { castShadow: false }; // sink for call-site `.castShadow = false`
}
export function finalizeFacades(world) {
  for (const [key, items] of FACADE_BATCH) {
    const [col, emi, eint] = key.split('/');
    const pos = [], norm = [], uv = [], idx = [];
    let vb = 0;
    for (const [w, h, d, x, y, z] of items) {
      const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z);
      const pa = g.attributes.position.array, na = g.attributes.normal.array, ua = g.attributes.uv.array, ia = g.index.array;
      for (let i = 0; i < pa.length; i++) { pos.push(pa[i]); norm.push(na[i]); }
      for (let i = 0; i < ua.length; i++) uv.push(ua[i]);
      for (let i = 0; i < ia.length; i++) idx.push(ia[i] + vb);
      vb += pa.length / 3; g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ color: '#' + col, flatShading: true, roughness: .9, metalness: 0 });
    if (emi !== '000000') { mat.emissive = new THREE.Color('#' + emi); mat.emissiveIntensity = +eint; }
    const merged = new THREE.Mesh(geo, mat);
    merged.castShadow = false; merged.receiveShadow = true; // matches the per-element flags the call sites set via put() + .castShadow = false
    world.add(merged);
    if (typeof window !== 'undefined' && window.__fc) window.__fc.groups = (window.__fc.groups || 0) + 1;
  }
  FACADE_BATCH.clear();
}
export function addFacade(world, kind, Rf, rx, rz, rw, rd, h) {
  if (typeof window !== 'undefined' && window.__fc) window.__fc.buildings++; // dev-only counter (Update 161/162); logical element tally now lives in facadePut, merged-group tally in finalizeFacades
  const glass = { emissive: '#7fb8e8', emissiveIntensity: .12 };
  if (kind === 'glass') { // curtain wall: full bands + vertical mullion strips
    for (let k = 0; k < Math.floor(h / 4); k++) facadePut(box(rw + .06, .9, rd + .06, '#bfe4ff', glass), rx, 3 + k * 3.6, rz).castShadow = false;
    for (let c = 1, n = Math.max(1, Math.floor(rw / 2.6)); c <= n; c++)
      facadePut(box(.14, h - 1.4, rd + .1, '#9fc8e0'), rx - rw / 2 + c * rw / (n + 1), .6 + h / 2, rz).castShadow = false;
  } else if (kind === 'punched' && h <= 24) { // masonry fabric: small dark punched windows front+back, light cornice (low/mid rise only; tall towers keep strips)
    const win = { emissive: '#b8d4ea', emissiveIntensity: .08 };
    const floors = Math.max(1, Math.floor((h - 2.2) / 2.8)), cols = Math.max(1, Math.floor((rw - 1.2) / 1.6));
    for (let f2 = 0; f2 < floors; f2++) for (let c = 0; c < cols; c++) {
      const wy = 2.6 + f2 * 2.8, wx = rx - rw / 2 + (c + .5) * rw / cols;
      for (const sg of [-1, 1]) facadePut(box(.62, .95, .08, '#2f3a46', win), wx, wy, rz + sg * (rd / 2 + .03)).castShadow = false;
    }
    facadePut(box(rw + .35, .3, rd + .35, '#e8e0cc'), rx, .6 + h - .15, rz).castShadow = false; // cornice
  } else if (kind === 'balcony') { // tropical/latin: sparser bands, coloured balcony slabs + a street awning
    const ac = ['#e8553a', '#3a8ae8', '#e8c43a', '#4ab870', '#ff8fb0'][Math.floor(Rf() * 5)];
    for (let y = 3.4; y < h - .8; y += 7.2) { facadePut(box(rw + .06, .9, rd + .06, '#bfe4ff', glass), rx, y, rz).castShadow = false;
      facadePut(box(rw * .82, .16, 1.0, ac), rx, y - .62, rz + rd / 2 + .45).castShadow = false; }
    facadePut(box(rw * .7, .14, 1.2, ac, { emissive: ac, emissiveIntensity: .1 }), rx, 3.1, rz + rd / 2 + .55).castShadow = false;
  } else if (kind === 'grid') { // Manhattan curtain: fine floor grid + mullions
    for (let y = 2.6; y < h - .8; y += 2.3) facadePut(box(rw + .06, .5, rd + .06, '#bfe4ff', glass), rx, y, rz).castShadow = false;
    for (let c = 1, n = Math.max(2, Math.floor(rw / 1.9)); c <= n; c++)
      facadePut(box(.1, h - 1.2, rd + .1, '#a8cfe4'), rx - rw / 2 + c * rw / (n + 1), .6 + h / 2, rz).castShadow = false;
  } else if (kind === 'pombaline') { // Lisbon Baixa Pombaline fabric (schematic, sourced typology): white-framed punched windows front+back, slim balcony slabs on first and top floors, ground-floor arcade bays (shops), restrained cornice; NO glass storefront (arcade instead)
    const win = { emissive: '#b8d4ea', emissiveIntensity: .08 };
    const floors = Math.max(1, Math.floor((h - 2.2) / 2.8)), cols = Math.max(1, Math.floor((rw - 1.2) / 2.0));
    for (let f2 = 0; f2 < floors; f2++) for (let c = 0; c < cols; c++) {
      const wy = 3.4 + f2 * 2.8, wx = rx - rw / 2 + (c + .5) * rw / cols;
      for (const sg of [-1, 1]) {
        facadePut(box(.86, 1.2, .06, '#f4efe2'), wx, wy, rz + sg * (rd / 2 + .02)).castShadow = false; // white frame
        facadePut(box(.62, .95, .08, '#2f3a46', win), wx, wy, rz + sg * (rd / 2 + .04)).castShadow = false; // dark sash
      }
    }
    for (const fy of (floors > 1 ? [3.4, 3.4 + (floors - 1) * 2.8] : [3.4])) { // first + top floor balcony slabs (front face; one slab when single-floor)
      facadePut(box(rw * .8, .12, .5, '#e8e0cc'), rx, fy - .75, rz + rd / 2 + .28).castShadow = false;
      facadePut(box(rw * .8, .35, .06, '#8a8474'), rx, fy - .45, rz + rd / 2 + .5).castShadow = false; // slim rail
    }
    for (let c2 = 0, n2 = Math.max(1, Math.floor(rw / 3)); c2 < n2; c2++) { // ground-floor arcade: recessed dark bays between piers
      facadePut(box(1.5, 2.2, .1, '#3a3430'), rx - rw / 2 + (c2 + .5) * rw / n2, .6 + 1.1, rz + rd / 2 + .03).castShadow = false;
    }
    facadePut(box(rw + .35, .3, rd + .35, '#e8e0cc'), rx, .6 + h - .15, rz).castShadow = false; // restrained cornice
  } else if (kind === 'medina') { // Marrakesh medina fabric: deep-set small windows (front+back), crenellated roofline parapet, tall dark door; low-rise (marrakesh hmax 9)
    for (let f2 = 0, floors = Math.max(1, Math.floor((h - 2.4) / 2.6)); f2 < floors; f2++)
      for (let cc = 0, cols = Math.max(1, Math.floor((rw - 1) / 2)); cc < cols; cc++) {
        const wy = 2.7 + f2 * 2.6, wx = rx - rw / 2 + (cc + .5) * rw / cols;
        for (const sg of [-1, 1]) facadePut(box(.55, .75, .08, '#3a2c22'), wx, wy, rz + sg * (rd / 2 + .03)).castShadow = false;
      }
    for (const sg of [-1, 1]) for (let k = 0, n = Math.floor(rw / 1.4); k <= n; k++) // roofline merlons
      facadePut(box(.7, .45, .22, '#e4cfa8'), rx - rw / 2 + .4 + k * 1.4, .6 + h + .22, rz + sg * (rd / 2 - .11)).castShadow = false;
    facadePut(box(.9, 2.0, .1, '#4a3226'), rx, .6 + 1.0, rz + rd / 2 + .04).castShadow = false; // tall dark medina door
  } else { // band: the original strips, unchanged
    for (let k = 0; k < Math.floor(h / 4); k++) facadePut(box(rw + .06, .9, rd + .06, '#bfe4ff', glass), rx, 3 + k * 3.6, rz).castShadow = false;
  }
  // ground-floor storefront on the facade face: display glass, side door, coloured awning.
  // Eye-level street detail (buildings were blank below the first window band). Visual only - no collider
  // change (inside the building's existing placement clearance), own Rf stream, placement stream untouched.
  if (kind !== 'balcony' && kind !== 'medina' && kind !== 'pombaline' && h >= 4.5) { /* medina carries its own door, no glass storefront */ // balcony kind already carries a street awning at the same height; 4.5 keeps low-rise old-town fabric included (delhi tops out at 7.7)
    const zf = rz + rd / 2, sw = Math.min(rw * .68, 7);
    facadePut(box(sw, 1.5, .1, '#9fd0e8', { emissive: '#7fb8e8', emissiveIntensity: .18 }), rx, 1.75, zf + .09).castShadow = false;
    facadePut(box(.95, 2.1, .12, '#3a3230'), rx + (Rf() < .5 ? -1 : 1) * (rw / 2 - .9), 1.65, zf + .1).castShadow = false;
    const ac2 = ['#c8503c', '#3a7ac8', '#c8a03c', '#4a9860'][Math.floor(Rf() * 4)];
    facadePut(box(sw + .4, .14, 1.0, ac2), rx, 3.0, zf + .62).castShadow = false;
  }
}

// Tokyo Bay far shore (render-only, Tokyo only): the playable east waterfront is the straight harbour edge every coastal city uses; beyond the open water a hazy far shore stands where Chiba and the Boso side lie in the east. Coast line: Natural Earth 10m land polygon (public domain, https://www.naturalearthdata.com/about/terms-of-use/), Chiba north shore round the Boso east shore and down towards Kisarazu, thinned with Douglas-Peucker at 0.004 deg. Stylized map approximation, not a surveyed boundary and not to real distance: lon/lat map to game x = S - 6 + (lon - 139.757) * 546, z = -26 - (lat - 35.6586) * 1105.7 (about 60 percent of 100 m per unit east-west, 100 m per unit north-south), which keeps the bearing (Chiba to the east, the bay opening south-east) and the bay shape, while compressing the width so the far shore is visible from the waterfront.
const TOKYO_FAR = [[139.950,35.673],[139.984,35.669],[139.996,35.657],[140.009,35.660],[140.080,35.604],[140.086,35.567],[140.102,35.567],[140.090,35.541],[140.072,35.543],[140.006,35.473],[139.982,35.459],[139.959,35.456],[139.941,35.443],[139.913,35.434],[139.900,35.423],[139.908,35.379],[139.845,35.376]];
function tokyoFarShore(world, S, ground) {
  const lim = 345, cl = v => Math.max(-lim, Math.min(lim, v));
  const pts = TOKYO_FAR.map(([lo, la]) => [cl(S - 6 + (lo - 139.757) * 546), cl(-26 - (la - 35.6586) * 1105.7)]);
  const poly = [[pts[0][0], -lim], ...pts, [lim, lim], [lim, -lim]];
  const sh = new THREE.Shape(); poly.forEach(([x, z], i) => i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)); sh.closePath();
  const ge = new THREE.ShapeGeometry(sh); ge.rotateX(-Math.PI / 2);
  const m = box(1, 1, 1, ground, { roughness: .9 }); m.geometry = ge; m.castShadow = false; m.receiveShadow = false; put(world, m, 0, 1.02, 0);
  // low port and city skyline on the far shore (deterministic, no RNG): blocks every ~9 units along the coast, heights 6 to 21, taller towards the Chiba end
  let n = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], len = Math.hypot(x2 - x1, z2 - z1), cnt = Math.floor(len / 9);
    for (let k = 0; k < cnt; k++, n++) {
      const t = (k + .5) / cnt, x = x1 + (x2 - x1) * t + 5, z = z1 + (z2 - z1) * t;
      if (Math.abs(x) > 330 || Math.abs(z) > 330) continue;
      const h = 6 + (n * 37 % 7) * 2 + (z < 0 ? 4 : 0), w = 5 + (n * 17 % 4), c = ['#9aa3ac', '#b4a99a', '#8e9aa8', '#a7b0b4'][n % 4];
      put(world, box(w, h, 5 + (n * 11 % 3), c), x, 1 + h / 2, z).castShadow = false;
    }
  }
  const rim = pts.map(([x, z]) => [x, z]); // lighter shallow-water margin hugging the far coast
  const sh2 = new THREE.Shape(); [[pts[0][0] - 6, -lim], ...pts.map(([x, z]) => [x - 6, z]), [lim, lim], [lim, -lim]].forEach(([x, z], i) => i ? sh2.lineTo(x, -z) : sh2.moveTo(x, -z)); sh2.closePath();
  const g2 = new THREE.ShapeGeometry(sh2); g2.rotateX(-Math.PI / 2); const m2 = box(1, 1, 1, '#5fbadb', { roughness: .2 }); m2.geometry = g2; m2.castShadow = false; m2.receiveShadow = false; put(world, m2, 0, 1.01, 0);
}
// Hong Kong Island across Victoria Harbour (render-only, Hong Kong only, SUPPORT for the Tsim Sha Tsui waterfront, not playable geography). The map's anchor is the Kowloon promenade (Star Ferry Pier 22.2940N 114.1686E; water to the south), so the far shore is the Hong Kong Island north coast with Victoria Peak behind it. Coast points: Natural Earth 10m land (public domain), north shore of the Hong Kong Island polygon, Kennedy Town to Shau Kei Wan, coarse. Gameplay scale: 60 units per km, so the real 1.7 km harbour is stretched and the shore is held at least 46 units beyond the playable edge. Skyline blocks are deterministic hand-set heights (not surveyed), taller toward Central and Wan Chai.
const HK_FAR = [[114.1205,22.2817],[114.1291,22.2856],[114.1391,22.2887],[114.1499,22.2856],[114.1571,22.2817],[114.1657,22.2794],[114.1789,22.2794],[114.1882,22.2872],[114.1968,22.2919],[114.2064,22.2882],[114.2156,22.2856]];
function hkFarShore(world, S, ground) {
  const lim = 345, cl = v => Math.max(-lim, Math.min(lim, v)), edge = S - 6;
  const pts = HK_FAR.map(([lo, la]) => [cl((lo - 114.171) * 6180), Math.max(edge + 46, Math.min(lim, edge + (22.2935 - la) * 6672))]);
  const poly = [[pts[0][0], lim], ...pts, [pts[pts.length - 1][0], lim]];
  const sh = new THREE.Shape(); poly.forEach(([x, z], i) => i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)); sh.closePath();
  const ge = new THREE.ShapeGeometry(sh); ge.rotateX(-Math.PI / 2);
  const m = box(1, 1, 1, ground, { roughness: .9 }); m.geometry = ge; m.castShadow = false; m.receiveShadow = false; put(world, m, 0, 1.02, 0);
  const rim = [[pts[0][0], lim], ...pts.map(([x, z]) => [x, z - 6]), [pts[pts.length - 1][0], lim]];
  const sh2 = new THREE.Shape(); rim.forEach(([x, z], i) => i ? sh2.lineTo(x, -z) : sh2.moveTo(x, -z)); sh2.closePath();
  const g2 = new THREE.ShapeGeometry(sh2); g2.rotateX(-Math.PI / 2); const m2 = box(1, 1, 1, '#5fbadb', { roughness: .2 }); m2.geometry = g2; m2.castShadow = false; m2.receiveShadow = false; put(world, m2, 0, 1.01, 0);
  // Victoria Peak (552 m, 22.2759N 114.1455E) behind Central
  for (const [rr, hh, dx, dz, col] of [[78, 34, -6, 34, '#5f7d68'], [58, 52, 0, 40, '#6f8a74'], [30, 60, -2, 44, '#7d9880'], [44, 40, 40, 36, '#688a70']]) { const pk = cone(rr, hh, 11, col, { roughness: .95 }); pk.castShadow = false; put(world, pk, (114.1455 - 114.171) * 6180 + dx, 1 + hh / 2, edge + (22.2935 - 22.2759) * 6672 + dz); }
  let n = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], len = Math.hypot(x2 - x1, z2 - z1), cnt = Math.floor(len / 4.5);
    for (let k = 0; k < cnt; k++, n++) {
      const t = (k + .5) / cnt, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t + 4 + (n * 13 % 3) * 3;
      if (Math.abs(x) > 330) continue;
      const cen = Math.max(0, 1 - Math.abs(x - (114.162 - 114.171) * 6180) / 140); // Central / Wan Chai towers are the tallest
      const h = 3 + (n * 37 % 7) * .8 + cen * (6 + (n * 11 % 5) * 1.6), w = 2.4 + (n * 17 % 4) * .5, dd = 2.4 + (n * 11 % 3) * .5;
      const pal = ['#9fb0bc', '#7fa4b8', '#b9c6cc', '#6f94a8', '#c9bfae', '#8aa8a4', '#a4aec4', '#d4d8d8'], c = pal[(n * 5 + (n >> 2)) % pal.length];
      put(world, box(w, h, dd, c), x, 1 + h / 2, z).castShadow = false;
      const kind = (n * 7) % 6; // crowns and setbacks so the skyline reads as varied towers, not a row of boxes
      if (h > 9 && kind === 0) put(world, box(w * .6, h * .22, dd * .6, c), x, 1 + h + h * .11, z).castShadow = false; // stepped top
      else if (h > 9 && kind === 1) put(world, cyl(.08, .14, h * .3, 6, '#cfd6da'), x, 1 + h + h * .15, z).castShadow = false; // mast
      else if (h > 7 && kind === 2) put(world, box(w * 1.06, .5, dd * 1.06, '#e8f0f4', { emissive: '#bfe4f4', emissiveIntensity: .25 }), x, 1 + h + .25, z).castShadow = false; // lit crown band
    }
  }
  // named towers at their real bearings from the anchor: IFC2 (22.2850N 114.1585E), Bank of China (22.2792N 114.1613E), Central Plaza (22.2796N 114.1727E)
  for (const [lo, la, hh, ww, col, spire] of [[114.1585, 22.2850, 22, 3.8, '#c4d4dc', 7], [114.1613, 22.2792, 17, 3.6, '#aebfca', 5], [114.1727, 22.2796, 19, 3.6, '#b8c4a8', 6]]) {
    const tx = (lo - 114.171) * 6180, tz = edge + (22.2935 - la) * 6672 - 2;
    put(world, box(ww, hh, ww, col, { roughness: .35 }), tx, 1 + hh / 2, tz).castShadow = false;
    put(world, cyl(.12, .3, spire, 6, '#e6ecef'), tx, 1 + hh + spire / 2, tz).castShadow = false;
  }
}
// Tsim Sha Tsui waterfront places at their real bearings from the promenade anchor (Star Ferry Pier 22.2940N 114.1686E). The shore is z = S-6; x = (lon-114.171)*6180, z = shore + (22.2935-lat)*6672 (gameplay scale, ~17 m per unit).
// Coordinates: Wikipedia/Wikidata published values for each landmark (Star Ferry Pier, Hong Kong Cultural Centre, Peninsula Hong Kong, Avenue of Stars, Chungking Mansions, Kowloon Park). Hand-built low-poly, "-inspired" names.
function extrasHK(world, colliders, places, S, roadAsphalt) {
  const shore = S - 6, X = lo => (lo - 114.171) * 6180, Z = la => shore + (22.2935 - la) * 6672;
  const nm = g => { g.castShadow = false; return g; };
  // A solid place keeps its real bearing when it can; otherwise it takes the nearest spot (<= 12 units) that is off the asphalt and clear of every collider, so roads never run into a block. The moved distance is logged for the source notes.
  const free = (x, z, hw, hd) => !roadAsphalt(x, z, Math.max(hw, hd) + 1) && !colliders.some(c => c.hw !== undefined ? Math.abs(x - c.x) < hw + c.hw + 1 && Math.abs(z - c.z) < hd + c.hd + 1 : Math.hypot(x - c.x, z - c.z) < Math.max(hw, hd) + c.r + 1) && z + hd < shore - 1;
  const site = (x0, z0, hw, hd) => { let best = null; for (let dx = -12; dx <= 12; dx += 1.5) for (let dz = -12; dz <= 12; dz += 1.5) { const d = Math.hypot(dx, dz); if ((!best || d < best.d) && free(x0 + dx, z0 + dz, hw, hd)) best = { x: x0 + dx, z: z0 + dz, d }; } return best ? [best.x, best.z] : [x0, z0]; };
  { const x = X(114.16857) - 2, z = Z(22.2940) - 1; // Star Ferry Pier: green-and-white terminal with a deck over the water
    put(world, box(7, 3, 4.4, '#f2f2ea'), x, 1.6 + 1.5, z); put(world, box(7.4, .5, 4.8, '#2f8f5a'), x, 1.1 + 3.2, z);
    nm(put(world, box(5, .25, 9, '#8a6f50'), x, 1.15, z + 6.5)); for (const dx of [-2.3, 2.3]) for (const dz of [3, 6, 9]) nm(put(world, cyl(.18, .18, 1.2, 6, '#5a4a3a'), x + dx, .8, z + dz));
    colliders.push({ x, z, hw: 3.7, hd: 2.4 }); places.push({ name: 'Star Ferry Pier-inspired terminal', x, z: z + 3, r: 9 }); }
  { const [x, z] = site(-4.5, 93, 5.5, 3.5); // Hong Kong Cultural Centre (real bearing x -4.5, z 95.4): wide windowless block under one sloped roof
    put(world, box(11, 4, 7, '#d8c9b0'), x, 1.1 + 2, z); const roof = put(world, box(12, 1, 8, '#c8b89c'), x, 1.1 + 5, z); roof.rotation.x = -.18;
    put(world, box(11.2, 2.4, .5, '#8aa8b8'), x, 1.1 + 1.3, z + 3.7);
    colliders.push({ x, z, hw: 5.5, hd: 3.5 }); places.push({ name: 'Hong Kong Cultural Centre-inspired hall', x, z: z + 4, r: 10 }); }
  { const [x, z] = site(X(114.17153), Z(22.29529), 5, 3); // The Peninsula (real bearing) // The Peninsula: cream colonial hotel with a rooftop helipad ring
    put(world, box(10, 7, 6, '#efe4c8'), x, 1.1 + 3.5, z); put(world, box(8, 1.2, 5, '#d9c9a0'), x, 1.1 + 7.6, z); put(world, cyl(1.6, 1.6, .15, 16, '#b8b0a0'), x + 2, 1.1 + 8.3, z); nm(put(world, box(10.2, .4, 6.2, '#b89a5a'), x, 1.1 + 6.9, z));
    colliders.push({ x, z, hw: 5, hd: 3 }); places.push({ name: 'The Peninsula-inspired hotel', x, z: z + 4, r: 9 }); }
  { const x = X(114.17476) + 2, z = shore - 3; // Avenue of Stars: waterfront promenade with gold star plaques (walkable, no collider)
    nm(put(world, box(22, .12, 4.2, '#d9d4c4'), x, 1.1, z)); for (let i = 0; i < 7; i++) nm(put(world, cyl(.55, .55, .06, 5, '#e8c24a', { emissive: '#e8c24a', emissiveIntensity: .25 }), x - 9 + i * 3, 1.2, z + (i % 2 ? .8 : -.8)));
    nm(put(world, cyl(.35, .45, 3.2, 8, '#d8d8d0'), x + 10.5, 2.7, z - 1)); // bronze-statue-style pedestal figure
    places.push({ name: 'Avenue of Stars-inspired promenade', x, z, r: 11 }); }
  { const [x, z] = site(X(114.17247), Z(22.29637), 3.5, 3); // Chungking Mansions (real bearing): dense tall block with bright shop signs
    put(world, box(7, 15, 6, '#7f8fa0'), x, 1.1 + 7.5, z); for (let i = 0; i < 6; i++) nm(put(world, box(1.6, .7, .2, ['#e8452c', '#35d0ff', '#f0c030', '#ff6aa8', '#7be07b', '#ffffff'][i]), x - 3 + (i % 3) * 3, 1.1 + 1.4 + Math.floor(i / 3) * 1.4, z + 3.1));
    colliders.push({ x, z, hw: 3.5, hd: 3 }); places.push({ name: 'Chungking Mansions-inspired block', x, z: z + 4, r: 8 }); }
  { const x = X(114.16986), z = Z(22.30143); // Kowloon Park: green with trees (walkable)
    nm(put(world, cyl(13, 13, .1, 20, '#7fb06a'), x, 1.08, z)); for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 4 + (i % 4) * 2.2, tx = x + Math.cos(a) * rr, tz = z + Math.sin(a) * rr; nm(put(world, cyl(.2, .3, 1.6, 6, '#6a4a30'), tx, 1.9, tz)); nm(put(world, cone(1.7, 3, 7, '#3f8a4a'), tx, 4, tz)); }
    places.push({ name: 'Kowloon Park-inspired green', x, z, r: 14 }); }
}
// London: places at their real bearings from Big Ben (51.5007N 0.1246W), which stands at the landmark spot (0,-26). x = (lon+0.1246)*4130 (69 km per degree of longitude at 51.5N, ~17 m per unit), z = -26 - (lat-51.5007)*6672. Solid places take the nearest road-free, collider-free site within 12 units.
function extrasLondon(world, colliders, places, roadAsphalt) {
  const X = lo => (lo + 0.1246) * 4130, Z = la => -26 - (la - 51.5007) * 6672, nm = g => { g.castShadow = false; return g; };
  const free = (x, z, hw, hd) => !roadAsphalt(x, z, Math.max(hw, hd) + 1) && !colliders.some(c => c.hw !== undefined ? Math.abs(x - c.x) < hw + c.hw + 1 && Math.abs(z - c.z) < hd + c.hd + 1 : Math.hypot(x - c.x, z - c.z) < Math.max(hw, hd) + c.r + 1) && Math.abs(x) < 100 && z > -100 && z < 98;
  const site = (x0, z0, hw, hd, rad = 12) => { let best = null; for (let dx = -rad; dx <= rad; dx += 1.5) for (let dz = -rad; dz <= rad; dz += 1.5) { const d = Math.hypot(dx, dz); if ((!best || d < best.d) && free(x0 + dx, z0 + dz, hw, hd)) best = { x: x0 + dx, z: z0 + dz, d }; } return best ? [best.x, best.z] : null; };
  { const q = site(X(-0.14194), Z(51.50083), 7, 4); if (q) { const [x, z] = q; // Buckingham Palace: long cream front, central balcony block, flag mast
      put(world, box(14, 6, 7, '#e6dcc2'), x, 1.1 + 3, z); put(world, box(4, 7.4, 7.2, '#efe6cc'), x, 1.1 + 3.7, z); nm(put(world, box(14.2, .35, 7.2, '#b8aa88'), x, 1.1 + 6.2, z)); nm(put(world, cyl(.08, .08, 4, 6, '#d8d8d8'), x, 1.1 + 9.4, z));
      colliders.push({ x, z, hw: 7, hd: 3.5 }); places.push({ name: 'Buckingham Palace-inspired front', x, z: z + 5, r: 10 }); } }
  { const q = [-23.29, -67.61]; /* Update 114: pinned to the accepted source-grounded site pre-registered at :1651 (Main 12:48) - the transform target X(-0.12806),Z(51.50806) sits ~11.7u away; this was the nearest-free accepted site and stays the landmark's home */ if (q) { const [x, z] = q; // Trafalgar Square: paved square, Nelson's Column-style shaft with four lions, fountains
      nm(put(world, box(16, .12, 14, '#cfc9b8'), x, 1.1, z)); put(world, cyl(.55, .7, 13, 8, '#c4bfb2'), x, 1.1 + 6.5, z); nm(put(world, cyl(.9, .9, .5, 8, '#8f8a7c'), x, 1.1 + 13.2, z));
      for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) nm(put(world, box(1.1, .7, .6, '#8a7a5a'), x + dx, 1.5, z + dz));
      for (const dz of [-5, 5]) nm(put(world, cyl(1.6, 1.6, .3, 14, '#6aa8c8', { roughness: .2 }), x, 1.25, z + dz));
      colliders.push({ x, z, r: 1.2 }); /* place already pre-registered at :1651 - no duplicate push (Update 114) */ } }
  { const q = site(X(-0.1275), Z(51.49944), 5, 4); if (q) { const [x, z] = q; // Westminster Abbey: stone nave with two west towers
      put(world, box(9, 5, 5, '#c9bda2'), x, 1.1 + 2.5, z); for (const dx of [-3, 3]) { put(world, box(2, 9, 2, '#bfb396'), x + dx, 1.1 + 4.5, z + 2.2); nm(put(world, cone(1.4, 2.4, 4, '#8a8a7c'), x + dx, 1.1 + 10.2, z + 2.2)); }
      colliders.push({ x, z, hw: 4.5, hd: 3 }); places.push({ name: 'Westminster Abbey-inspired church', x, z: z + 4, r: 9 }); } }
  // St Paul's (51.5138N 0.0983W) falls at x +110, z -113, outside the +-110 playable square at this scale, so it is not built.
}
function extrasToronto(world, colliders, places, roadAsphalt) {
  const X = lo => (lo + 79.38708) * 4790, Z = la => -26 - (la - 43.64256) * 6672, SLOTS = [[-17.12, -14.32]], nm = g => { g.castShadow = false; return g; };
  const free = (x, z, hw, hd) => !roadAsphalt(x, z, Math.max(hw, hd) + 1) && !colliders.some(c => c.hw !== undefined ? Math.abs(x - c.x) < hw + c.hw + 1 && Math.abs(z - c.z) < hd + c.hd + 1 : Math.hypot(x - c.x, z - c.z) < Math.max(hw, hd) + c.r + 1) && Math.abs(x) < 100 && z > -100 && z < 98 && !SLOTS.some(([sx, sz]) => Math.abs(x - sx) < Math.max(hw, hd) + 2.5 && Math.abs(z - sz) < Math.max(hw, hd) + 2.5) && !(z + hd > 90); /* Update 145: south-water guard (toronto water:'south'; this legacy free copy had NO water clause - same class as the extrasSet south guard; zero-churn verified by probe145: all 3 placements 100+u inside the line) */
  const site = (x0, z0, hw, hd, rad = 12) => { let best = null; for (let dx = -rad; dx <= rad; dx += 1.5) for (let dz = -rad; dz <= rad; dz += 1.5) { const d = Math.hypot(dx, dz); if ((!best || d < best.d) && free(x0 + dx, z0 + dz, hw, hd)) best = { x: x0 + dx, z: z0 + dz, d }; } return best ? [best.x, best.z] : null; };
  { const q = site(X(-79.38917), Z(43.64139), 6, 6, 18); if (q) { const [x, z] = q; // Rogers Centre: round stadium with a ribbed retractable-roof dome
      put(world, cyl(6, 6.4, 4, 20, '#9a9ea6'), x, 1.1 + 2, z); put(world, cyl(1.5, 5.6, 2.4, 20, '#c9ccd2'), x, 1.1 + 5.2, z); nm(put(world, cyl(1.5, 1.5, .3, 16, '#7f8590'), x, 1.1 + 6.5, z));
      colliders.push({ x, z, r: 6.4 }); places.push({ name: 'Rogers Centre-inspired stadium', x, z: z + 7.5, r: 10 }); } }
  { const q = site(X(-79.38028), Z(43.64444), 8, 4, 16); if (q) { const [x, z] = q; // Union Station: long stone hall with a colonnade
      put(world, box(16, 4.5, 7, '#cdbfa4'), x, 1.1 + 2.25, z); for (let k = -3; k <= 3; k++) nm(put(world, cyl(.35, .35, 4.2, 8, '#e4d8bc'), x + k * 2.1, 1.1 + 2.1, z + 3.9)); nm(put(world, box(16.4, .4, 7.6, '#8a8272'), x, 1.1 + 4.7, z));
      colliders.push({ x, z, hw: 8, hd: 3.6 }); places.push({ name: 'Union Station-inspired hall', x, z: z + 5, r: 10 }); } }
  { const q = site(X(-79.37917), Z(43.64333), 7, 5, 24); if (q) { const [x, z] = q; // Scotiabank Arena: wide low arena block with a lit band
      put(world, box(14, 4, 10, '#8f96a2'), x, 1.1 + 2, z); nm(put(world, box(14.2, .5, 10.2, '#d8dde6', { emissive: '#8fa8d0', emissiveIntensity: .3 }), x, 1.1 + 3.4, z));
      colliders.push({ x, z, hw: 7, hd: 5 }); places.push({ name: 'Scotiabank Arena-inspired arena', x, z: z + 6.5, r: 10 }); } }
}
function extrasParis(world, colliders, places, roadAsphalt, SLOTS) {
  const X = lo => (lo - 2.2945) * 4360, Z = la => -26 - (la - 48.85822) * 6672;
  const nm = g => { g.castShadow = false; return g; };
  const free = (x, z, hw, hd) => !roadAsphalt(x, z, Math.max(hw, hd) + 1) && !colliders.some(c => c.hw !== undefined ? Math.abs(x - c.x) < hw + c.hw + 1 && Math.abs(z - c.z) < hd + c.hd + 1 : Math.hypot(x - c.x, z - c.z) < Math.max(hw, hd) + c.r + 1) && Math.abs(x) < 100 && z > -100 && z < 98 && !SLOTS.some(([sx, sz]) => Math.abs(x - sx) < Math.max(hw, hd) + 2.5 && Math.abs(z - sz) < Math.max(hw, hd) + 2.5);
  const site = (x0, z0, hw, hd, rad = 12) => { let best = null; for (let dx = -rad; dx <= rad; dx += 1.5) for (let dz = -rad; dz <= rad; dz += 1.5) { const d = Math.hypot(dx, dz); if ((!best || d < best.d) && free(x0 + dx, z0 + dz, hw, hd)) best = { x: x0 + dx, z: z0 + dz, d }; } return best ? [best.x, best.z] : null; };
  { const q = site(X(2.3125), Z(48.855), 7, 5, 40); if (q) { const [x, z] = q; // Les Invalides: stone block with a gold-topped dome
      put(world, box(14, 4, 8, '#d8ccb0'), x, 1.1 + 2, z); put(world, box(6, 5.5, 6, '#cfc3a6'), x, 1.1 + 2.75, z - 1); put(world, cyl(2.2, 2.6, 2, 16, '#9aa8a0'), x, 1.1 + 6.5, z - 1); nm(put(world, cone(2.2, 3.2, 16, '#d4af37'), x, 1.1 + 9, z - 1)); nm(put(world, cyl(.08, .08, 2, 6, '#d4af37'), x, 1.1 + 11.5, z - 1));
      colliders.push({ x, z, hw: 7, hd: 4 }); places.push({ name: 'Les Invalides-inspired dome', x, z: z + 6, r: 10 }); } }
  { const q = site(X(2.29833), Z(48.85611), 9, 9, 20); if (q) { const [x, z] = q; // Champ de Mars: long green with gravel paths and lamps
      nm(put(world, box(18, .1, 18, '#6fa35a'), x, 1.12, z)); nm(put(world, box(1.6, .12, 18, '#d6cdb4'), x, 1.14, z)); nm(put(world, box(18, .12, 1.6, '#d6cdb4'), x, 1.14, z));
      for (const [dx, dz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) { nm(put(world, cyl(.1, .1, 2.2, 6, '#2f3a34'), x + dx, 2.2, z + dz)); nm(put(world, cyl(.3, .3, .3, 8, '#f6e8b0', { emissive: '#f6e8b0', emissiveIntensity: .4 }), x + dx, 3.4, z + dz)); }
      places.push({ name: 'Champ de Mars-inspired lawn', x, z, r: 10 }); } }
  // Arc de Triomphe (48.87378N 2.29503E) lies at z -130 and the Louvre at x +180, outside the +-110 playable square: not built.
}
function extrasCairo(world, colliders, places, roadAsphalt, SLOTS) {
  const X = lo => (lo - 31.13417) * 5740, Z = la => -26 - (la - 29.97917) * 6672;
  const nm = g => { g.castShadow = false; return g; };
  const free = (x, z, hw, hd) => !roadAsphalt(x, z, Math.max(hw, hd) + 1) && !colliders.some(c => c.hw !== undefined ? Math.abs(x - c.x) < hw + c.hw + 1 && Math.abs(z - c.z) < hd + c.hd + 1 : Math.hypot(x - c.x, z - c.z) < Math.max(hw, hd) + c.r + 1) && Math.abs(x) < 100 && z > -100 && z < 98 && !SLOTS.some(([sx, sz]) => Math.abs(x - sx) < Math.max(hw, hd) + 2.5 && Math.abs(z - sz) < Math.max(hw, hd) + 2.5);
  const site = (x0, z0, hw, hd, rad = 12) => { let best = null; for (let dx = -rad; dx <= rad; dx += 1.5) for (let dz = -rad; dz <= rad; dz += 1.5) { const d = Math.hypot(dx, dz); if ((!best || d < best.d) && free(x0 + dx, z0 + dz, hw, hd)) best = { x: x0 + dx, z: z0 + dz, d }; } return best ? [best.x, best.z] : null; };
  { const q = site(X(31.13083), Z(29.97611), 8, 8, 16); if (q) { const [x, z] = q; // Khafre
      put(world, cone(8, 11, 4, '#d8bf86'), x, 1.1 + 5.5, z).rotation.y = Math.PI / 4; nm(put(world, cone(2.2, 3, 4, '#efe2b8'), x, 1.1 + 9.6, z)).rotation.y = Math.PI / 4;
      colliders.push({ x, z, r: 7 }); places.push({ name: 'Pyramid of Khafre-inspired pyramid', x, z: z + 8, r: 11 }); } }
  { const q = site(X(31.12833), Z(29.9725), 4.5, 4.5, 24); if (q) { const [x, z] = q; // Menkaure
      put(world, cone(5.5, 7, 4, '#cfb47a'), x, 1.1 + 3.5, z).rotation.y = Math.PI / 4;
      colliders.push({ x, z, r: 5 }); places.push({ name: 'Pyramid of Menkaure-inspired pyramid', x, z: z + 6, r: 9 }); } }
  { const q = site(X(31.13758), Z(29.97526), 5, 3, 16); if (q) { const [x, z] = q; // Great Sphinx
      put(world, box(8, 1.8, 3, '#cdb582'), x, 1.1 + .9, z); put(world, box(2, 2.4, 2, '#d4bd8a'), x - 3.4, 1.1 + 2.8, z); nm(put(world, box(2.6, .8, 2.6, '#b89a60'), x - 3.4, 1.1 + 4.3, z));
      colliders.push({ x, z, hw: 4, hd: 1.6 }); places.push({ name: 'Great Sphinx-inspired statue', x, z: z + 4, r: 9 }); } }
}
function extrasSydney(world, colliders, places, roadAsphalt, SLOTS) {
  const X = lo => (lo - 151.21514) * 5500, Z = la => -26 - (la + 33.85681) * 6672;
  const nm = g => { g.castShadow = false; return g; };
  const free = (x, z, hw, hd) => !roadAsphalt(x, z, Math.max(hw, hd) + 1) && !colliders.some(c => c.hw !== undefined ? Math.abs(x - c.x) < hw + c.hw + 1 && Math.abs(z - c.z) < hd + c.hd + 1 : Math.hypot(x - c.x, z - c.z) < Math.max(hw, hd) + c.r + 1) && Math.abs(x) < 100 && z > -100 && z < 98 && !SLOTS.some(([sx, sz]) => Math.abs(x - sx) < Math.max(hw, hd) + 2.5 && Math.abs(z - sz) < Math.max(hw, hd) + 2.5) && !(x + hw > 90); /* Update 145: east-water guard (sydney water:'east', plain waterline 94; same 4u margin class as the extrasSet south clause; zero-churn verified by probe145) */
  const site = (x0, z0, hw, hd, rad = 12) => { let best = null; for (let dx = -rad; dx <= rad; dx += 1.5) for (let dz = -rad; dz <= rad; dz += 1.5) { const d = Math.hypot(dx, dz); if ((!best || d < best.d) && free(x0 + dx, z0 + dz, hw, hd)) best = { x: x0 + dx, z: z0 + dz, d }; } return best ? [best.x, best.z] : null; };
  { const q = site(X(151.21056), Z(-33.85222), 9, 3, 30); if (q) { const [x, z] = q; // Harbour Bridge: steel arch over a deck, two stone pylons
      nm(put(world, box(18, .4, 3, '#6b6f76'), x, 1.1 + 2.4, z)); for (const dx of [-8.5, 8.5]) put(world, box(1.6, 5.5, 2.2, '#b9a98a'), x + dx, 1.1 + 2.75, z);
      for (let k = -8; k <= 8; k += 2) { const h = 3.6 * (1 - (k / 9) ** 2); nm(put(world, box(.5, h + .5, .5, '#8a8f98'), x + k, 1.1 + 2.6 + (h + .5) / 2, z)); nm(put(world, box(2.1, .5, .5, '#8a8f98'), x + k, 1.1 + 2.6 + h + .5, z)); }
      colliders.push({ x, z, hw: 9, hd: 1.6 }); places.push({ name: 'Sydney Harbour Bridge-inspired arch', x, z: z + 4.5, r: 10 }); } }
  { const q = site(X(151.206666), Z(-33.871758), 8, 4, 30); if (q) { const [x, z] = q; // Queen Victoria Building: sandstone arcade with green copper domes
      put(world, box(16, 4.5, 7, '#d6b88c'), x, 1.1 + 2.25, z); for (const dx of [-5, 0, 5]) nm(put(world, cone(1.9, 2.4, 12, '#5f9f86'), x + dx, 1.1 + 5.7, z));
      colliders.push({ x, z, hw: 8, hd: 3.6 }); places.push({ name: 'Queen Victoria Building-inspired arcade', x, z: z + 5, r: 10 }); } }
  { const q = site(X(151.2089), Z(-33.8704), 4, 4, 14); if (q) { const [x, z] = q; // Sydney Tower: slim shaft, gold turret, antenna
      put(world, cyl(.5, .7, 14, 10, '#c9c2b0'), x, 1.1 + 7, z); nm(put(world, cyl(2, 1.3, 1.8, 12, '#d4af37'), x, 1.1 + 12.5, z)); nm(put(world, cyl(.08, .08, 4, 6, '#d8d8d8'), x, 1.1 + 16, z));
      colliders.push({ x, z, r: 1.6 }); places.push({ name: 'Sydney Tower-inspired spire', x, z: z + 3, r: 8 }); } }
}
const NEWCLEAR = { rio: [[-8.71, 31.75, 14], [63.65, -87.16, 13], [-80.4, 77.79, 13]], istanbul: [[15.69, -45.67, 13], [35.46, -76.81, 17], [-43.94, -60.66, 16], [-62, -62, 5] /* Update 143: Grand Bazaar window clearing - suppresses pickup slots (:2302, cr-1) and any scattered building (:2106) around the suppressed pavilion block; the pavilion plaza block itself is skipped parcel-locally in the quarter generator with stream-parity R draws */], /* Update 119: anchor-centered clearings to free the six batch sites (berlin/rome/jakarta precedent) */ tokyo: [[-83, -35, 15]], delhi: [[-58, -19, 15], [85.43, -3.21, 21]], /* Update 118z: free the three 118y real bearings (Main 8:06 conditional authorization - aggregate-only persistence verified by persistprobe) */ berlin: [[-60, 18, 16]], rome: [[-29, -39, 10]], london: [[-14, -75, 13]], madrid: [[-16, -19, 13], [-17, 15, 13], [25, 7, 15]], lima: [[-1, -40, 13]], jakarta: [[25, -63, 13], [40, -67, 9], [16, -63, 10]], lisbon: [[55, 55, 17], [43, 38, 11], [-14, -47, 13], [70, 85, 12]], amsterdam: [[7, 70, 13], [32, -17, 13], [67, -52, 13], [-64, 84, 13]], nairobi: [[-39, -15, 13]], /* Update 120: free the sourced anchors (probe120 audits, dev/HK-SOURCES.md) - riddarholmen: boxes (29.9,-14)/(30.4,-17.7)/(42.5,-10) flank the z=0/x=40 road-junction band; stortorget: on-anchor box (51.9,-8.9) + neighbors; ferry: on-anchor box (23.6,-59) */ stockholm: [[32, -8, 13], [53, -9, 13]], auckland: [[24, -60, 13]], /* Update 121: free the Bellas Artes north-strip - boxes (-57.5,-33.9)/(-56,-25)/(-63.8,-26)/(-66.4,-23.9) block the z>=-27 compliant band north of the z=-40 road (probe121 audit, dev/HK-SOURCES.md) */ mexicocity: [[-57, -32, 13]], lagosisland: [[47, -19, 9], [72.8, -2.1, 14], [87, 19, 7], [-31.5, -60, 5.5] /* Update 135: free the Balogun sourced transform's compliant strip - scattered-tree disc (-32.4,-64.4) r 3.16 (free() collider reach max(hw,hd)+r+1 = 8.66u blocks every pad center near the anchor) and slot (-30.08,-55.80) (|dz| 4.2 < hd+1.2) sit between the anchor and the road-limited compliant edge; rect covers both (tree <cr, slot <cr-1, probe135-measured); no building-box colliders inside the square (probe135 colliders<12u) */] }; /* Update 125b: second clearing frees the TBS design zone (boxes+slots); third frees the National Museum sourced transform (87.2,16.8) from generated box (87.2,20.8) hw4.1 hd3.7 (probe125c) - tree (88.7,6.3) r1.3 stays, passes with 0.3u measured margin */ /* Update 124: free Holy Cross Cathedral's EXACT sourced transform (41.6,-20) - generated boxes (46.8,-19.2) hw2.5 + (51.1,-19.4) hw3.4 block the z=-20 row (probe124 audit); boxes+slots only, trees/lamps untouched (deliberate scope). TBS never-sited class unaffected (its blockers are a road + tree/lamp discs, outside clearing scope) */
const SET_SLOTS = {lagosisland: [[-50.87,-63.82],[-5.32,-54.08],[-77.01,97.75],[3.58,26.29],[82.34,-84.12],[-16.74,-79.49],[-38.2,92.34],[-35.59,-55.29],[-47.89,-24.9],[-11.26,-54.25],[-79.35,13.86],[-2.65,7.6],[-43.28,-36.88],[56.03,2.25],[2.33,19.33],[-14.42,-55.15],[-12.46,49.45],[-83.98,-81.6],[9.49,85.96],[-21.17,-22.41],[55.88,-90.56],[-56.04,99.36],[-42.75,26.94],[-8.41,-49.92],[89.26,-82.98],[48.62,71.9],[-78.49,-64.98],[69.13,-76.91],[79.15,75.92],[0.72,79.99],[33.83,76.35],[-40.74,-58.24],[-100.31,4.29],[-44.38,49.79],[-38.02,35.97],[-2.99,-76.05],[76.57,55.03],[-54.28,63.49],[-40,-43.71],[26.58,40.11],[95.22,91.1],[89.49,7.79],[39.35,67.61],[-78.8,2.18],[41.59,-76.72],[-5.23,62.37],[-94.58,-8.74],[-30.87,-22.74],[53.4,35.7],[-26.9,29.74],[44.02,-2.51],[-89.2,45.68],[58.13,-27.28],[31.84,-75.37],[1.94,63.24],[18,-35.18],[-88.33,-21.42],[12.66,-27.83],[-38.61,-100.73],[-54.34,-64.8],[3.15,-65.87],[-64.68,96.25],[44.17,-71.32],[-73.38,27.16],[-33.26,-74.91],[80.18,-59.65],[-52.54,-45.84],[-8.64,-12.25],[-65.56,47.49],[-84.34,-79.93],[-3.14,97.87],[10.38,40.89],[-8.26,-30.08],[-55.8,-67.85],[26.28,-71.85],[-30.19,42.6],[-7.74,-30.78],[-15.78,-29.86],[-101.9,90.12],[-78.93,-70.57],[-12.51,-7.22],[2.04,1.31],[85.16,63.29],[-23.58,-78.15],[-1.28,-101.75],[83.15,38.21],[-73.13,-83.2],[-101.32,-82.96],[-48.22,75.82],[-45.16,-24.92],[14.31,-97.65],[-88.02,-78.21],[45.01,67.2],[-42.04,-88.97],[29.91,97.1],[-70.64,-74.52]]}; // static pickup slots (public/spots.json) that extras must not cover. Update 113: SET_SLOTS.moscow intentionally NOT refreshed to the regen 81-slot key - refreshing moves the accepted Spasskaya placement 3u (measured (-15.11,-20.29)->(-15.11,-23.29)); recorded limit in dev/HK-SOURCES.md
// Data-driven named places at real bearings from the landmark anchor (landmark spot (0,-26)); gameplay scale ~17 m per unit. kx = units per degree lon, nearest road-free/collider-free site within rad.
let extraStage = null; // stage footprint extras keep clear of (cut cities only)
let extraAvoid = null; // pool rect that extras keep clear of (set per build, only for cities with road cuts)
function extrasSet(world, colliders, places, roadAsphalt, cfg, list, inRiv) {
  const X = lo => (lo - cfg.lon) * cfg.kx, Z = la => -26 - (la - cfg.lat) * 6672, nm = g => { g.castShadow = false; return g; };
  const [wx0, wx1, wz0, wz1] = cfg.win || [-100, 100, -100, 98]; /* Update 147: per-cfg siting-window override - the default is byte-identical to the old |x|<100 / -100<z<98 clause; only cfgs declaring win are affected (kualalumpur: west edge -108, inside the +-110 playable square, recovers Central Market from the Main 9:13 mapping backlog) */
  const free = (x, z, hw, hd, rv) => !(extraStage && Math.abs(x - extraStage.x) < extraStage.w / 2 + 2 + hw && z + hd > extraStage.z - extraStage.d / 2 - 2 && z - hd < extraStage.z + extraStage.d / 2 + 14) && !(extraAvoid && Math.abs(x - extraAvoid.x) < extraAvoid.hw + hw + 2 && Math.abs(z - extraAvoid.z) < extraAvoid.hd + hd + 2) && !roadAsphalt(x, z, (cfg.tight ? Math.min(hw, hd) : Math.max(hw, hd)) + 1) && !colliders.some(c => !(extraStage && c.r !== undefined && c.r <= 1.5) && (c.hw !== undefined ? Math.abs(x - c.x) < hw + c.hw + 1 && Math.abs(z - c.z) < hd + c.hd + 1 : Math.hypot(x - c.x, z - c.z) < (cfg.tight ? Math.min(hw, hd) : Math.max(hw, hd)) + c.r + 1)) && x > wx0 && x < wx1 && z > wz0 && z < wz1 && !(cfg.slots || []).some(([sx, sz]) => Math.abs(x - sx) < hw + 1.2 && Math.abs(z - sz) < hd + 1.2) && !(cfg.water === 'south' && z + hd > 90) && !(cfg.water === 'east' && x + hw > 90) /* Update 145: east-water siting guard (auckland probe144a exposure: the plain east waterline S-6=94 was invisible to extrasSet free(); 90 mirrors the south clause's 4u margin). Only cfgs declaring water:'east' are affected (buenosaires/tokyo/istanbul/stockholm/auckland); zero-churn verified by probe145 - all 12 accepted placements pass with >=19.7u inside the line; ESH mumbai declares no cfg.water and is untouched (its shoreX is not visible here - recorded scope limit) */ && !(rv && inRiv && inRiv(x, z, (rv >= 2 ? 1 : 2) + Math.max(hw, hd))); /* Update 114: per-entry opt-in river-dry siting (e.rv) - a sourced landmark whose transform site falls inside the width-8 stylized band lands at the NEAREST DRY site toward its sourced position instead of inside drawn water (berlin cathedral, Main 12:38: resolve known visible intersection; sourced course/landmark positions stay distinct from stylized water width). Update 118o: rv>=2 = bank-side-preserving variant (margin 1+max instead of 2+max, plus the anchor->site line may not cross the drawn band - the 118n probe showed rv:1 can flip a landmark to the WRONG BANK when the anchor-side dry strip is blocked); rv:1 semantics unchanged */
  const crossesRiver = (x0, z0, x1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0)); for (let k = 1; k < n; k++) if (inRiv(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, 0)) return true; return false; }; /* 118o: anchor->site line must not cross the drawn band (bank preservation) */
  const site = (x0, z0, hw, hd, rad, rv) => { let best = null; for (let dx = -rad; dx <= rad; dx += 1.5) for (let dz = -rad; dz <= rad; dz += 1.5) { const d = Math.hypot(dx, dz); if ((!best || d < best.d) && free(x0 + dx, z0 + dz, hw, hd, rv) && !(rv >= 2 && inRiv && crossesRiver(x0, z0, x0 + dx, z0 + dz))) best = { x: x0 + dx, z: z0 + dz, d }; } return best ? [best.x, best.z] : null; };
  for (const e of list) { const q = e.pin || site(X(e.lon), Z(e.lat), e.hw, e.hd, e.rad || 14, e.rv); if (!q) continue; /* e.pin: hold a previously accepted placement at exact coordinates across slot-key/stream refreshes (Update 113a, Main 11:34 SET_SLOTS consistency: refresh the stale key WITHOUT moving accepted extras) */ const [x, z] = q;
    e.build(x, z, nm); if (e.r2) colliders.push({ x, z, r: e.r2 }); else if (e.col) colliders.push({ x: x + e.col[0], z: z + e.col[1], hw: e.col[2], hd: e.col[3] }); /* Update 137: e.col = collider override [dx,dz,hw,hd] for footprints whose sourced bbox centre differs from the pin */ else colliders.push({ x, z, hw: e.hw - .5, hd: e.hd - .5 }); places.push({ name: e.name, x, z: z + e.hd + 2, r: e.pr || 10 }); }
}
function extrasDubai(world, colliders, places, roadAsphalt) {
  extrasSet(world, colliders, places, roadAsphalt, { lon: 55.2742, lat: 25.1972, kx: 6000, slots: SET_SLOTS.dubai }, [
    { name: 'Dubai Fountain-inspired basin', lon: 55.27506, lat: 25.19518, hw: 6, hd: 6, rad: 18, build: (x, z, nm) => { nm(put(world, cyl(6, 6, .5, 24, '#cfd6d8'), x, 1.35, z)); nm(put(world, cyl(5.2, 5.2, .3, 24, '#3f9fd0', { roughness: .15, metalness: .1 }), x, 1.6, z)); for (const [dx, dz, h] of [[0, 0, 4], [-2.4, 1, 2.8], [2.4, 1, 2.8], [0, -2.4, 3.2]]) nm(put(world, cyl(.18, .3, h, 8, '#e8f4fa'), x + dx, 1.6 + h / 2, z + dz)); }, r2: 6 },
    { name: 'Dubai Mall-inspired arcade', lon: 55.27917, lat: 25.1975, hw: 9, hd: 4.5, rad: 18, build: (x, z, nm) => { put(world, box(18, 4, 9, '#d8d2c4'), x, 1.1 + 2, z); nm(put(world, box(18.4, .5, 9.4, '#b8c4c8'), x, 1.1 + 4.2, z)); for (let k = -3; k <= 3; k++) nm(put(world, box(1.6, 2.4, .2, '#8fb8d0', { emissive: '#4f88b0', emissiveIntensity: .25 }), x + k * 2.4, 1.1 + 1.6, z + 4.6)); } },
  ]);
}
function extrasMumbai(world, colliders, places, roadAsphalt) {
  extrasSet(world, colliders, places, roadAsphalt, { lon: 72.83466, lat: 18.92198, kx: 6270, slots: SET_SLOTS.mumbai }, [
    { name: 'Taj Mahal Palace-inspired hotel', lon: 72.8333, lat: 18.922, hw: 7, hd: 5, rad: 18, build: (x, z, nm) => { put(world, box(14, 6, 8, '#c98a6b'), x, 1.1 + 3, z); for (const dx of [-4.5, 4.5]) { put(world, box(3, 8, 3.2, '#b9715a'), x + dx, 1.1 + 4, z); nm(put(world, cone(1.9, 2.8, 12, '#8fa8a0'), x + dx, 1.1 + 9.4, z)); } nm(put(world, box(14.4, .4, 8.4, '#e8d5b0'), x, 1.1 + 6.2, z)); } },
  ]);
}
function extrasBangkok(world, colliders, places, roadAsphalt) {
  extrasSet(world, colliders, places, roadAsphalt, { lon: 100.48889, lat: 13.74361, kx: 6430, slots: SET_SLOTS.bangkok }, [
    { name: 'Wat Pho-inspired temple hall', lon: 100.49361, lat: 13.74639, hw: 7, hd: 4, rad: 18, pin: [25.85, -43.05], /* Update 118m: TRUE pre-river BUILD site (118k's pin was the probe's LABEL position, z+(hd+2) too far north; extraspos.mjs reports labels - corrected per Main 16:41). Dry: 19.9u from the course. */  build: (x, z, nm) => { put(world, box(14, 3.2, 7, '#e8d9b0'), x, 1.1 + 1.6, z); nm(put(world, box(14.6, .5, 7.6, '#c9503a'), x, 1.1 + 3.4, z)); nm(put(world, box(10, .5, 5, '#d9a63a'), x, 1.1 + 3.9, z)); for (const dx of [-5, 0, 5]) nm(put(world, cone(.9, 3.2, 8, '#e0b84a'), x + dx, 1.1 + 5.6, z)); } },
    { name: 'Grand Palace-inspired spires', lon: 100.492, lat: 13.7501, hw: 8, hd: 5, rad: 18, pin: [24.5, -54.3], /* Update 118m: TRUE pre-river BUILD site (118k label-position error, as Wat Pho). Dry: 25.5u from the course. */  build: (x, z, nm) => { put(world, box(16, 3, 8, '#efe6d0'), x, 1.1 + 1.5, z); for (const [dx, h] of [[-5, 7], [0, 9.5], [5, 7]]) { put(world, box(2.4, h * .5, 2.4, '#f2ead6'), x + dx, 1.1 + 3 + h * .25, z); nm(put(world, cone(1.5, h * .6, 8, '#d9a63a'), x + dx, 1.1 + 3 + h * .5 + h * .3, z)); } nm(put(world, box(16.4, .4, 8.4, '#c9503a'), x, 1.1 + 3.2, z)); } },
    { name: 'Giant Swing-inspired frame', lon: 100.50139, lat: 13.75194, hw: 4, hd: 3, rad: 18, pin: [77.38, -87.58], /* Update 118m: TRUE pre-river BUILD site (118k label-position error, as Wat Pho). Dry: 85.6u from the course. */  build: (x, z, nm) => { for (const dx of [-2.4, 2.4]) put(world, box(.5, 9, .5, '#b8321e'), x + dx, 1.1 + 4.5, z); nm(put(world, box(5.4, .5, .6, '#b8321e'), x, 1.1 + 9, z)); nm(put(world, box(.3, 4, .3, '#d9a63a'), x, 1.1 + 7, z)); } },
  ]);
}
function extrasBerlin(world, colliders, places, roadAsphalt, inRiv) {
  extrasSet(world, colliders, places, roadAsphalt, { lon: 13.40944, lat: 52.52083, kx: 4030, slots: SET_SLOTS.berlin }, [
    { name: 'Berlin Cathedral-inspired dome', lon: 13.40111, lat: 52.51917, hw: 6, hd: 5, rad: 18, rv: 1, pin: [-20.07, -22.42], /* Update 114: pinned at the verified dry 114 site (the reported place label sits hd+2 = 7u north at (-20.07,-15.42)) so the SET_SLOTS.berlin refresh below cannot re-site it across the slot-key change (113a moscow pin pattern); Update 114: transform site is 2.06u inside the stylized Spree band (real stem ~45-50m east of the real cathedral - width-8 stylization artifact, not a course error); rv sites the dome at the nearest dry site TOWARD the sourced position (Main 12:38) */ build: (x, z, nm) => { put(world, box(12, 4.5, 8, '#d8d0bc'), x, 1.1 + 2.25, z); put(world, cyl(2.8, 3.2, 3, 16, '#cfc7b0'), x, 1.1 + 6, z); nm(put(world, cone(3, 3, 16, '#6f9f88'), x, 1.1 + 8.9, z)); nm(put(world, cyl(.1, .1, 1.6, 6, '#d4af37'), x, 1.1 + 11, z)); } },
    { name: 'Gendarmenmarkt-inspired domed towers', lon: 13.39278, lat: 52.51361, hw: 8, hd: 4, rad: 18, pin: [-59.6, 23.7], /* Update 116 (Main 1:01 backlog class + 1:12 continue): restored at the measured compliant site the NEWCLEAR.berlin clearing (-60,18,16) freed - 7.6u from the sourced anchor (-67.1,22.2), inside the road-bounded block (roads x -81..-75/-45..-39, z -4..4/38..42; road margin 9 satisfied), dry; pinned so the SET_SLOTS.berlin refresh cannot re-site it (113a pattern). Never sited at the pre-116 accepted state (114 note) */ build: (x, z, nm) => { put(world, box(8, 4, 6, '#d6c8a8'), x, 1.1 + 2, z); for (const dx of [-6, 6]) { put(world, box(4, 5, 5, '#cfc0a0'), x + dx, 1.1 + 2.5, z); nm(put(world, cone(2.4, 3.6, 12, '#7f9f90'), x + dx, 1.1 + 6.8, z)); } } },
  ], inRiv);
}
function extrasMoscow(world, colliders, places, roadAsphalt) {
  extrasSet(world, colliders, places, roadAsphalt, { lon: 37.62306, lat: 55.7525, kx: 3740, slots: SET_SLOTS.moscow }, [
    { name: 'Spasskaya Tower-inspired clock tower', pin: [-15.11, -24.79], lon: 37.621425, lat: 55.752544, hw: 2.5, hd: 2.5, rad: 30, build: (x, z, nm) => { put(world, box(4, 9, 4, '#b8452e'), x, 1.1 + 4.5, z); put(world, box(4.4, 1.6, 4.4, '#d8cdb0'), x, 1.1 + 9.6, z); nm(put(world, cone(2.4, 5, 4, '#2f7a52'), x, 1.1 + 13, z)).rotation.y = Math.PI / 4; nm(put(world, cyl(1, 1, .2, 16, '#f0ead8'), x, 1.1 + 7.5, z + 2.1)).rotation.x = Math.PI / 2; } },
    { name: 'Kremlin wall-inspired battlements', pin: [-21.25, -20.46], lon: 37.61778, lat: 55.75167, hw: 9, hd: 1.2, rad: 30, build: (x, z, nm) => { put(world, box(18, 4, 1.6, '#b8452e'), x, 1.1 + 2, z); for (let k = -4; k <= 4; k++) nm(put(world, box(.9, .9, 1.6, '#b8452e'), x + k * 2, 1.1 + 4.4, z)); } },
  ]);
}
function extrasKL(world, colliders, places, roadAsphalt) {
  extrasSet(world, colliders, places, roadAsphalt, { lon: 101.7117, lat: 3.1578, kx: 6538, win: [-108, 100, -100, 98], slots: SET_SLOTS.kualalumpur }, [ /* Update 147 (mapping backlog, Main 9:13 class): anchor = Petronas Towers landmark at (0,-26); kx = 111320*cos(3.1578)/17. The win west edge -108 (inside the +-110 playable square, clamp lim 105) recovers Central Market (transform X -105.26 = 5.3u beyond the default window). Sultan Abdul Samad (X ~-112) stays mapping backlog - beyond the playable square. MediaWiki API coords 2026-10-30, dev/HK-SOURCES.md */
    { name: 'Central Market-inspired hall', lon: 101.6956, lat: 3.1458, hw: 3, hd: 3.5, rad: 14, pin: [-105.76, 52.06], /* probe147b: 2.06u S of the sourced transform (-105.26,54.06); hw8x4 and hw6x3 find NOTHING within rad 14/20 (edge-fabric building (-104.4,59.9) hw5/hd2.9 + tree discs (-100.4,47.8)/(-98.1,50.2) blanket the quadrant); honest smaller N-S hall, 123 Casa de Narino class. Real hall ~122m N-S x ~30m; 6x7u at 17m/u compresses the width ~3.4x - recorded schematic-presence compromise. Player clamp lim 105: stamp radius 10 covers the centre from the walkable edge (0.76u) */ build: (x, z, nm) => { put(world, box(6, 3.2, 7, '#f2ede0'), x, 1.1 + 1.6, z); nm(put(world, box(6.3, .4, 7.3, '#cfd8dc'), x, 1.1 + 3.4, z)); nm(put(world, box(.9, 1.2, 3, '#f2ede0'), x + 2.8, 1.1 + 3.9, z)); nm(put(world, box(1, 2.2, 2.6, '#9fc8e8'), x + 3.02, 1.1 + 1.1, z)); for (const dz of [-2.2, 0, 2.2]) nm(put(world, box(.2, 1.4, 1.5, '#9fc8e8'), x + 3.05, 1.1 + 2, z + dz)); } },
  ]);
}
function extrasSeoulBeijing(world, colliders, places, roadAsphalt, id) {
  if (id === 'seoul') extrasSet(world, colliders, places, roadAsphalt, { lon: 126.98828, lat: 37.55122, kx: 5250, slots: SET_SLOTS.seoul }, [
    { name: 'Namdaemun-inspired gate', lon: 126.97528, lat: 37.56, hw: 6, hd: 4, rad: 40, build: (x, z, nm) => { put(world, box(12, 3.2, 6, '#8f9086'), x, 1.1 + 1.6, z); nm(put(world, box(3.6, 2.2, 2.6, '#1f1f26'), x, 1.1 + 1.1, z + 2.7)); put(world, box(11, 2.4, 5.4, '#b04a38'), x, 1.1 + 4.4, z); nm(put(world, box(13.4, .6, 7, '#3a5a4a'), x, 1.1 + 6, z)); nm(put(world, box(8, 1.6, 4, '#a8402e'), x, 1.1 + 7, z)); nm(put(world, box(10.4, .5, 5.8, '#3a5a4a'), x, 1.1 + 8, z)); } },
  ]);
  else extrasSet(world, colliders, places, roadAsphalt, { lon: 116.39167, lat: 39.90333, kx: 5080, slots: SET_SLOTS.beijing }, [
    { name: 'Tiananmen-inspired gate tower', lon: 116.39108, lat: 39.90733, hw: 9, hd: 4, rad: 40, build: (x, z, nm) => { put(world, box(18, 4, 7, '#b4452f'), x, 1.1 + 2, z); nm(put(world, box(3, 2.4, 2.4, '#1f1f26'), x, 1.1 + 1.2, z + 3.6)); put(world, box(14, 2.8, 5, '#c8553a'), x, 1.1 + 5.4, z); nm(put(world, box(16.4, .7, 7, '#d4a63a'), x, 1.1 + 7.2, z)); nm(put(world, box(10, 1.4, 4, '#c8553a'), x, 1.1 + 8.2, z)); nm(put(world, box(11.4, .6, 5, '#d4a63a'), x, 1.1 + 9.2, z)); } },
  ]);
}
function extrasBA(world, colliders, places, roadAsphalt) {
  extrasSet(world, colliders, places, roadAsphalt, { lon: -58.38167, lat: -34.60361, kx: 5455, water: 'east', slots: SET_SLOTS.buenosaires }, [
    { name: 'Casa Rosada-inspired palace', lon: -58.37028, lat: -34.60806, hw: 6, hd: 3, rad: 30, pin: [57.63245, 18.6904], /* Update 117 (Main 1:01 backlog class + 1:12 continue): never-sited at the accepted state - the anchor block fails road+collider+slot across the whole rad-30 disc (measured 0 free at hw 8/hw 7). Shrunk to max dim 6 (same subject, honest smaller rendering - 116 Forum precedent): 12u facade, 5 columns, pink palace + white trim + flag. Sites at the measured nearest compliant point (57.63,18.69), 15.7u from the sourced anchor (62.13,3.69), road/slot/collider-clear; pinned so future SET_SLOTS refreshes cannot re-site it (113a pattern). Cathedral + Teatro pinned at their accepted sites FIRST so the new collider cannot move them */ build: (x, z, nm) => { put(world, box(12, 4, 6, '#e8a8b8'), x, 1.1 + 2, z); nm(put(world, box(12.4, .4, 6.4, '#f4eee4'), x, 1.1 + 4.2, z)); for (let k = -2; k <= 2; k++) nm(put(world, box(.9, 1.7, .2, '#f4eee4'), x + k * 2.4, 1.1 + 1.9, z + 3.1)); nm(put(world, cyl(.1, .1, 2.4, 6, '#d8d8d8'), x, 1.1 + 5.4, z)); } },
    { name: 'Buenos Aires Cathedral-inspired facade', lon: -58.37328, lat: -34.60741, hw: 6, hd: 4, rad: 30, pin: [26.26745, 14.3536], /* Update 117: pinned at the accepted placement (label at hd+2 = (26.27,20.35)) so the Casa Rosada restoration's new collider/stream change cannot re-site it (113a pattern) */ build: (x, z, nm) => { put(world, box(12, 5.5, 7, '#cdc6b4'), x, 1.1 + 2.75, z); for (let k = 0; k < 6; k++) nm(put(world, cyl(.4, .45, 4.6, 8, '#e4ddc8'), x - 4.5 + k * 1.8, 1.1 + 2.3, z + 3.8)); nm(put(world, box(12.4, .8, 1.2, '#b8b09a'), x, 1.1 + 5.2, z + 3.8)); } },
    { name: 'Teatro Colon-inspired opera house', lon: -58.38308, lat: -34.60108, hw: 7, hd: 5, rad: 30, pin: [-13.69155, -42.88016], /* Update 117: pinned at the accepted placement (label at hd+2 = (-13.69,-35.88)) so the Casa Rosada restoration cannot re-site it (113a pattern) */ build: (x, z, nm) => { put(world, box(14, 6, 9, '#d8c8aa'), x, 1.1 + 3, z); nm(put(world, box(14.4, .6, 9.4, '#8a7a62'), x, 1.1 + 6.2, z)); for (let k = -2; k <= 2; k++) nm(put(world, cyl(.35, .4, 4.2, 8, '#efe6d0'), x + k * 2.6, 1.1 + 2.1, z + 4.8)); } },
  ]);
}
function extrasNewCities(world, colliders, places, roadAsphalt, id, inRiv) { /* 118n: inRiv threaded so jakarta rv entries site river-dry (berlin/rome 114/115 pattern); only the jakarta list receives it - the other new-city lists have no rv entries */
  const stall = (x, z, c, nm) => { put(world, box(2.2, 1.4, 1.6, '#8a6a46'), x, 1.1 + .7, z); nm(put(world, box(2.8, .2, 2.2, c), x, 1.1 + 2.1, z)); };
  const park = (x, z, nm, w, d, pond) => { nm(put(world, box(w, .1, d, '#6fa35a'), x, 1.12, z)); if (pond) nm(put(world, cyl(pond, pond, .12, 18, '#4f9fc8', { roughness: .15 }), x + w * .2, 1.2, z + d * .1)); for (const [dx, dz] of [[-.35, -.3], [.35, -.3], [-.35, .32], [.4, .3]]) put(world, cone(1.1, 3, 8, '#3f8a4a'), x + dx * w, 1.1 + 1.5, z + dz * d); };
  if (id === 'bogotadowntown') extrasSet(world, colliders, places, roadAsphalt, { lon: -74.07524, lat: 4.59796, kx: 6525, slots: SET_SLOTS.bogotadowntown }, [
    /* Update 123 (Main 9:40 direction + 9:42 approval): ANCHORED-DISTRICT extras - the district's ONE anchor is the Primatial Cathedral landmark itself (plaza (0,-26)); every member sits at its EXACT sourced relative position (kx 6525, Z-per-lat 6672; MediaWiki API coords 2026-10-29, dev/HK-SOURCES.md 122/123). No translation, no free-pocket fitting. */
    { name: 'Gold Museum-inspired hall', lon: -74.072, lat: 4.60191944, hw: 6, hd: 4, rad: 14, pin: [17.6, -52.9], /* Update 123: 3.54u west of the sourced transform (21.1,-52.4) - a single r1.25 tree disc at (25.9,-53.7) fails the exact point by 2.3u of margin and trees are deliberately outside NEWCLEAR scope; recorded residual, bearing shift ~4deg */ build: (x, z, nm) => { put(world, box(12, 4.5, 8, '#cbb494'), x, 1.1 + 2.25, z); nm(put(world, box(12.4, .5, 8.4, '#7a6a52'), x, 1.1 + 4.7, z)); for (let k = -2; k <= 2; k++) nm(put(world, box(1.4, 2, .2, '#5a4a38', { emissive: '#3a2e1e', emissiveIntensity: .2 }), x + k * 2.4, 1.1 + 1.8, z + 4.1)); nm(put(world, cyl(1.1, 1.1, .25, 16, '#d4af37', { metalness: .4, roughness: .3 }), x, 1.1 + 3.2, z + 4.15)).rotation.x = Math.PI / 2; } },
    { name: 'Casa de Narino-inspired palace', lon: -74.0775, lat: 4.59555556, hw: 4, hd: 3.9, rad: 14, pin: [-14.7, -10], /* Update 123: EXACT at the sourced transform (116 Forum shrink precedent, same subject honest smaller rendering): at hw8 the generated box (-25.5,-10.2) + lamp discs (-20,-8.2)/(-20,-6.5)/(-23.3,-6.3) + slot (-15.73,-4.86) ring the point; hw4/hd3.9 clears lamp (-20,-8.2) by 0.1u and the slot by 0.04u - measured, probe123 */ build: (x, z, nm) => { put(world, box(8, 4, 7.6, '#e4dcc8'), x, 1.1 + 2, z); nm(put(world, box(8.4, .4, 8, '#b8ac90'), x, 1.1 + 4.2, z)); for (let k = -1; k <= 1; k++) nm(put(world, cyl(.3, .35, 3.4, 8, '#f4eee0'), x + k * 2.2, 1.1 + 1.7, z + 4)); nm(put(world, cyl(.08, .08, 2.4, 6, '#d8d8d8'), x, 1.1 + 5.4, z)); nm(put(world, box(1.3, .8, .06, '#f4c842'), x + .7, 1.1 + 6.1, z)); } },
  ]);
  if (id === 'lagosisland') extrasSet(world, colliders, places, roadAsphalt, { lon: 3.3902, lat: 6.4508, kx: 6507, slots: SET_SLOTS.lagosisland }, [
    /* Update 124 (Main 9:42 anchored-district mechanism + 9:54 continue-Lagos direction): ANCHORED-DISTRICT extras - the district's ONE anchor is the Cathedral Church of Christ landmark itself (plaza (0,-26)); members at sourced relative positions (kx 6507 = 17.0m/unit at 6.45N, Z-per-lat 6672 fixed in extrasSet; MediaWiki API coords 2026-10-29, dev/HK-SOURCES.md 124). Local transforms: TBS (72.8,-2.1), Holy Cross (41.6,-20.0), Tinubu (-5.2,-46.0). NOTE: the 122-session summary conflated 'Lagos Cathedral' names - 6.4508,3.3902 is the Cathedral Church of Christ (Marina); Holy Cross Cathedral is a different building at 6.4499,3.3966. Muson Centre (6.4548791,3.4245984) is ~224u E, off-window - backlog. No coords for National Museum Lagos / Freedom Park / Lagos City Hall / Balogun Market - backlog. */
    { name: 'Tafawa Balewa Square-inspired grandstand', lon: 3.40138889, lat: 6.44722222, hw: 11, hd: 9, rad: 14, pin: [72.8, -2.1], /* Update 125: SITED EXACT at the sourced MediaWiki transform (6.44722222,3.40138889) inside the designed RCUTS fabric + NEWCLEAR design zone (probe125: road-free, sole collider in the rect is its own box, Pool/stage/HC/Tinubu unchanged); pad 22x18u schematic-compresses the real 14.5ha square; the west grandstand is our arrangement (schematic); RCUTS rect caveat: the cut junction roads were NOT real streets */ build: (x, z, nm) => { nm(put(world, box(17, .15, 13, '#d8cba6'), x, 1.14, z)); for (let k = 0; k < 4; k++) put(world, box(16, .8, 1.8, '#c9b28a'), x, 1.5 + k * .8, z - 2.5 - k * 1.1); put(world, box(16.4, 1.6, 1.2, '#b89a6a'), x, 1.1 + 4.2, z - 6.5); } },
    { name: 'Holy Cross Cathedral-inspired church', lon: 3.3966, lat: 6.4499, hw: 4.8, hd: 3.9, rad: 14, pin: [41.6, -20.0], /* Update 124: EXACT at the sourced transform (116 Casa-class shrink, same subject honest smaller rendering; NEWCLEAR.lagosisland [47,-19,9] freed generated boxes (46.8,-19.2)/(51.1,-19.4), then one tree disc (47.4,-15.7) r1.25 - outside clearing scope by design - fails hw6 by 1.0u of margin, so hw4.8/hd3.9 clears it by 0.15u, probe124d-measured) */ build: (x, z, nm) => { put(world, box(9.2, 4.6, 7, '#e4d6b4'), x, 1.1 + 2.3, z); nm(put(world, cone(3.8, 2.2, 4, '#8a4a3a'), x, 1.1 + 5.7, z)).rotation.y = Math.PI / 4; for (const dx of [-3.7, 3.7]) { put(world, box(1.7, 6.6, 1.7, '#e4d6b4'), x + dx, 1.1 + 3.3, z + 2.6); nm(put(world, cone(1.2, 1.5, 4, '#8a4a3a'), x + dx, 1.1 + 7.3, z + 2.6)).rotation.y = Math.PI / 4; nm(put(world, box(.07, .6, .07, '#e8c766'), x + dx, 1.1 + 8.6, z + 2.6)); nm(put(world, box(.36, .07, .07, '#e8c766'), x + dx, 1.1 + 8.72, z + 2.6)); } /* Update 127: crosses on the tower caps */ for (const sg of [-1, 1]) for (const wx of [-2.8, 0, 2.8]) { nm(put(world, box(.7, 2, .12, '#3a3230'), x + wx, 1.1 + 2.2, z + sg * 3.56)); nm(put(world, box(.9, .24, .14, '#d8c8a0'), x + wx, 1.1 + 3.32, z + sg * 3.56)); } /* Update 127: nave side windows + lintels */ nm(put(world, box(1.2, 2.2, .14, '#3a3230'), x, 1.1 + 1.1, z + 3.56)); /* west door between the towers */ { const rose = put(world, cyl(.6, .6, .12, 10, '#e8c766'), x, 1.1 + 3.9, z + 3.56); nm(rose); rose.rotation.x = Math.PI / 2; } /* rose window */ for (const sg of [-1, 1]) { nm(put(world, box(.4, 3.4, .4, '#d8c8a0'), x - 1.4, 1.1 + 1.7, z + sg * 3.55)); nm(put(world, box(.4, 3.4, .4, '#d8c8a0'), x + 1.4, 1.1 + 1.7, z + sg * 3.55)); } /* buttress strips */ } },
    { name: 'Lagos City Hall-inspired hall', lon: 3.397143, lat: 6.4506523, hw: 5, hd: 3.5, rad: 12, pin: [45.2, -28.5], /* Update 125c: 3.5u N of the sourced transform (45.2,-25.0), x-exact held - the transform collides with Holy Cross's accepted exact box (real Lagos Island density exceeds our scale); the pinned site keeps the real ENE-of-HC bearing (probe125b); Nominatim coord (Catholic Mission Street, ODbL ledgered); measured residual, NOT exact */ build: (x, z, nm) => { put(world, box(9.2, 4.6, 6.2, '#e8dcc0'), x, 1.1 + 2.3, z); nm(put(world, box(9.6, .5, 6.6, '#c9bfa2'), x, 1.1 + 4.8, z)); for (let k = -2; k <= 2; k++) nm(put(world, cyl(.32, .36, 3.6, 8, '#f4ecd4'), x + k * 1.8, 1.1 + 1.8, z + 3)); put(world, box(2.2, 6.8, 2.2, '#e8dcc0'), x, 1.1 + 3.4, z - .8); nm(put(world, cone(1.5, 1.7, 4, '#7a6a52'), x, 1.1 + 7.6, z - .8)).rotation.y = Math.PI / 4; /* Update 127 (Main 10:42 landmark facade-detail backlog): wall detail - render-only, deterministic, collider unchanged */ for (const wy of [1.6, 3.2]) for (const wx of [-2.6, 0, 2.6]) nm(put(world, box(.6, .9, .1, '#3a3230'), x + wx, 1.1 + wy, z + 3.14)); /* punched windows behind the porch */ nm(put(world, box(1.1, 2, .12, '#3a3230'), x, 1.1 + 1, z + 3.14)); /* door */ { const clk = put(world, cyl(.5, .5, .1, 12, '#f4ecd4'), x, 1.1 + 5.4, z + .36); nm(clk); clk.rotation.x = Math.PI / 2; nm(put(world, box(.06, .5, .06, '#3a3230'), x, 1.1 + 5.4, z + .42)); nm(put(world, box(.34, .06, .06, '#3a3230'), x, 1.1 + 5.4, z + .42)); } /* clock face + hands on the tower front */ for (const sg of [-1, 1]) for (const wx of [-2.6, 2.6]) nm(put(world, box(.6, .9, .1, '#3a3230'), x + wx, 1.1 + 2.4, z + sg * 3.14)); /* side windows */ } },
    { name: 'Freedom Park-inspired memorial lawns', lon: 3.3965307, lat: 6.4488192, hw: 4, hd: 2.75, rad: 12, pin: [40.3, -12.7], /* Update 130 REFINEMENT (accepted-arrangement change, flagged for pixel review): re-pinned + pad 9x5 -> 6x3.4 so the SOURCED Broad St frontage (real: the park's NE boundary street, ~15-25m off) clears the pad by 0.10u drawn (probe130-measured; the roadAsphalt predicate's 1.42x diagonal inflation reports it blocked = conservative, not drawn). New residual 0.9u (was 1.6u at the 125c pin, which sat W of exact INTO the sourced way's path). HC clearance re-measured (dz 7.3 > 3.4+2.25+1); lamp (45,-8.2) clears by 1.01u. The 125c compression caveat stands, reduced; collider hw4/hd2.75 slightly proud of the lawn mesh (Casa class). */ /* Update 125c: 1.6u WSW of the sourced transform (41.2,-12.8) - exact is impossible at any honest size: the real 130m HC-FP gap compresses to 7.2u and HC's accepted exact box + 1u margins need 7.4u+ (probe125c); the pinned site PRESERVES the real bearing (Freedom Park sits ~due S of Holy Cross); park pad shrunk to 9x5u so the pair coexists - schematic-compression caveat, NOT a bearing break; Nominatim coord (ODbL ledgered) */ build: (x, z, nm) => park(x, z, nm, 6, 3.4, 1.3), pr: 7, r2: 0 },
    { name: 'National Museum-inspired gallery', lon: 3.403607, lat: 6.4443934, hw: 8, hd: 5, rad: 14, pin: [87.2, 16.8], col: [-0.55, -0.22, 5.35, 4.4], /* Update 137 (Main 00:07: resolve the NM pad/asphalt overlap from actual geometry): footprint corrected to the SOURCED polygon - OSM way 671991295, Nominatim polygon_geojson (ODbL ledgered dev/HK-SOURCES.md 137). Real local bbox x 81.5..91.8, z 12.4..20.7 -> main S bar (86.65,17.85) 10.3x5.7 + N wing (88.15,14.05) 5.7x3.1, NW pocket open as in the polygon (stylised two-box approximation, schematic not surveyed). The old 14x8 model (+14.4x8.4 trim) was oversized: rendered W face x 80.0 intruded 1.0u onto the x75..81 ring asphalt and the hw/hd collider (79.7) put a 1.3u invisible wall on the road (probeNM re-run 137). Corrected rendered W face 81.5 / collider W face 81.3 clear the asphalt edge (81) by 0.5/0.3u, matching the real building's ~8.7m standoff from the road W of it (reverse-geocode context: MUSON Access Rd/City Mall W, Military St N, King George V Rd E, Awolowo Rd address). Pin (87.2,16.8) UNCHANGED = sourced Nominatim centroid transform; the real bbox centre sits 0.6u SW of the centroid (normal for an irregular polygon) - col bridges the offset. hw/hd reservation (8x5: slot exclusion + place label) unchanged. Update 125c: EXACT at the sourced Nominatim transform after NEWCLEAR.lagosisland [[87,19,7]] freed generated box (87.2,20.8) (boxes+slots); Awolowo Rd, ODbL ledgered */ build: (x, z, nm) => { const ax = x - .55, az = z + 1.05, bx = x + .95, bz = z - 2.75; /* real-polygon bar centres vs the pin */ put(world, box(10.3, 4.5, 5.7, '#ddd2b8'), ax, 1.1 + 2.25, az); put(world, box(5.7, 4.5, 3.1, '#ddd2b8'), bx, 1.1 + 2.25, bz); nm(put(world, box(10.7, .5, 6.1, '#8a7a66'), ax, 1.1 + 4.7, az)); nm(put(world, box(6.1, .5, 3.5, '#8a7a66'), bx, 1.1 + 4.7, bz)); for (let k = -2; k <= 2; k++) nm(put(world, box(1.2, 2, .2, '#e8dcc0'), ax + k * 2, 1.1 + 1.8, az + 2.91)); /* entrance kept on the S face (Update 127) */ nm(put(world, box(1.5, 2.3, .14, '#3a3230'), ax, 1.1 + 1.15, az + 2.92)); for (const dx of [-1.5, 1.5]) nm(put(world, cyl(.3, .34, 3.2, 8, '#e8dcc0'), ax + dx, 1.1 + 1.6, az + 3.1)); } },
    { name: 'Balogun Market-inspired stalls', lon: 3.3851298888888888, lat: 6.455891888888889, hw: 4.5, hd: 4, rad: 12, pin: [-31.5, -60], /* Update 135: residual 2.83u -> 1.5u. Diagnosis (probe135): the transform (-33.0,-60.0) sits within the generated N-S road's pad-6 margin (asphalt pad0 edge x=-38; free() road check max(hw,hd)+1); the compliant strip starts x=-31 (hw5) / x=-31.5 (hw4.5, padscan). NEWCLEAR [-31.5,-60,5.5] clears the blocking tree disc + slot. Pad 9x7 -> 8x7 (stalls fit: right edge x+3.9 < x+4) buys the extra 0.5u toward the anchor. Drawn pad edge 2.5u off asphalt. Update 128: Wikidata Q25043268 P625 coord (6.455891888888889,3.3851298888888888, precision 0.000277778); NNW-of-anchor bearing class preserved; real Balogun is a sprawling street market - a stalls cluster stands for it schematically */ build: (x, z, nm) => { nm(put(world, box(8, .12, 7, '#d8cba6'), x, 1.14, z)); for (let k = 0; k < 6; k++) { const sx = x - 3 + (k % 3) * 3, sz = z - 1.6 + Math.floor(k / 3) * 3.2; put(world, box(1.8, 1.1, 1.4, '#c8b498'), sx, 1.1 + .67, sz); nm(put(world, box(2.2, .12, 1.8, ['#d9553a', '#3a8ae8', '#e8c43a'][k % 3]), sx, 1.1 + 1.85, sz)); } } },
    { name: 'Tinubu Square-inspired fountain square', lon: 3.3894, lat: 6.4538, hw: 5, hd: 5, rad: 14, pin: [-5.2, -46.0], /* Update 133 (Main 10:50 generic-road collisions are addressable via scoped fabric design): EXACT sourced transform - the 124 'transform limit' is CLOSED by the RCUTS avenue cut (residual 6.5u -> 0). Pin bypasses siting (the Broad St band's roadAsphalt margin would fail at 3.96u); the band ends flush at the pad's raised N apron (box top 1.22 > band .66, no z-fight) */ build: (x, z, nm) => { nm(put(world, box(9, .15, 9, '#d8cba6'), x, 1.14, z)); nm(put(world, cyl(1.8, 2, .7, 12, '#c9bfa2'), x, 1.5, z)); nm(put(world, cyl(1.4, 1.5, .4, 12, '#3f9fd0'), x, 1.85, z)); nm(put(world, cyl(.2, .3, 1.6, 8, '#c9bfa2'), x, 2.4, z)); for (const [px, pz] of [[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]]) { put(world, cyl(.16, .22, 2.6, 6, '#8a6a4a'), x + px, 1.1 + 1.3, z + pz); nm(put(world, cone(1.1, 1.6, 6, '#3a8a3a'), x + px, 1.1 + 3.4, z + pz)); } } },
  ]);

  if (id === 'nairobi') extrasSet(world, colliders, places, roadAsphalt, { lon: 36.82306, lat: -1.28861, kx: 6625, tight: 1, slots: SET_SLOTS.nairobi }, [
    { name: 'Nairobi Railway Station-inspired hall', lon: 36.82862, lat: -1.29166, hw: 7, hd: 4, rad: 20, pin: [39.34, -24.15], /* Update 118r: TRUE pre-river BUILD site (extraspos.mjs reports LABELS; label sits hd+2 = 6u at (39.34,-18.15) - 118m label-vs-build correction applied). The river R-stream shift moved ONE scattered tree (34,-29.5 r1.7) into free()'s 9.2u circ radius; the site itself is dry (59u from the course), road-margin-9 clear, slot-clear, and the tree stands 1.85u off the hall's south wall (no rendered overlap) - hold the accepted placement across the cascade (113a/118m pin pattern) */ build: (x, z, nm) => { put(world, box(14, 4, 7, '#d8c8a0'), x, 1.1 + 2, z); nm(put(world, box(14.6, .5, 7.6, '#8a4a30'), x, 1.1 + 4.2, z)); put(world, box(2.4, 7, 2.4, '#c8b080'), x - 5, 1.1 + 3.5, z); nm(put(world, cyl(.8, .8, .2, 14, '#f0ead8'), x - 5, 1.1 + 6, z + 1.3)).rotation.x = Math.PI / 2; } },
    { name: 'Uhuru Park-inspired lawn and lake', lon: 36.81722, lat: -1.29028, hw: 7, hd: 6, rad: 30, build: (x, z, nm) => park(x, z, nm, 14, 12, 3.2), pr: 11, r2: 0 },
  ]);
  if (id === 'jakarta') extrasSet(world, colliders, places, roadAsphalt, { lon: 106.82714, lat: -6.17539, kx: 6625, tight: 1, slots: SET_SLOTS.jakarta }, [
    { name: 'Istiqlal Mosque-inspired dome and minaret', lon: 106.83092, lat: -6.1698, hw: 8, hd: 6, rad: 34, rv: 2, pin: [18.04, -61.3], /* Update 118o: bank-side-preserving rv:2 dry site - WEST bank as sourced (anchor 5.97u west; the 118n rv:1 probe flipped east and was rejected). 13.26u from the centreline, wall 1.26u off the water edge, road margin 10.04>9 (x=8 N-S road); the last blocking scattered tree (13,-66) is cleared by the NEWCLEAR.jakarta addition + tree-loop clearing check. Moves 9u west of the 118l accepted pin (Main 16:41: overlap repair in scope, no blanket protection) */ /* Update 118l: pinned at the accepted pre-river BUILD site (probe reports the place LABEL at z+hd+2; build = label z-(hd+2) - 118l probe-semantics correction) so the Ciliwung def + SET_SLOTS.jakarta refresh cannot re-site it (113a/117/118k pattern); band overlap recorded in the def comment - preserved, Main's call on treatment */ build: (x, z, nm) => { put(world, box(14, 4, 10, '#eeeade'), x, 1.1 + 2, z); nm(put(world, cyl(4.2, 4.6, 1.2, 20, '#e4e0d4'), x, 1.1 + 4.6, z)); nm(put(world, cone(4.2, 3, 20, '#d8d8d0'), x, 1.1 + 6.7, z)); put(world, box(1.6, 14, 1.6, '#f4f0e6'), x + 7.5, 1.1 + 7, z - 3); nm(put(world, cone(1.1, 2.4, 8, '#d4af37'), x + 7.5, 1.1 + 15.2, z - 3)); } },
    { name: 'Jakarta Cathedral-inspired spires', lon: 106.83307, lat: -6.16926, hw: 6, hd: 4, rad: 20, rv: 2, pin: [43.29, -67.4], /* Update 118o: bank-side-preserving rv:2 dry site - EAST bank as sourced (anchor 8.29u east); 1.5u east of the 118l pin, corner overlap resolved */ /* Update 118l: pinned at the accepted pre-river BUILD site (label-vs-build correction as Istiqlal) (113a/117/118k pattern); band corner-overlap recorded in the def comment */ build: (x, z, nm) => { put(world, box(10, 4.5, 6, '#d8d4c8'), x, 1.1 + 2.25, z); for (const dx of [-3, 3]) { put(world, box(2, 8, 2, '#d0ccc0'), x + dx, 1.1 + 4, z + 2); nm(put(world, cone(1.3, 5, 4, '#6a7078'), x + dx, 1.1 + 10.5, z + 2)).rotation.y = Math.PI / 4; } } },
    { name: 'National Museum-inspired colonnade', lon: 106.8217, lat: -6.1761, hw: 8, hd: 4, rad: 20, pin: [-24.54, -30.76], /* Update 118l: pinned at the accepted pre-river BUILD site (label-vs-build correction as Istiqlal) (113a/117/118k pattern); 58u from the course - dry */ build: (x, z, nm) => { put(world, box(16, 4, 7, '#e8e0c8'), x, 1.1 + 2, z); nm(put(world, box(16.4, .5, 7.4, '#8a8272'), x, 1.1 + 4.2, z)); for (let k = -3; k <= 3; k++) nm(put(world, cyl(.35, .4, 3.8, 8, '#f4eedc'), x + k * 2.2, 1.1 + 1.9, z + 3.9)); } },
  ], inRiv);
  if (id === 'madrid') extrasSet(world, colliders, places, roadAsphalt, { lon: -3.68889, lat: 40.42, kx: 5040, tight: 1, slots: SET_SLOTS.madrid }, [
    { name: 'Cibeles Palace-inspired tower hall', lon: -3.69208, lat: 40.41891, hw: 8, hd: 5, rad: 20, build: (x, z, nm) => { put(world, box(16, 6, 8, '#eeeade'), x, 1.1 + 3, z); for (const dx of [-5, 5]) { put(world, box(3, 9, 3, '#e4e0d0'), x + dx, 1.1 + 4.5, z); nm(put(world, cone(2, 3.4, 4, '#6a7078'), x + dx, 1.1 + 10.7, z)).rotation.y = Math.PI / 4; } } },
    { name: 'Prado Museum-inspired gallery', lon: -3.6922, lat: 40.4139, hw: 9, hd: 4, rad: 20, build: (x, z, nm) => { put(world, box(18, 4.2, 7, '#d8b890'), x, 1.1 + 2.1, z); nm(put(world, box(18.4, .5, 7.4, '#6a6a60'), x, 1.1 + 4.4, z)); for (let k = -3; k <= 3; k++) nm(put(world, box(1.2, 2, .2, '#e8dcc0'), x + k * 2.4, 1.1 + 2, z + 3.6)); } },
    { name: 'Retiro Park-inspired lawn and pond', lon: -3.68389, lat: 40.415, hw: 10, hd: 8, rad: 22, build: (x, z, nm) => park(x, z, nm, 20, 16, 4.5), pr: 12, r2: 0 },
  ]);
  if (id === 'marrakesh') extrasSet(world, colliders, places, roadAsphalt, { lon: -7.99354, lat: 31.62412, kx: 5640, slots: SET_SLOTS.marrakesh }, [
    { name: 'Jemaa el-Fnaa-inspired market square', lon: -7.98944, lat: 31.62583, hw: 9, hd: 8, rad: 20, build: (x, z, nm) => { nm(put(world, box(18, .12, 16, '#d8b888'), x, 1.14, z)); [[-6, -5, '#c8452e'], [-2, -5, '#e8c050'], [2, -5, '#2f7a52'], [6, -5, '#c8452e'], [-6, 5, '#e8c050'], [-2, 5, '#c8452e'], [2, 5, '#e8c050'], [6, 5, '#2f7a52']].forEach(([dx, dz, c]) => stall(x + dx, z + dz, c, nm)); }, pr: 11, r2: 0 },
    { name: 'Bahia Palace-inspired courtyard', lon: -7.98223, lat: 31.62159, hw: 8, hd: 6, rad: 20, build: (x, z, nm) => { for (const [dx, dz, w, d] of [[0, -5, 16, 1.4], [0, 5, 16, 1.4], [-7.5, 0, 1.4, 10], [7.5, 0, 1.4, 10]]) put(world, box(w, 3.4, d, '#d9a878'), x + dx, 1.1 + 1.7, z + dz); nm(put(world, box(13, .1, 8.6, '#c8b090'), x, 1.14, z)); nm(put(world, cyl(1.6, 1.6, .3, 12, '#4f9fc8'), x, 1.25, z)); }, r2: 0 },
  ]);
  if (id === 'lisbon') extrasSet(world, colliders, places, roadAsphalt, { lon: -9.15, lat: 38.72528, kx: 5207, tight: 1, water: 'south', slots: SET_SLOTS.lisbon }, [
    { name: 'Rossio-inspired Pedro IV column square', lon: -9.13944, lat: 38.71389, hw: 5, hd: 5, rad: 14, build: (x, z, nm) => { nm(put(world, box(10, .15, 10, '#d8d0bc'), x, 1.15, z)); put(world, cyl(1.4, 1.6, 1.4, 10, '#d8d0b8'), x, 1.9, z); put(world, cyl(.6, .7, 7, 10, '#e4dcc4'), x, 5.2, z); nm(put(world, cone(.8, 1.4, 6, '#b8b4a0'), x, 9.4, z)); nm(put(world, cyl(2.2, 2.4, .6, 12, '#bfc6cc'), x + 3.6, 1.4, z + 3.2)); } },
    { name: 'Santa Justa Lift-inspired iron tower', lon: -9.13944, lat: 38.71222, hw: 2.5, hd: 2.5, rad: 14, build: (x, z, nm) => { for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) put(world, box(.5, 14, .5, '#4a4036'), x + dx, 1.1 + 7, z + dz); for (const h of [4, 8, 12]) nm(put(world, box(2.9, .3, 2.9, '#5a4e42'), x, 1.1 + h, z)); put(world, box(3.4, .5, 3.4, '#3a322a'), x, 1.1 + 14.2, z); nm(put(world, box(1.8, 2, 1.8, '#6a5c4a'), x, 1.1 + 15.4, z)); } },
    { name: 'Restauradores-inspired obelisk', lon: -9.14167, lat: 38.71583, hw: 3, hd: 3, rad: 14, build: (x, z, nm) => { put(world, box(5, .8, 5, '#d4ccb4'), x, 1.5, z); put(world, box(1.6, 9, 1.6, '#e6dec6'), x, 6.3, z); nm(put(world, cone(1, 1.6, 4, '#c9a84a'), x, 11.6, z)); } },
    { name: 'Eduardo VII Park-inspired lawn and pond', lon: -9.152778, lat: 38.728333, hw: 7, hd: 6, rad: 14, build: (x, z, nm) => park(x, z, nm, 14, 12, 3.2), pr: 11, r2: 0 },
    { name: 'Rua Augusta Arch-inspired gateway', lon: -9.1368, lat: 38.7084, hw: 6, hd: 2.5, rad: 12, build: (x, z, nm) => { for (const dx of [-4.2, 4.2]) put(world, box(2.4, 8, 2.4, '#e8dcc0'), x + dx, 1.1 + 4, z); put(world, box(11, 2.4, 2.8, '#e4d8bc'), x, 1.1 + 8.6, z); nm(put(world, box(4, 1.6, 2.4, '#cfc2a2'), x, 1.1 + 10.6, z)); nm(put(world, box(5.6, 3.4, 2, '#2a2a30'), x, 1.1 + 1.7, z)); } },
  ]);
  if (id === 'amsterdam') extrasSet(world, colliders, places, roadAsphalt, { lon: 4.88361, lat: 52.37444, kx: 4076, tight: 1, slots: SET_SLOTS.amsterdam }, [
    { name: 'Rijksmuseum-inspired brick gallery', lon: 4.8853, lat: 52.36, hw: 9, hd: 4, rad: 16, build: (x, z, nm) => { put(world, box(18, 6, 7, '#a8503a'), x, 1.1 + 3, z); for (const dx of [-7, 7]) { put(world, box(3, 9, 4, '#9a4632'), x + dx, 1.1 + 4.5, z); nm(put(world, cone(2.2, 2.6, 4, '#3a4a58'), x + dx, 1.1 + 10.3, z)); } nm(put(world, box(3.4, 3.4, 7.4, '#2a2a30'), x, 1.1 + 1.7, z)); nm(put(world, box(18.4, .5, 7.4, '#d4c8b0'), x, 1.1 + 6.2, z)); } },
    { name: 'Royal Palace-inspired Dam hall', lon: 4.89136, lat: 52.37317, hw: 8, hd: 4, rad: 16, build: (x, z, nm) => { put(world, box(16, 5, 8, '#d8d0b8'), x, 1.1 + 2.5, z); nm(put(world, box(16.4, .5, 8.4, '#b8b09a'), x, 1.1 + 5.2, z)); nm(put(world, cyl(1.6, 1.8, 2, 10, '#cfc8b0'), x, 1.1 + 6.5, z)); nm(put(world, cone(1.9, 2, 10, '#5a7a68'), x, 1.1 + 8.5, z)); } },
    { name: 'Amsterdam Centraal-inspired station', lon: 4.9, lat: 52.37833, hw: 10, hd: 3.5, rad: 16, build: (x, z, nm) => { put(world, box(20, 5, 6, '#a8502e'), x, 1.1 + 2.5, z); for (const dx of [-7, 7]) { put(world, box(3, 8, 3.4, '#9a4632'), x + dx, 1.1 + 4, z); nm(put(world, cone(2.2, 2.4, 4, '#3a4a58'), x + dx, 1.1 + 9.2, z)); } nm(put(world, box(8, 3, .4, '#e8e0cc'), x, 1.1 + 3.5, z + 3.1)); } },
    { name: 'Vondelpark-inspired lawn and pond', lon: 4.868, lat: 52.358, hw: 7, hd: 6, rad: 14, build: (x, z, nm) => park(x, z, nm, 14, 12, 3.2), pr: 11, r2: 0 },
  ]);
  if (id === 'lima') extrasSet(world, colliders, places, roadAsphalt, { lon: -77.02972, lat: -12.04694, kx: 6480, tight: 1, slots: SET_SLOTS.lima }, [
    { name: 'Government Palace-inspired plaza hall', lon: -77.0298, lat: -12.0448, hw: 9, hd: 4, rad: 20, pin: [-1.0184, -40.77808], /* Update 118 prep: pinned at the accepted placement (label at hd+2 = (-1.02,-34.78)) ahead of the Rimac river-def stream shift (113a pattern); no visual change at the pre-river state */ build: (x, z, nm) => { put(world, box(18, 5, 8, '#e4d4a8'), x, 1.1 + 2.5, z); nm(put(world, box(18.4, .5, 8.4, '#b89a62'), x, 1.1 + 5.2, z)); for (const dx of [-5, 0, 5]) nm(put(world, box(3, 2.6, .5, '#6a4a2a'), x + dx, 1.1 + 2.4, z + 4.2)); nm(put(world, box(5, 2, 8.2, '#d8c690'), x, 1.1 + 6.4, z)); } },
    { name: 'San Francisco Basilica-inspired church', lon: -77.02739, lat: -12.0455, hw: 7, hd: 5, rad: 20, pin: [16.0984, -36.10768], /* Update 118 prep: pinned at the accepted placement (label (16.1,-29.11)) ahead of the Rimac def (113a pattern) */ build: (x, z, nm) => { put(world, box(12, 6, 8, '#e0b84e'), x, 1.1 + 3, z); for (const dx of [-4, 4]) { put(world, box(2.6, 9, 2.6, '#d4a840'), x + dx, 1.1 + 4.5, z + 2.5); nm(put(world, cone(1.8, 3, 4, '#8a6a3a'), x + dx, 1.1 + 10.5, z + 2.5)).rotation.y = Math.PI / 4; } } },
    { name: 'Torre Tagle-inspired balcony house', lon: -77.02931, lat: -12.04884, hw: 6, hd: 4, rad: 20, pin: [12.6568, -16.8232], /* Update 118 prep: pinned at the accepted placement (label (12.66,-10.82)) ahead of the Rimac def (113a pattern) */ build: (x, z, nm) => { put(world, box(12, 5, 7, '#f0e8d0'), x, 1.1 + 2.5, z); nm(put(world, box(5, 2.6, 1.4, '#6a3a22'), x, 1.1 + 3.4, z + 4)); nm(put(world, box(12.4, .5, 7.4, '#a8683a'), x, 1.1 + 5.2, z)); } },
  ]);
  if (id === 'tokyo') extrasSet(world, colliders, places, roadAsphalt, { lon: 139.74556, lat: 35.65861, kx: 5320, water: 'east', slots: SET_SLOTS.tokyo }, [ /* Update 118y: sourced places batch (MediaWiki API 2026-10-29, dev/HK-SOURCES.md); anchor = Tokyo Tower landmark at (0,-26); kx = 111320*cos(35.6586)/17 */
    { name: 'Zojoji-inspired temple hall', lon: 139.748376, lat: 35.657479, hw: 8, hd: 5, rad: 18, pin: [16.48, -21.45], /* Update 118z: hold the accepted 118y-rev placement (user-previewed) across the tokyo slot-key regen (113a pattern) */ build: (x, z, nm) => { put(world, box(18, .5, 12, '#9a8f80'), x, 1.1 + .25, z); for (const dx of [-6, -2, 2, 6]) put(world, box(.5, 4.5, .5, '#c8482e'), x + dx, 1.1 + .5 + 2.25, z + 5.6); put(world, box(16, 4.5, 10, '#d8ccb8'), x, 1.1 + .5 + 2.25, z); nm(put(world, box(16.2, .6, .3, '#c8482e'), x, 1.1 + .5 + 4.2, z + 5.1)); nm(put(world, box(17.6, 1.1, 11.6, '#3f4a52'), x, 1.1 + .5 + 4.5 + .55, z)); nm(put(world, box(12, .9, 8, '#3f4a52'), x, 1.1 + .5 + 5.6 + .45, z)); } },
    { name: 'Atago Shrine-inspired hill shrine', lon: 139.748421, lat: 35.664772, hw: 6, hd: 4, rad: 18, pin: [22.72, -64.11], /* Update 118z: hold the accepted 118y placement across the regen (113a pattern) */ build: (x, z, nm) => { nm(put(world, box(10, .6, 7, '#8f8a80'), x, 1.1 + .3, z)); put(world, box(6, 3, 4.5, '#8a4a3a'), x, 1.1 + .6 + 1.5, z - .8); nm(put(world, box(7, .8, 5.5, '#3f4a52'), x, 1.1 + .6 + 3 + .4, z - .8)); for (const dx of [-1.6, 1.6]) put(world, box(.4, 3, .4, '#c8402a'), x + dx, 1.1 + 1.5, z + 3.4); nm(put(world, box(4.6, .35, .5, '#c8402a'), x, 1.1 + 3 + .18, z + 3.4)); nm(put(world, box(3.8, .3, .4, '#c8402a'), x, 1.1 + 2.3, z + 3.4)); } },
    { name: 'Roppongi Hills-inspired tower cluster', lon: 139.73, lat: 35.66, hw: 6, hd: 6, rad: 40, build: (x, z, nm) => { put(world, box(9, 16, 9, '#8fa8b8'), x, 1.1 + 8, z); for (const dx of [-2.8, 0, 2.8]) nm(put(world, box(.7, 14, .2, '#dce8f0'), x + dx, 1.1 + 8, z + 4.56)); nm(put(world, box(9.4, .8, 9.4, '#d8e2e8'), x, 1.1 + 16 + .4, z)); put(world, box(6, 3.5, 6, '#9ab0bc'), x, 1.1 + 16.8 + 1.75, z); put(world, box(4, 6, 4, '#a4b6c2'), x + 4.5, 1.1 + 3, z + 4); } },
  ]);
  if (id === 'delhi') extrasSet(world, colliders, places, roadAsphalt, { lon: 77.22931, lat: 28.61286, kx: 5750, slots: SET_SLOTS.delhi }, [ /* Update 118y: sourced places batch (MediaWiki API 2026-10-29, dev/HK-SOURCES.md); anchor = India Gate landmark at (0,-26); kx = 111320*cos(28.6129)/17 */
    { name: 'National Museum-inspired gallery', lon: 77.219262, lat: 28.611811, hw: 9, hd: 4, rad: 40, build: (x, z, nm) => { nm(put(world, box(19, .4, 9, '#b8ac92'), x, 1.1 + .2, z)); nm(put(world, box(18.5, .4, 8.4, '#c0b49a'), x, 1.1 + .6, z)); put(world, box(18, 4.5, 7, '#d8cbb0'), x, 1.1 + .8 + 2.25, z); nm(put(world, box(18.6, .5, 7.6, '#b0a48c'), x, 1.1 + .8 + 4.5 + .25, z)); for (const dx of [-6.5, -3.9, -1.3, 1.3, 3.9, 6.5]) put(world, box(1.1, 1.4, .18, '#7a6a52'), x + dx, 1.1 + .8 + 2.9, z + 3.56); for (const dx of [-2.4, -.8, .8, 2.4]) put(world, cyl(.32, .38, 3.6, 8, '#e8dcc4'), x + dx, 1.1 + .8 + 1.8, z + 4.6); nm(put(world, box(6.4, .5, 3, '#c9bca0'), x, 1.1 + .8 + 3.6 + .25, z + 4.1)); nm(put(world, box(4.5, 1, .5, '#b8ac92'), x, 1.1 + .8 + 4.1 + .5, z + 4.2)); put(world, box(1.8, 2.6, .2, '#5a4a3a'), x, 1.1 + .8 + 1.3, z + 3.56); } },
    { name: 'Modern Art Gallery-inspired hall', lon: 77.234401, lat: 28.610182, hw: 8, hd: 4, rad: 18, pin: [26.27, -14.13], /* Update 118z: hold the accepted 118y-rev placement across the delhi slot-key regen (113a pattern) */ build: (x, z, nm) => { put(world, box(16, 4, 7, '#e3d7c2'), x, 1.1 + 2, z); nm(put(world, box(16.3, 1.5, 7.3, '#4f7a9c'), x, 1.1 + 2.7, z)); nm(put(world, box(16.5, .35, 7.5, '#c9bda6'), x, 1.1 + 4 + .18, z)); for (const dx of [-1.8, 0, 1.8]) put(world, cyl(.3, .35, 3.2, 8, '#e8dcc4'), x + dx, 1.1 + 1.6, z + 4.5); nm(put(world, box(5.4, .45, 2.6, '#d8cbb0'), x, 1.1 + 3.2 + .23, z + 4.1)); put(world, box(1.6, 2.4, .2, '#4a3f36'), x, 1.1 + 1.2, z + 3.56); } },
    { name: 'Purana Qila-inspired old fort walls', lon: 77.24416667, lat: 28.60944444, hw: 9, hd: 5, rad: 40, build: (x, z, nm) => { put(world, box(16, 3.5, 1.2, '#a8765a'), x, 1.1 + 1.75, z + 4); put(world, box(16, 3.5, 1.2, '#a8765a'), x, 1.1 + 1.75, z - 4); for (const dx of [-8, 8]) put(world, box(1.2, 3.5, 8, '#a8765a'), x + dx, 1.1 + 1.75, z); for (let k = -7; k <= 7; k += 2) { put(world, box(1, .7, 1.1, '#9a6a50'), x + k, 1.1 + 3.85, z + 4); put(world, box(1, .7, 1.1, '#9a6a50'), x + k, 1.1 + 3.85, z - 4); } put(world, box(4, 5, 2.4, '#b5856a'), x, 1.1 + 2.5, z + 4.2); put(world, box(1.8, 2.8, .3, '#6a4a38'), x, 1.1 + 1.4, z + 5.36); nm(put(world, box(4.6, .5, 3, '#9a6a50'), x, 1.1 + 5 + .25, z + 4.2)); for (const dx of [-1.6, 1.6]) { put(world, box(.5, 1.2, .5, '#b5856a'), x + dx, 1.1 + 5.5 + .6, z + 4.2); nm(put(world, cone(.9, .9, 8, '#c9957a'), x + dx, 1.1 + 6.7 + .45, z + 4.2)); } for (const dx of [-7, 7]) { nm(put(world, cyl(1.4, 1.4, 4.5, 10, '#a8765a'), x + dx, 1.1 + 2.25, z + 4)); nm(put(world, cyl(1.7, 1.7, .6, 10, '#9a6a50'), x + dx, 1.1 + 4.5 + .3, z + 4)); } } },
  ]);
  if (id === 'rio') extrasSet(world, colliders, places, roadAsphalt, { lon: -43.21055556, lat: -22.95194444, kx: 6030, water: 'south', slots: SET_SLOTS.rio }, [ /* Update 119: sourced places batch (MediaWiki API coords pre-fetched 2026-10-29, dev/HK-SOURCES.md); anchor = Christ the Redeemer landmark at (0,-26); kx = 111320*cos(-22.9519)/17. Rodrigo de Freitas Lagoon candidate SKIPPED: Z +101.9 lands in the south sea band */
    { name: 'Parque Lage-inspired mansion', lon: -43.212, lat: -22.9606, hw: 9, hd: 5, rad: 26, /* Update 119: anchor boxed by the x=0 N-S road + cafe-cluster blanket west; the compliant gap starts dx 19 (east of the road) - rad 26 reaches it; offset recorded in dev/HK-SOURCES.md */ build: (x, z, nm) => { put(world, box(16, 4, 8, '#e8dcc0'), x, 1.1 + 2, z); nm(put(world, box(16.4, .5, 8.4, '#d4c6a6'), x, 1.1 + 4.25, z)); for (const dx of [-6, -3, 0, 3, 6]) put(world, box(.5, 3, .5, '#f0e6cc'), x + dx, 1.1 + 1.5, z + 4.6); nm(put(world, box(14.5, .7, 1.2, '#f0e6cc'), x, 1.1 + 3.35, z + 4.6)); put(world, box(4, 6.5, 4, '#e0d2b2'), x, 1.1 + 3.25, z - 1); nm(put(world, box(4.4, .6, 4.4, '#b84838'), x, 1.1 + 6.5 + .3, z - 1)); nm(put(world, box(6, .15, 3, '#7fb8d8'), x, 1.1 + .1, z + 8.5)); } },
    { name: 'Cosme Velho station-inspired rail hall', lon: -43.2, lat: -22.94277778, hw: 7, hd: 4, rad: 18, build: (x, z, nm) => { put(world, box(14, .5, 6, '#b8b0a0'), x, 1.1 + .25, z); put(world, box(9, 3.5, 4, '#d8c8a8'), x - 1, 1.1 + .5 + 1.75, z); nm(put(world, box(9.6, .6, 4.6, '#8a5a3a'), x - 1, 1.1 + 4 + .3, z)); nm(put(world, box(6.5, .7, 3, '#7a4c32'), x - 1, 1.1 + 4.6 + .35, z)); nm(put(world, cyl(.6, .6, .25, 12, '#f4f0e0'), x - 1, 1.1 + 3.2, z + 2.05)); for (const dx of [-5.5, 4.5]) put(world, box(.3, 2.6, .3, '#7a8a92'), x + dx, 1.1 + 1.8, z + 2.2); nm(put(world, box(12, .3, 2.6, '#8a9aa2'), x - .5, 1.1 + 3.25, z + 2.2)); } },
    { name: 'Botanical Garden-inspired palm allee', lon: -43.22388889, lat: -22.9675, hw: 7, hd: 3, rad: 18, /* Update 144: SITED at (-90.9,77.79), 10.5u due WEST of the sourced anchor (-80.4,77.79). Diagnosis (probe143d/e/f, corrected post-143 full-fabric method): the anchor sits at the ring-road CORNER - the x+-78 and z+-78 corridors (pad max+1=9) blanket it together with the promenade/tree discs; 0 free at hw8. Reservation trimmed 8x4 -> 7x3 to the honest drawn footprint (was oversized: drawn pad 15x3 + palms +-2.7 + gate +-7.6; now pad 13.8, palms 7/row at 1.8 spacing, gate inboard x+6.5; drawn 6.9x2.7 vs reservation 7x3, collider 6.5x2.5 - drawn-overhang Casa/FreedomPark class). Site bound EAST by the ring-x corridor margin (drawn E face 2u off the margin edge, 7.9u off asphalt) and WEST by two r1.25 tree discs (-100.9,76.1)/(-101.1,81.4) at 10.1u. Residual road-margin/tree-bound, measured, NOT exact. No NEWCLEAR, no furniture moves, no R/stream change. */ build: (x, z, nm) => { nm(put(world, box(13.8, .12, 3, '#c9b98f'), x, 1.1 + .06, z)); for (const dx of [-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4]) for (const dz of [-1.6, 1.6]) { put(world, cyl(.14, .2, 5.5, 5, '#8a6a4a'), x + dx, 1.1 + 2.75, z + dz); nm(put(world, cone(1.1, .9, 6, '#3f8a3a'), x + dx, 1.1 + 5.8, z + dz)); } for (const dz of [-1.9, 1.9]) put(world, box(.8, 2.8, .8, '#e0d4b4'), x + 6.5, 1.1 + 1.4, z + dz); nm(put(world, box(.6, .5, 4.6, '#e0d4b4'), x + 6.5, 1.1 + 3.05, z)); } }
  ]);
  if (id === 'istanbul') extrasSet(world, colliders, places, roadAsphalt, { lon: 28.9768247, lat: 41.0053851, kx: 4942, water: 'east', slots: SET_SLOTS.istanbul }, [ /* Update 119: sourced places batch (MediaWiki API coords pre-fetched 2026-10-29, dev/HK-SOURCES.md); anchor = Blue Mosque landmark at (0,-26); kx = 111320*cos(41.0054)/17. Basilica Cistern + Hippodrome DEFERRED: sites 11u/12u from the Hagia Sophia site - footprints+margins collide */
    { name: 'Hagia Sophia-inspired great dome', lon: 28.98, lat: 41.00833333, hw: 9, hd: 6, rad: 30, build: (x, z, nm) => { put(world, box(14, 5, 10, '#c8b49a'), x, 1.1 + 2.5, z); nm(put(world, box(14.4, .5, 10.4, '#b8a68a'), x, 1.1 + 5.25, z)); const d = put(world, sph(4.2, '#a8907a'), x, 1.1 + 6.2, z); d.scale.y = .62; nm(d); for (const dx of [-4.6, 4.6]) { const h = put(world, sph(2.4, '#b09a82'), x + dx, 1.1 + 5.8, z); h.scale.y = .55; nm(h); } for (const [dx, dz] of [[-6.4, -4.4], [6.4, -4.4], [-6.4, 4.4], [6.4, 4.4]]) { put(world, cyl(.45, .55, 9, 8, '#ddd0b6'), x + dx, 1.1 + 4.5, z + dz); nm(put(world, cone(.65, 1.6, 8, '#b0a48c'), x + dx, 1.1 + 9.8, z + dz)); } } },
    { name: 'Topkapi-inspired palace court', lon: 28.984, lat: 41.013, hw: 9, hd: 6, rad: 30, build: (x, z, nm) => { put(world, box(15, 2, .9, '#c9b694'), x, 1.1 + 1, z + 4.5); put(world, box(15, 2, .9, '#c9b694'), x, 1.1 + 1, z - 4.5); for (const dx of [-7, 7]) put(world, box(.9, 2, 9, '#c9b694'), x + dx, 1.1 + 1, z); put(world, box(5, 3, 4, '#ddd0b6'), x - 3, 1.1 + 1.5, z - 1); const d1 = put(world, sph(1.8, '#8fa8b8'), x - 3, 1.1 + 3.6, z - 1); d1.scale.y = .7; nm(d1); put(world, box(4, 2.6, 3.4, '#d8c8a8'), x + 3.5, 1.1 + 1.3, z + 1); const d2 = put(world, sph(1.4, '#97a06a'), x + 3.5, 1.1 + 3.1, z + 1); d2.scale.y = .7; nm(d2); put(world, cyl(1, 1.3, 8, 10, '#e4d8bc'), x + 5.5, 1.1 + 4, z - 3); nm(put(world, cone(1.6, 2.6, 10, '#6a7a8a'), x + 5.5, 1.1 + 9.3, z - 3)); } },
    { name: 'Grand Bazaar-inspired covered market', lon: 28.96793333, lat: 41.01058056, hw: 9, hd: 5, rad: 30, build: (x, z, nm) => { put(world, box(16, 4, 8, '#d8c0a0'), x, 1.1 + 2, z); nm(put(world, box(16.4, .5, 8.4, '#c0aa88'), x, 1.1 + 3.9, z)); for (const dz of [-2, 2]) for (const dx of [-6.4, -3.2, 0, 3.2, 6.4]) { const d = put(world, sph(1.1, '#b09a80'), x + dx, 1.1 + 4.35, z + dz); d.scale.y = .55; nm(d); } /* Update 143b: roof dome FIELD - two rows of five small squashed domes (the real covered market's roofline reads as many small domes, not one row) */ nm(put(world, box(12, .8, 2.6, '#c8b294'), x, 1.1 + 4.35, z)); /* raised central vault strip between the dome rows */ for (const dx of [-1.25, 1.25]) nm(put(world, box(.8, 3.6, .6, '#c8a882'), x + dx, 1.1 + 1.8, z + 4.1)); nm(put(world, box(1.7, .8, .6, '#c8a882'), x, 1.1 + 3.2, z + 4.1)); /* Update 143c (Main 1:45: the solid surround buried the door = blank olive panel): the surround becomes a real frame - two pilasters + a lintel that meets them edge-to-edge (no coplanar faces) */ const arch = put(world, cyl(1.3, 1.3, .5, 12, '#c8a882'), x, 1.1 + 4.1, z + 4.1); arch.rotation.x = Math.PI / 2; nm(arch); /* arched gate crown raised 0.5 so its lower half embeds in the lintel/frame and never floats inside the opening */ nm(put(world, box(1.6, 3, .3, '#6a4a38'), x, 1.1 + 1.5, z + 4.05)); /* the door: a VISIBLE dark opening between the pilasters, recessed 0.2 behind their fronts (front z+4.2 vs frame front z+4.4), back embedded 0.1 in the facade */ for (const dx of [-6.4, -3.6, 3.6, 6.4]) nm(put(world, box(.7, 1.4, .15, '#5a4a38'), x + dx, 1.1 + 1.7, z + 4.03)); /* narrow window insets, south face */ } }
  ]);
  if (id === 'stockholm') extrasSet(world, colliders, places, roadAsphalt, { lon: 18.055, lat: 59.3275, kx: 3337, water: 'east', slots: SET_SLOTS.stockholm }, [ /* Update 120: sourced places batch (MediaWiki API coords pre-fetched 2026-10-29, dev/HK-SOURCES.md); anchor = City Hall landmark at (0,-26); kx = 111320*cos(59.3275)/17. DROPPED: Vasa Museum (X 121.4 off-window east), Storkyrkan (no API coordinates returned) */
    { name: 'Riddarholmen Church-inspired lattice spire', lon: 18.06472222, lat: 59.32472222, hw: 6, hd: 4, rad: 16, pin: [26.94, -14.47], /* Update 120: accepted placement 8.9u from the sourced anchor - the anchor sits in the z=0/x=40 road-junction margin band boxed by the corridor lamp line (28,-6.5)/(32,-8.2); pinned to hold across the SET_SLOTS refresh (113a pattern); residual recorded in dev/HK-SOURCES.md */ build: (x, z, nm) => { put(world, box(10, 4.5, 6, '#b06a48'), x, 1.1 + 2.25, z); nm(put(world, box(10.4, .5, 6.4, '#7a4a38'), x, 1.1 + 4.75, z)); nm(put(world, box(10.4, 1.1, 2, '#7a4a38'), x, 1.1 + 5.55, z)); put(world, box(2.6, 7, 2.6, '#a85f42'), x - 3.5, 1.1 + 3.5, z); nm(put(world, cone(1.9, 3, 8, '#3c4248'), x - 3.5, 1.1 + 8.5, z)); nm(put(world, cone(1.2, 2.4, 8, '#3c4248'), x - 3.5, 1.1 + 11.2, z)); nm(put(world, cone(.55, 2, 8, '#3c4248'), x - 3.5, 1.1 + 13.4, z)); for (const dz of [-2.6, 2.6]) for (const dx of [-4.6, 4.6]) put(world, box(.6, 3, .6, '#9c5c40'), x + dx, 1.1 + 1.5, z + dz); } },
    { name: 'Stockholm Palace-inspired baroque block', lon: 18.07166667, lat: 59.32694444, hw: 8, hd: 6, rad: 16, pin: [50.12, -30.79], /* Update 120: accepted placement 10.1u from the sourced anchor - cafe-cluster umbrellas (46.1,-20.3)/(56.2,-18.5)/(43.6,-17.9) blanket the anchor and furniture is outside NEWCLEAR scope (deliberate, 2122 pattern); shrink impossible (max dim < 1.6 needed); open-limit residual recorded */ build: (x, z, nm) => { put(world, box(15, 5.5, 11, '#d8c9a8'), x, 1.1 + 2.75, z); nm(put(world, box(15.6, .7, 11.6, '#8a7a66'), x, 1.1 + 5.85, z)); for (const [dx, dz] of [[-6.5, -4.6], [6.5, -4.6], [-6.5, 4.6], [6.5, 4.6]]) { put(world, box(3, 6.5, 3, '#d0bf9c'), x + dx, 1.1 + 3.25, z + dz); nm(put(world, box(3.4, .5, 3.4, '#7a6c5a'), x + dx, 1.1 + 6.75, z + dz)); } nm(put(world, box(5, 1.2, .8, '#e0d4b4'), x, 1.1 + 6.4, z + 5.6)); nm(put(world, cyl(1, 1.2, 1.2, 12, '#d8c9a8'), x, 1.1 + 6.8, z)); nm(put(world, cone(1.2, 1.4, 12, '#6a7a6a'), x, 1.1 + 8.1, z)); } },
    { name: 'Stortorget-inspired gabled square', lon: 18.07083333, lat: 59.325, hw: 6, hd: 5, rad: 14, pin: [64.34, -14.32], /* Update 120: accepted placement 12.5u from the sourced anchor - z=0 road corridor + lamp line (58,-8.2) block the anchor; west escape 15.4u > rad 14; open-limit residual recorded */ build: (x, z, nm) => { nm(put(world, box(11, .12, 9, '#b5a78c'), x, 1.1 + .06, z)); for (const [dx, c] of [[-3.4, '#a85038'], [0, '#d8a850'], [3.4, '#8a9a7a']]) { put(world, box(2.8, 6, 3.4, c), x + dx, 1.1 + 3, z - 2.6); nm(put(world, box(2, .7, 3.4, c), x + dx, 1.1 + 6.35, z - 2.6)); nm(put(world, box(1.2, .7, 3.4, c), x + dx, 1.1 + 7.05, z - 2.6)); nm(put(world, box(.5, .6, 3.4, c), x + dx, 1.1 + 7.7, z - 2.6)); } put(world, cyl(.5, .6, .9, 10, '#7a6a5a'), x, 1.1 + .45, z + 1.5); nm(put(world, cone(.7, .5, 10, '#5a4c3e'), x, 1.1 + 1.15, z + 1.5)); } }
  ]);
  if (id === 'auckland') extrasSet(world, colliders, places, roadAsphalt, { lon: 174.76231, lat: -36.84847, kx: 5240, water: 'east', slots: SET_SLOTS.auckland }, [ /* Update 120: sourced places batch (MediaWiki API coords pre-fetched 2026-10-29, dev/HK-SOURCES.md); anchor = Sky Tower landmark at (0,-26); kx = 111320*cos(-36.8485)/17. DROPPED: Harbour Bridge (Z -152.9 off-window north) */
    { name: 'Auckland Ferry Terminal-inspired hall', lon: 174.767, lat: -36.843, hw: 7, hd: 4, rad: 16, pin: [25.08, -62], /* Update 120: accepted placement 0.9u from the sourced anchor after NEWCLEAR auckland freed the on-anchor box; pinned to hold across the SET_SLOTS refresh */ build: (x, z, nm) => { put(world, box(13, 3.6, 6, '#e4d3a0'), x, 1.1 + 1.8, z); nm(put(world, box(13.6, 1.4, 6.6, '#6a5a48'), x, 1.1 + 4.3, z)); nm(put(world, box(12.6, .4, 5.6, '#57493c'), x, 1.1 + 5.2, z)); for (const [dx, dz] of [[-6.2, -2.7], [6.2, -2.7], [-6.2, 2.7], [6.2, 2.7]]) { put(world, cyl(1, 1, 4.6, 10, '#e4d3a0'), x + dx, 1.1 + 2.3, z + dz); nm(put(world, cone(1.2, 1.6, 10, '#5a4c3e'), x + dx, 1.1 + 5.4, z + dz)); } put(world, box(2.2, 5.4, 2.2, '#e4d3a0'), x, 1.1 + 2.7, z + .5); nm(put(world, cyl(.7, .7, .25, 12, '#f4f0e0'), x, 1.1 + 4.4, z + 1.75)); nm(put(world, cone(1.6, 2, 4, '#5a4c3e'), x, 1.1 + 6.4, z + .5)); } },
    { name: 'War Memorial Museum-inspired temple', lon: 174.77777778, lat: -36.86027778, hw: 9, hd: 6, rad: 26, /* Update 120: anchor 3.05u from the x=78 ring road - margin band [64,92] covers the whole quadrant; rad 26 probes the west escape (119 Lage class); NO shrink possible (anchor-to-road 3.05u < any margin) */ build: (x, z, nm) => { nm(put(world, box(17, 1.2, 11, '#b3ab9a'), x, 1.1 + .6, z)); put(world, box(13.5, 4, 8.5, '#ddd6c2'), x, 1.1 + 1.2 + 2, z - .5); for (let i = 0; i < 6; i++) put(world, cyl(.35, .4, 3.6, 8, '#ece5d0'), x - 3.5 + i * 1.4, 1.1 + 1.2 + 1.8, z + 4.6); nm(put(world, box(8, .7, 1.4, '#e2dbc6'), x, 1.1 + 1.2 + 3.95, z + 4.6)); nm(put(world, box(8, .9, 1.2, '#e2dbc6'), x, 1.1 + 1.2 + 4.75, z + 4.4)); nm(put(world, box(5.5, .8, 1, '#e2dbc6'), x, 1.1 + 1.2 + 5.6, z + 4.35)); nm(put(world, box(3, .7, .8, '#e2dbc6'), x, 1.1 + 1.2 + 6.35, z + 4.3)); nm(put(world, box(13.9, .5, 8.9, '#8f8878'), x, 1.1 + 1.2 + 4.25, z - .5)); nm(put(world, cyl(2.2, 2.6, 1.4, 16, '#c9c2ae'), x, 1.1 + 1.2 + 5.2, z - .5)); nm(put(world, cone(1.2, 1.2, 16, '#b3ab9a'), x, 1.1 + 1.2 + 6.5, z - .5)); } }
  ]);
  if (id === 'mexicocity') extrasSet(world, colliders, places, roadAsphalt, { lon: -99.13278, lat: 19.4333, kx: 6173, slots: SET_SLOTS.mexicocity }, [ /* Update 121: sourced place mini-batch (MediaWiki API coords pre-fetched 2026-10-29, dev/HK-SOURCES.md); anchor = Templo Mayor landmark at (0,-26); kx = 111320*cos(19.4333)/17. The rest of the historic-centre cluster (Cathedral/Torre/BellasArtes neighbours within ~10u) is mapping backlog per Main 9:13 (transform window limit); Chapultepec X -302 off-window */
    { name: 'Bellas Artes-inspired domed palace', lon: -99.1414, lat: 19.4353, hw: 8, hd: 5, rad: 16, pin: [-54.21, -40.34], /* Update 121: accepted placement 1.4u from the sourced anchor after NEWCLEAR mexicocity freed the band (probe121); pinned to hold across the SET_SLOTS refresh (113a pattern) */ build: (x, z, nm) => { put(world, box(16, 4, 9, '#ece2cc'), x, 1.1 + 2, z); nm(put(world, box(16.4, .5, 9.4, '#d8cbb0'), x, 1.1 + 4.25, z)); put(world, cyl(3.2, 3.6, 1.6, 20, '#e8dcc8'), x, 1.1 + 5.3, z); const d = put(world, sph(3, '#e8a13a'), x, 1.1 + 6.6, z); d.scale.y = .7; nm(d); nm(put(world, cyl(.4, .5, 1, 8, '#ece2cc'), x, 1.1 + 8.9, z)); nm(put(world, cone(.6, .9, 8, '#d8902a'), x, 1.1 + 9.6, z)); for (const [dx, dz] of [[-7, -3.6], [7, -3.6], [-7, 3.6], [7, 3.6]]) { put(world, box(1.8, 5.5, 1.8, '#e4d8c0'), x + dx, 1.1 + 2.75, z + dz); const c = put(world, sph(.9, '#e8a13a'), x + dx, 1.1 + 5.9, z + dz); c.scale.y = .75; nm(c); } for (const dx of [-5.5, -3.3, -1.1, 1.1, 3.3, 5.5]) put(world, cyl(.3, .35, 3.4, 8, '#f0e8d4'), x + dx, 1.1 + 1.7, z + 4.9); } }
  ]);
}
function extrasRome(world, colliders, places, roadAsphalt, inRiv) {
  extrasSet(world, colliders, places, roadAsphalt, { lon: 12.4922, lat: 41.8903, kx: 4930, slots: SET_SLOTS.rome }, [
    { name: 'Roman Forum-inspired columns', lon: 12.4852, lat: 41.8922, hw: 6, hd: 3, rad: 30, rv: 1, pin: [-28.51, -40.18], /* Update 116 (Main 1:12: never-sited Forum stays backlog, not settled): the anchor strip's N-S roads (centers -41.5 hw 4.5 / -16.5 hw 4, asphalt gap -37..-20.5 = 16.5u) leave a compliant band only 16.5-2*(max(hw,hd)+1) wide - 0 at hw 8, 0.5 at hw 7 (missed by the 1.5 site grid), 2.5 at hw 6. Shrunk to max dim 6 (5 columns, 11u base - same subject, honest smaller rendering); NEWCLEAR.rome (-29,-39,10) clears the tower fabric blocking the band; site lands ~4.5u east of the sourced anchor, 35u+ from the course. Update 115: rv requires full-footprint band clearance - never sited at the accepted state rather than intersecting the river */ build: (x, z, nm) => { nm(put(world, box(11, .15, 5, '#cfc3a4'), x, 1.1, z)); for (let k = -2; k <= 2; k++) { put(world, cyl(.4, .45, 4.2, 8, '#e4d8bc'), x + k * 2.4, 1.1 + 2.1, z - 1.4); if (k % 2) put(world, cyl(.4, .45, 3, 8, '#d8ccae'), x + k * 2.4, 1.1 + 1.5, z + 1.4); } nm(put(world, box(10.5, .5, 1.1, '#c9bd9e'), x, 1.1 + 4.4, z - 1.4)); } },
    { name: 'Pantheon-inspired rotunda', lon: 12.4768, lat: 41.8986, hw: 6, hd: 6, rad: 16, pin: [-76.92, -92.88], /* Update 115: the Tiber stream shift freed this never-sited entry DRY near its sourced anchor (place label at hd+2 = (-76.92,-84.88), 60u+ from the course; Main 1:01 ordinary-backlog class); pinned so the SET_SLOTS.rome refresh cannot un-site it (113a pattern) */ build: (x, z, nm) => { put(world, cyl(5, 5, 5, 20, '#cdbfa2'), x, 1.1 + 2.5, z); nm(put(world, cone(5, 2.6, 20, '#8f9a98'), x, 1.1 + 6.3, z)); put(world, box(7, 4.6, 2.2, '#d8ccb0'), x, 1.1 + 2.3, z + 5.4); for (const dx of [-2.6, -.9, .9, 2.6]) nm(put(world, cyl(.3, .3, 4.4, 8, '#ece2c8'), x + dx, 1.1 + 2.2, z + 6.8)); }, r2: 5.2 },
    { name: 'Arch of Constantine-inspired arch', lon: 12.49083, lat: 41.88972, hw: 4, hd: 2, rad: 14, build: (x, z, nm) => { put(world, box(2, 5, 2.2, '#d6cbb0'), x - 2.4, 1.1 + 2.5, z); put(world, box(2, 5, 2.2, '#d6cbb0'), x + 2.4, 1.1 + 2.5, z); nm(put(world, box(7.4, 1.6, 2.2, '#cfc4a8'), x, 1.1 + 5.8, z)); nm(put(world, box(2.6, 1.2, 2.2, '#cfc4a8'), x, 1.1 + 6.2 + .6, z)); } },
  ], inRiv);
}
function extrasAthens(world, colliders, places, roadAsphalt) {
  extrasSet(world, colliders, places, roadAsphalt, { lon: 23.7266, lat: 37.9715, kx: 5220, water: 'south', slots: SET_SLOTS.athens }, [
    { name: 'Temple of Olympian Zeus-inspired columns', lon: 23.73308, lat: 37.96937, hw: 7, hd: 5, rad: 16, build: (x, z, nm) => { nm(put(world, box(14, .4, 10, '#d8ccae'), x, 1.2, z)); for (let i = 0; i < 6; i++) for (const dz of [-4, 4]) put(world, cyl(.5, .55, 6, 10, '#eadfc4'), x - 6 + i * 2.4, 1.1 + 3.4, z + dz); nm(put(world, box(13.5, .5, 9.5, '#d0c4a6'), x, 1.1 + 6.6, z)); } },
    { name: 'Odeon of Herodes Atticus-inspired theatre', lon: 23.724444, lat: 37.970756, hw: 5, hd: 5, rad: 16, build: (x, z, nm) => { for (let k = 0; k < 4; k++) nm(put(world, cyl(4.8 - k * 1, 4.8 - k * 1, .6, 20, k % 2 ? '#d4c8aa' : '#cbbf9f'), x, 1.1 + .3 + k * .6, z)); put(world, box(9, 4, 1.2, '#c9bd9e'), x, 1.1 + 2, z - 4.4); }, r2: 4.6 },
    { name: 'Acropolis Museum-inspired glass hall', lon: 23.728299, lat: 37.969108, hw: 6, hd: 3.5, rad: 30, build: (x, z, nm) => { put(world, box(12, 3.4, 7, '#cfd8dc', { roughness: .15, metalness: .2 }), x, 1.1 + 1.7, z); nm(put(world, box(12.4, .4, 7.4, '#8f979c'), x, 1.1 + 3.6, z)); } },
  ]);
}
function extrasSingapore(world, colliders, places, roadAsphalt) {
  extrasSet(world, colliders, places, roadAsphalt, { lon: 103.865, lat: 1.28472, kx: 6625, water: 'south', slots: SET_SLOTS.singapore }, [
    { name: 'Marina Bay Sands-inspired towers', lon: 103.86, lat: 1.2825, hw: 6, hd: 3, rad: 18, build: (x, z, nm) => { for (const dx of [-4, 0, 4]) put(world, box(2.6, 12, 2.6, '#c6d4d8'), x + dx, 1.1 + 6, z); nm(put(world, box(13, .7, 3.2, '#8fa8b0'), x, 1.1 + 12.3, z)); nm(put(world, box(5, .25, 1.2, '#37c3e6'), x + 3, 1.1 + 12.8, z)); } },
    { name: 'Singapore Flyer-inspired wheel', lon: 103.86323, lat: 1.28940, hw: 5, hd: 2, rad: 18, build: (x, z, nm) => { const w = nm(put(world, cyl(5, 5, .3, 24, '#d8e4e8'), x, 1.1 + 6, z)); w.rotation.x = Math.PI / 2; const h = nm(put(world, cyl(4.3, 4.3, .35, 24, '#6a8894'), x, 1.1 + 6, z)); h.rotation.x = Math.PI / 2; put(world, box(.6, 6.4, .6, '#a8b8be'), x - 1.2, 1.1 + 3.2, z); put(world, box(.6, 6.4, .6, '#a8b8be'), x + 1.2, 1.1 + 3.2, z); }, r2: 1.6 },
    { name: 'Esplanade-inspired domes', lon: 103.85528, lat: 1.28972, hw: 6, hd: 3.5, rad: 18, build: (x, z, nm) => { put(world, box(12, 2.4, 6, '#b8c4c8'), x, 1.1 + 1.2, z); for (const dx of [-3, 3]) nm(put(world, cone(3, 2.8, 10, '#9aa8a0', { roughness: .4, metalness: .1 }), x + dx, 1.1 + 3.8, z)); } },
  ]);
}
export function buildCity(scene, id) {
  const def = CITY_DEFS[id];
  // Tokyo layout salt 1: the static pickup slots in spots.json (server contract) must all stay collectible; salt 0 put a building over slot 39. Chosen by dev/harness/spotgate.mjs.
  const R = seeded([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) + (id === 'tokyo' ? 1 : 0) * 7919);
  const occluders = [], colliders = [], itemSpots = [], clouds = [], butterflies = [], places = [];
  // Update 149: mergeStatic folds every tree's meshes into the static buckets, leaving the group pushed
  // below EMPTY - the camera occluder ray (app.js) then misses trees entirely, so a canopy between the
  // camera and a driven vehicle hid it with no pull-in at all. Give each tree a raycast-only proxy:
  // never added to the scene graph (no draw call, nothing to merge or render), matrixWorld pinned once
  // (the world group stays at the identity transform, same invariant the merged-out ghost buildings rely on).
  const occPush = (t, palm) => { occluders.push(t); const sc = t.scale.x || 1;
    const pr = cyl((palm ? .8 : 1.15) * sc, (palm ? .75 : .95) * sc, (palm ? 2.2 : 2.4) * sc, 6, '#000');
    pr.position.set(t.position.x, .6 + (palm ? 3.1 : 1.9) * sc, t.position.z); pr.updateMatrix(); pr.matrixWorld.copy(pr.matrix);
    occluders.push(pr); };
  const world = new THREE.Group(); scene.add(world);
  const S = CITY_SIZE;
  const PROMSET = new Set(['rio', 'dubai', 'capetown', 'losangeles', 'buenosaires', 'tokyo', 'sydney', 'istanbul', 'auckland', 'lagos', 'stockholm', 'newyork', 'singapore', 'athens', 'lisbon', 'bangkok']); /* Update 105 batch 1: the six flat east-shore cities join the pilot (the 'later pass' deferred at Update 41) */ /* Update 106 batch 2: five west/south flat-shore cities; hongkong EXCLUDED - extrasHK already hand-builds the sourced Tsim Sha Tsui waterfront (Star Ferry terminal etc.) at the shore, the generic walk would cut through it */ /* buenosaires added Update 92: the sourced Puerto Madero docklands promenade on the Rio de la Plata (east) bank - dev/HK-SOURCES.md */ /* waterfront promenade pilot (row 15): a paved walk, railing, lamps and benches along the flat shoreline - gameplay arrangement after seaside promenades, not a mapped place */
  const SHORE_IN = def.shoreIn || 0; // per-city landward shore inset in units (default 0 = the edge shore at S-6); gameplay arrangement, not surveyed geography
  const SHORE_ON = !!(SHORE_IN || def.shorePoly);
  // waterline z at world x: polyline from GSHHG 2.3.7 full-resolution lake outline sampled in game units (see dev/HK-SOURCES.md), shifted south by shoreShift as a gameplay arrangement; constant S-6-SHORE_IN for the plain inset; 1e9 = no inset shore
  const shoreAt = x => { if (def.shorePoly) { const P = def.shorePoly, sh = def.shoreShift || 0; if (x <= P[0][0]) return P[0][1] + sh; for (let i = 1; i < P.length; i++) if (x <= P[i][0]) return P[i - 1][1] + (P[i][1] - P[i - 1][1]) * (x - P[i - 1][0]) / (P[i][0] - P[i - 1][0]) + sh; return P[P.length - 1][1] + sh; } return SHORE_IN ? S - 6 - SHORE_IN : 1e9; };
  // east-sea variant (Mumbai): waterline x at world z from a GSHHG 2.3.7 outline (see dev/HK-SOURCES.md Update 29); water lies east of it; gameplay arrangement, internal only
  const RIVERW = def.river || null; // Update 90 (KL): wadeable Klang/Gombak bands [x0,z0,x1,z1], width 8 - no colliders, roads pass over (Kerala bridge-read precedent)
  const inRiver = (x, z, m) => { if (!RIVERW) return false; const h = 4 + (m || 0); for (const [x0, z0, x1, z1] of RIVERW) { const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz; let t = L2 ? ((x - x0) * dx + (z - z0) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t)); const px = x0 + t * dx, pz = z0 + t * dz; if (Math.hypot(x - px, z - pz) < h) return true; } return false; };
  const ESH = !!def.shoreEast, ESHIFT = def.shoreEastShift || 0;
  const shoreX = z => { const P = def.shoreEast; if (z <= P[0][0]) return P[0][1] + ESHIFT; for (let i = 1; i < P.length; i++) if (z <= P[i][0]) return P[i - 1][1] + (P[i][1] - P[i - 1][1]) * (z - P[i - 1][0]) / (P[i][0] - P[i - 1][0]) + ESHIFT; return P[P.length - 1][1] + ESHIFT; };
  const shoreXMin = (z, h) => Math.min(shoreX(z - h), shoreX(z), shoreX(z + h));
  const shoreMin = (x, h) => Math.min(shoreAt(x - h), shoreAt(x), shoreAt(x + h));
  const shoreMax = (() => { let m = -1e9; for (let x = -S; x <= S; x += 4) m = Math.max(m, shoreAt(x)); return m; })();

  const base = put(world, box(700, .6, 700, def.water && !def.landSurround ? '#2f9fd0' : def.ground, { roughness: .25 }), 0, -.35, 0);
  base.castShadow = false;
  const land = put(world, box(S * 2 + 20, 1.2, S * 2 + 20, def.ground), 0, 0, 0);
  land.castShadow = false;
  // water edge: land shrinks on that side
  if (def.water) {
    const w = { west: [-S - 4, 0, 16, S * 2 + 24], east: [S + 4, 0, 16, S * 2 + 24], north: [0, -S - 4, S * 2 + 24, 16], south: [0, S + 4, S * 2 + 24, 16] }[def.water];
    const wm = put(world, box(w[2], 1.4, w[3], '#2f9fd0', { roughness: .2, metalness: .05 }), w[0], .05, w[1]); wm.castShadow = false; wm.position.y = .3;
    if (id === 'hongkong') hkFarShore(world, S, def.ground);
    if (SHORE_ON && def.water === 'south') {
      if (def.shorePoly) { const sh = new THREE.Shape(); sh.moveTo(-S - 12, shoreAt(-S - 12)); for (let x = -S; x <= S; x += 4) sh.lineTo(x, shoreAt(x)); sh.lineTo(S + 12, shoreAt(S + 12)); sh.lineTo(S + 12, S + 12); sh.lineTo(-S - 12, S + 12); sh.closePath();
        const ov = put(world, box(1, 1, 1, '#2f9fd0', { roughness: .2, metalness: .05 }), 0, 1.0, 0); ov.geometry = new THREE.ExtrudeGeometry(sh, { depth: 1.4, bevelEnabled: false }); ov.rotation.x = Math.PI / 2; ov.castShadow = false; }
      else { const z0 = S - 6 - SHORE_IN, z1 = S + 12, ov = put(world, box(S * 2 + 24, 1.4, z1 - z0, '#2f9fd0', { roughness: .2, metalness: .05 }), 0, .3, (z0 + z1) / 2); ov.castShadow = false; }
    }
    if (ESH) { const sh = new THREE.Shape(); sh.moveTo(shoreX(-S - 12), -S - 12); for (let z = -S; z <= S; z += 4) sh.lineTo(shoreX(z), z); sh.lineTo(shoreX(S + 12), S + 12); sh.lineTo(S + 12, S + 12); sh.lineTo(S + 12, -S - 12); sh.closePath();
      const ov = put(world, box(1, 1, 1, '#2f9fd0', { roughness: .2, metalness: .05 }), 0, 1.0, 0); ov.geometry = new THREE.ExtrudeGeometry(sh, { depth: 1.4, bevelEnabled: false }); ov.rotation.x = Math.PI / 2; ov.castShadow = false; }
    if (def.landSurround) { // water only on the bay side: open water to the far shore, land on every other side
      const x0 = S + 12, x1 = 345, wb = put(world, box(x1 - x0, 1.4, 690, '#2f9fd0', { roughness: .2, metalness: .05 }), (x0 + x1) / 2, .3, 0); wb.castShadow = false;
      tokyoFarShore(world, S, def.ground);
    }
  }
  const inLand = (x, z) => {
    if (def.water === 'west' && x < -S + 6) return false;
    if (def.water === 'east' && x > (ESH ? shoreX(z) : S - 6)) return false;
    if (def.water === 'north' && z < -S + 6) return false;
    if (def.water === 'south' && z > (SHORE_ON ? shoreAt(x) : S - 6)) return false;
    return true;
  };
  if (RIVERW) { let reachK = 0; for (const pts of riverReaches(RIVERW)) { if (pts.length < 2) continue; const reachY = .635 + reachK++ * .004; /* confluence overlap: later reaches stack 4mm higher - no coplanar pair, no z-fight, sub-pixel step; the FULL course stays drawn (no trim) */ const out = bandOutline(pts, 4, (id === 'bangkok' || id === 'nairobi') ? { start: false, end: false } : undefined /* 118s: nairobi terminals also squared - flush at the +-122 land edge (extensions removed, see the nairobi river comment) */); /* Update 118p (Main 16:03 open cosmetic limitation): bangkok's course terminals sit exactly on the +-122 land edge abutting the sea-colored base; the semicircle caps bulged 4u past the edge as a differently colored ROUNDED TONGUE. Squared off bangkok-only: the band now ends flush AT the shoreline (drawn subset of the h=4 predicate tube at the terminals - nothing sites past the land edge, inLand-gated). CAP-HIDING RENDERING REPAIR, not verified geography (Main 16:57 distinction retained); the course/predicate/other cities are untouched */ const sh = new THREE.Shape(); sh.moveTo(out[0][0], -out[0][1]); for (let k = 1; k < out.length; k++) sh.lineTo(out[k][0], -out[k][1]); sh.closePath(); const bg = new THREE.ShapeGeometry(sh); bg.rotateX(-Math.PI / 2); const wm = new THREE.Mesh(bg, M('#3f8fbf', { roughness: .3, side: THREE.DoubleSide })); wm.position.y = reachY; wm.castShadow = false; world.add(wm); } } /* Update 118c (Main 14:32: the drawn-vs-predicate mismatch is implementation debt, not protected state): the band now renders EXACTLY the inRiver h=4 tube - exact-length boxes + r=4 discs at every vertex (joints AND terminal caps) - replacing the (len+7) box approximation (Kerala bend precedent) whose square caps and joint overhang reached ~1-3.5u past the predicate (118b audit: lima avenue end sat inside drawn-only water). Predicate untouched: streams/placements/colliders/bridges unchanged, placement effects zero by construction; visual effect = slight narrowing at bend outsides and terminal ends in all river cities. 118d (Main 14:37 pixel review: dotted dark seams in the cap/segment overlap): the discs were COPLANAR with the boxes (top .635) and z-fought in the overlap - BISECT-CONFIRMED (boxes-only capture still showed the strokes): the carriers are ADJACENT BOXES overlapping coplanar in a wedge on each bend's inside (8-wide strips meeting at an angle; shortening cannot remove the wedge, which extends ~4/sin(angle) from the vertex). Fix: every water element (box or disc) gets its own epsilon height - cyclic 8 levels x 1.5mm, spread 12mm, sub-pixel at gameplay zoom - so no two overlapping pieces are ever coplanar; draw-adjacent (hence overlap-capable) elements always differ. Discs render as 48-gons (max chord deviation ~9mm from the mathematical r=4 tube - rendered = approximation of the tube, not the tube itself). Update 110: band surface at .635, BELOW the arm/ring asphalt top (.68) - the continuous asphalt reads as the bridge deck, rails+posts below */
  // roads: a cross plus ring
  const HOT_ROOFS = new Set(['mumbai', 'delhi', 'dubai', 'cairo', 'rio', 'capetown', 'singapore', 'bangkok', 'jakarta', 'nairobi', 'lima', 'mexicocity', 'marrakesh', 'losangeles', 'athens', 'lisbon', 'madrid', 'kualalumpur']); // water-tank / solar rooftops (design inspiration)
  const PALMS = new Set(['mumbai', 'dubai', 'rio', 'cairo', 'capetown', 'singapore', 'losangeles', 'bangkok', 'kualalumpur']); // tropical/desert avenue palms (design inspiration)
  const AMERICAS = new Set(['newyork', 'losangeles', 'toronto', 'mexicocity', 'buenosaires', 'rio', 'bogota']); // yellow centre lines, Americas road convention
  // road surface + plaza paving pick up regional character (design inspiration, subtle):
  // warm sandy asphalt in desert/tropical avenues, cool slate in wet northern cities, warm stone around the Med.
  const ROAD_WARM = new Set(['mumbai', 'delhi', 'dubai', 'cairo', 'losangeles', 'bangkok', 'mexicocity', 'rio', 'kualalumpur']);
  const ROAD_COOL = new Set(['london', 'moscow', 'berlin', 'toronto']);
  const ROAD_MED = new Set(['rome', 'athens', 'istanbul']);
  const road = ROAD_WARM.has(id) ? '#575046' : ROAD_COOL.has(id) ? '#424654' : ROAD_MED.has(id) ? '#544e44' : '#4a4d55';
  const plaza = ROAD_WARM.has(id) ? '#d8c9a4' : ROAD_COOL.has(id) ? '#c2c4c8' : ROAD_MED.has(id) ? '#d6c4a2' : '#d4cdb8';
  const lane = AMERICAS.has(id) ? '#e8c44a' : '#e8e4d0';
  // gameplay arrangement: short cuts in a lattice road where a named place keeps its real bearing (Lima Government Palace, Madrid Retiro, Nairobi Uhuru); each cut stub still joins the ring
  const RCUTS = ({ lima: [{ x0: -6, x1: 6, z0: -58, z1: -31 }, { x0: -44.5, x1: -35.5, z0: -46, z1: -5 }, { x0: -101.5, x1: -41, z0: -87, z1: -73.5 }], /* 118a (Main 14:06 review): rect 1 extended z0 -50 -> -58 - the x=0 avenue's south half otherwise pokes 3.75u INTO the band (asphalt z -53.7..-50) and stops mid-water (measured + still-verified stub). Main 14:28: clearance must match the RENDERED footprint (per-segment (len+7)x8 rotated boxes - square caps and the joint-overlap extension reach ~1-3.5u past the predicate tube), not the narrower h=4 predicate: z0 -54.5 left the end IN the drawn water (drawn-box distance 0.00, predicate 3.64); -58 clears it (worst edge 1.0u, centre 2.8u). Rect 3 cuts the z=-77 boundary road's 35u PARALLEL overlap with the band's W-E reach (x -66..-101, band z -80+-4 vs road z -77+-3.5): the 110 bridge classifier misread it as a 16u transverse crossing and laid a rail bar on the bank OFF the asphalt (raildump edge-off-asphalt@-74.4,-82.8, still-verified); cut widened on measurement: x1 -65.5 left the road end wet (band parallel, wet to x~-47) -> -46.5 -> -42.5 (predicate-grid dry) -> -41 (Main 14:28 DRAWN-footprint audit: the -42.5 resume corner grazed drawn water 0.16u; -41 lands the end on the x=-40 junction asphalt, N corner drawn-dry 0.95u); z0 -82.5 -> -87 so the (-RING,-RING) corner crosswalk sets fall inside the cut (the stripe skip below is lima-scoped). ALSO: the ring slab/dash render never consumed RCUTS (inRoadCut gates on the origin arms only - moscow-shaped) - ring slabs now emit via clamped cutSegs runs when RCUTS.length, byte-identical boxes for off-ring-rect cities; x=-60 N-S road ends dry at z-73.5; roads end at the banks, no rails */ /* 118: second rect cuts the generic x=-40 street (asphalt x -43..-37, onRoad -44..-36) over z -46..-5; the sourced Rimac band splits the only road-free SE strip, so the airport relocates to the river-clear block west of this street and the street stubs adapt (moscow 113a pattern: course wins, fabric adapts) */ madrid: [{ x0: 13, x1: 37, z0: -6, z1: 17 }], nairobi: [{ x0: -44, x1: -36, z0: -28, z1: -6 }, { x0: -45, x1: -35, z0: -122, z1: -100 }, /* 118r: cuts the x=-40 street where the band's ring-parallel BEND overlaps it (wet z -116.25..-105.75 on the asphalt x -43..-37; the auto bridge-rail bar landed OFF the asphalt - raildump edge-off-asphalt@-35.9,-111.8, lima rect-1/3 class). Street resumes north at z=-100 (worst corner (-37,-100) 6.1u predicate-dry of vertex (-35.78,-105.94)); the dead-end stub z -122..-115.5 is removed. Roads end at the banks, no rails (lima 118a pattern) */ { x0: 24.5, x1: 69.5, z0: -82.5, z1: -73.5 }], /* 118r: cuts the SOUTH RING (RING=78, slab z -82..-74) where the sourced course PARALLELS it ~27u - predicate-wet x 34..60, course z -91..-76.3 running into/through the ring asphalt, found by grid audit (the 110 bridge classifier never flags a parallel overlap). Ring slab breaks via the 118a cutSegs consumer; ring resumes x=24.5 (worst edge point (24.5,-82.5) 2.12u DRAWN-box clearance) / x=69.5 (worst edge point 1.46u DRAWN clearance - x1=67 measured 0.00u, x1=69 0.96u inside the (61.44,-74.99) joint's (len+7)x8 drawn box, widened on measurement, lima rect-3 118a pattern; the course crosses the ring's north edge z=-74 at x~61.5, inside the cut). z range covers the full 8u ring slab + 0.5u (lima rect-3 pattern: z0 -87, z1 -73.5 there). The x=0 and EAST-ring x=78 TRANSVERSE crossings keep their auto deck-edge rails (moscow pattern: raildump 7+9 @(0,-91), 16+4 @(78,-56)) */ mumbai: [{ x0: -45, x1: -35, z0: -62, z1: -18 }], moscow: [{ x0: -35, x1: -4.5, z0: -9, z1: 4.5 }, { x0: 4.5, x1: 57, z0: -9, z1: 4.5 }], delhi: [{ x0: -7.5, x1: 7.5, z0: -4.5, z1: 4.5 }, { x0: -4.5, x1: 4.5, z0: -7.5, z1: 7.5 }], lagosisland: [{ x0: 61.8, x1: 83.8, z0: -11.1, z1: 6.9 }, { x0: -10.5, x1: 0.5, z0: -52, z1: -40.5 } /* Update 133: cuts the x=0 generic avenue over the Tinubu Square footprint (probe133: ONLY the avenue occupies this rect - no z=-40 road exists in this city; lamps at (-6.5,-52)/(-6.5,-36) clear the member). The sourced Broad St terminus is the square's NE corner (real relationship: Broad St flows INTO Tinubu Square), so the street stays drawn to the pad edge and the avenue stubs cap at z -52/-40.5 */] })[id] || []; /* Update 125: the lagosisland rect cuts the generated central-avenue x ring-road junction over the TBS footprint - those are NOT real streets (the real square is street-bounded: Kings College Rd ~180m NW, Okesuna St ~230m NE, Old Marina/Berkley ~500m S/E; schematic-compression caveat ledgered); ring slabs emit via clamped cutSegs runs, byte-identical for off-ring cities */ /* moscow (Update 113a, Main 11:34): the z=0 avenue is CUT where it runs parallel along the sourced Moskva band (measured overlap x -34.5..56.5 via inRiver on the strip) - the river keeps its course, the generic avenue adapts; the x=0 arm corridor (|x|<4.5) is preserved as the transverse bridge deck (band z -6.5..2.5 there), so the cut comes in two rects that leave the junction stub. roadAsphalt/onRoad/dashes/furniture all break via the existing RCUTS consumers */ // delhi: the circle island cuts both centre arms, so the junction is a real roundabout (asphalt, onRoad and the taxi grid break at the island)
  const nearCut = (x, z, m) => RCUTS.some(c => x > c.x0 - m && x < c.x1 + m && z > c.z0 - m && z < c.z1 + m); // roadside furniture stays out of a cut's neighbourhood
  const inCut = (x, z) => RCUTS.some(c => x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1);
  const RIVQ = RIVERW && RCUTS.length > 0; // Update 113a: city has river road cuts (moscow only today - the only city with both a sourced river and RCUTS entries). The avenue cut makes the preserved x=0-arm junction crossing visible to the 110 bridge-rail block, which now emits its deck-edge rails automatically (measured 7+9 at (0,-2)) - no explicit rail data needed
  const SLABCUT = RIVERW; /* Update 113d (Main 12:06): bounded generic-slab river-break extended to ALL river cities (london/KL known KL112a-3-class occlusions - original intent covers the repair, no token-by-token approval). Every river: city today is london/paris/KL/moscow (grep-verified); the gate stays named so a future river city gets the break automatically with its sourced band. Drawing-only (cutRoad consumes no R, touches no colliders): streams/places unchanged */
  const cutSegs = (ax, c0) => { let segs = [[-S, S]]; for (const c of RCUTS) { const a = ax === 'x' ? c.x0 : c.z0, b = ax === 'x' ? c.x1 : c.z1, o0 = ax === 'x' ? c.z0 : c.x0, o1 = ax === 'x' ? c.z1 : c.x1; if (c0 < o0 - 4.5 || c0 > o1 + 4.5) continue; segs = segs.flatMap(([u, v]) => { const r = []; if (a > u) r.push([u, Math.min(v, a)]); if (b < v) r.push([Math.max(u, b), v]); return r; }); } return segs; };
  const inRoadCut = (ax, i) => RCUTS.some(c => ax === 'x' ? (i > c.x0 - 2 && i < c.x1 + 2 && c.z0 < 4.5 && c.z1 > -4.5) : (i > c.z0 - 2 && i < c.z1 + 2 && c.x0 < 4.5 && c.x1 > -4.5));
  for (const [z0, z1] of cutSegs('z', 0)) put(world, box(9, .08, z1 - z0, road), 0, .64, (z0 + z1) / 2).castShadow = false;
  for (const [x0, x1] of cutSegs('x', 0)) put(world, box(x1 - x0, .08, 9, road), (x0 + x1) / 2, .64, 0).castShadow = false;
  const CANAL = id === 'amsterdam'; // straight z=40 canal arm with quays and bridge decks (Update 48); paris extension reverted - under the game's compass (-z=north, extrasSet X/Z verified against real Bangkok/Dubai bearings) the plaza-fixed Eiffel lands NORTH of the arm, contradicting the sourced Left Bank fact (Update 52)
  if (!CANAL) put(world, box(S * 2, .08, 6, road), 0, .65, 40).castShadow = false;
  else for (const [x0, x1] of [[-S, -43.5], [-36.5, -4.6], [4.6, S]]) { const cx = (x0 + x1) / 2, w = x1 - x0;
    put(world, box(w, .16, 5.4, '#3f8fb8', { roughness: .15, metalness: .05 }), cx, .62, 40).castShadow = false;
    for (const dz of [-3, 3]) put(world, box(w, .5, .6, '#8a6a52'), cx, .8, 40 + dz).castShadow = false;
    colliders.push({ x: cx, z: 40, hw: w / 2, hd: 3.1 }); }
  if (CANAL) for (const bx of [-40, 0]) for (const dz of [-3, 3]) put(world, box(.5, 1.1, .5, '#7a5a42'), bx + (bx ? 3.4 : 4.8), 1.2, 40 + dz).castShadow = false;
  const CANALX = id === 'jakarta'; // canal-inspired water street along the x=-40 arm (Batavia-canal flavour, gameplay arrangement not a surveyed canal); road bridges where z=0 and z=40 cross
  if (!CANALX) for (const [z0, z1] of cutSegs('z', -40)) put(world, box(6, .08, z1 - z0, road), -40, .65, (z0 + z1) / 2).castShadow = false;
  else for (const [z0, z1] of [[-S, -4.6], [4.6, 36.5], [43.5, S]]) { const cz = (z0 + z1) / 2, d = z1 - z0;
    put(world, box(5.4, .16, d, '#4f8f8a', { roughness: .15, metalness: .05 }), -40, .62, cz).castShadow = false;
    for (const dx of [-3, 3]) put(world, box(.6, .5, d, '#8a6a52'), -40 + dx, .8, cz).castShadow = false;
    colliders.push({ x: -40, z: cz, hw: 3.1, hd: d / 2 }); }
  const CIRC = def.circle || null; // circular avenue around the centre junction (Delhi Connaught Place, gameplay arrangement, dev/HK-SOURCES.md Update 36)
  const circD = (x, z) => Math.hypot(x, z);
  // outer ring road (the city grew past its old 74-unit square)
  const RING = 78;
  const ARC = def.arc || null; // curved street (London Regent Street Quadrant, gameplay arrangement, dev/HK-SOURCES.md Update 37)
  const arcAng = (x, z) => (Math.atan2(z - ARC.cz, x - ARC.cx) + 2 * Math.PI) % (2 * Math.PI);
  const inArc = (x, z, hw) => ARC && Math.abs(Math.hypot(x - ARC.cx, z - ARC.cz) - ARC.r) < hw && arcAng(x, z) >= ARC.a0 && arcAng(x, z) <= ARC.a1;
  for (let i = -S + 4; i < S; i += 8) { if (!inRoadCut('x', i) && !(CIRC && circD(i, 0) < CIRC.r1 + 2)) put(world, box(3, .1, .5, lane), i, .7, 0).castShadow = false; if (!inRoadCut('z', i) && !(CIRC && circD(0, i) < CIRC.r1 + 2)) put(world, box(.5, .1, 3, lane), 0, .7, i).castShadow = false; }
  if (CIRC) { const ring = new THREE.Mesh(new THREE.RingGeometry(CIRC.r0, CIRC.r1, 64), M(road)); ring.rotation.x = -Math.PI / 2; ring.position.y = .66; ring.receiveShadow = true; world.add(ring);
    for (let k = 0; k < 20; k++) { const an = k / 20 * 2 * Math.PI, rr = (CIRC.r0 + CIRC.r1) / 2; if (Math.abs(Math.cos(an)) > .86 || Math.abs(Math.sin(an)) > .86) continue; const dm = put(world, box(3, .1, .5, lane), Math.cos(an) * rr, .72, Math.sin(an) * rr); dm.rotation.y = -an - Math.PI / 2; dm.castShadow = false; }
    put(world, cyl(CIRC.r0, CIRC.r0, .14, 48, '#b3a87e'), 0, .65, 0).castShadow = false; } // the island disc: visibly not road, above the cut asphalt
  const CRING = def.canalRing || null; /* gracht-inspired concentric canal ring: fact - Amsterdam's 17th-century canal belt runs concentric around the old centre (en.wikipedia.org/wiki/Canals_of_Amsterdam); the in-game radius is a gameplay arrangement, not surveyed geometry */
  if (CRING) { const rr = (CRING.r0 + CRING.r1) / 2, GAPS = [[0, .11], [Math.PI / 2, .11], [Math.PI, .11], [-Math.PI / 2, .11], [2.448, .09], [-2.448, .09]], QG = GAPS.concat([[.879, .09], [2.263, .09]]); /* GAPS: road bridge crossings - centre arms at angles 0, pi/2, pi, -pi/2 and the x=-40 arm at atan2(33.2,-40)=+-2.448; QG adds the two z=40 canal junctions at atan2(40,+-33.2) where quays gap but water continues */
    const inGap = (a, gs) => gs.some(([c, h]) => { const d = Math.abs(((a - c) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); return d < h; });
    for (let a = 0; a < 2 * Math.PI; a += .05) { const th = -a; /* rotation.x=-pi/2 maps ring theta to world angle -theta */
      if (!inGap(a, GAPS)) { const wseg = new THREE.Mesh(new THREE.RingGeometry(CRING.r0, CRING.r1, 3, 1, th - .025, .05), M('#3f8fb8', { roughness: .15, metalness: .05 })); wseg.rotation.x = -Math.PI / 2; wseg.position.y = .61; wseg.receiveShadow = true; world.add(wseg); } /* .61: just under the z=40 canal arm water (.62) so coplanar overlap cannot z-fight */
      if (!inGap(a, QG)) for (const re of [CRING.r0, CRING.r1]) { const qseg = new THREE.Mesh(new THREE.RingGeometry(re - .35, re + .35, 3, 1, th - .025, .05), M('#8a6a52')); qseg.rotation.x = -Math.PI / 2; qseg.position.y = .8; world.add(qseg); } }
    { const GS = GAPS.map(([c, h]) => [c - h, c + h]).sort((p, q) => p[0] - q[0]); /* span-walked disc colliders: first disc tangent to each water-gap edge (flush coverage, no walkable-water collar) and .058 rad keeps every disc fully off the bridge decks (deck corner > 3 = r away) */
      for (let i = 0; i < GS.length; i++) { const e0 = GS[i][1], e1 = (i + 1 < GS.length ? GS[i + 1][0] : GS[0][0] + 2 * Math.PI);
        for (let a = e0 + .058; ; a += .076) { const aa = Math.min(a, e1 - .058); colliders.push({ x: Math.cos(aa) * rr, z: Math.sin(aa) * rr, r: 3 }); if (aa >= e1 - .058) break; } } } /* clamped closing disc keeps the trailing edge as flush as the leading edge (uncovered-water slivers at 3 bridge approaches otherwise) */
    for (const [bx, bz, hw2] of [[0, 52, 4.5], [0, -52, 4.5], [52, 0, 4.5], [-52, 0, 4.5], [-40, 33.2, 3], [-40, -33.2, 3]]) { /* bridge rails and posts on each road edge across the band; the road deck itself is the continuous arm asphalt above the water */
      if (bz !== 0) for (const sx of [-1, 1]) { put(world, box(.5, .5, 8.6, '#7a5a42'), bx + sx * (hw2 - .3), 1.05, bz).castShadow = false; for (const ez of [-1, 1]) put(world, box(.5, 1.2, .5, '#7a5a42'), bx + sx * (hw2 - .3), 1.1, bz + ez * 3.6).castShadow = false; }
      else for (const sz of [-1, 1]) { put(world, box(8.6, .5, .5, '#7a5a42'), bx, 1.05, bz + sz * (hw2 - .3)).castShadow = false; for (const ex of [-1, 1]) put(world, box(.5, 1.2, .5, '#7a5a42'), bx + ex * 3.6, 1.1, bz + sz * (hw2 - .3)).castShadow = false; } } }
  if (ARC) { const ring = new THREE.Mesh(new THREE.RingGeometry(ARC.r - ARC.hw, ARC.r + ARC.hw, 64, 1, Math.PI / 2, Math.PI / 2), M(road)); ring.rotation.x = -Math.PI / 2; ring.position.set(ARC.cx, .66, ARC.cz); ring.receiveShadow = true; world.add(ring);
    const alen = ARC.a1 - ARC.a0, n = Math.max(2, Math.round(alen * ARC.r / 8));
    for (let k = 0; k < n; k++) { const an = ARC.a0 + (k + .5) / n * alen, qx = ARC.cx + ARC.r * Math.cos(an), qz = ARC.cz + ARC.r * Math.sin(an); if (Math.abs(qx) < 6 || Math.abs(qz) < 6 || Math.abs(qz - 40) < 8 || Math.abs(qx + 40) < 8 || Math.abs(Math.abs(qx) - RING) < 8 || Math.abs(Math.abs(qz) - RING) < 8) continue; // dashes only fully off the grid asphalt (the arc merges tangentially, so endpoints stay bare)
      const dm = put(world, box(3, .1, .5, lane), qx, .72, qz); dm.rotation.y = -(an + Math.PI / 2); dm.castShadow = false; } }
  // diagonal avenue (BA Diagonal Norte, Roque Saenz Pena): straight segment from the Plaza de Mayo bearing toward the Obelisco plaza; gameplay arrangement, see dev/HK-SOURCES.md Update 33
  const DIAGS = def.diagonals || (def.diagonal ? [def.diagonal] : []); /* Update 129/130: polyline diagonal streets - a single def.diagonal wraps into one segment, byte-identical predicates for the BA/Mexico City avenues */
  const onDiag = (x, z, pad) => DIAGS.some(D => { const [ax, az] = D.p0, [bx, bz] = D.p1, dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - (ax + t * dx), z - (az + t * dz)) < D.hw + pad; });
  for (const DIAG of DIAGS) { const [ax, az] = DIAG.p0, [bx, bz] = DIAG.p1, L = Math.hypot(bx - ax, bz - az), yaw = -Math.atan2(bz - az, bx - ax), cx = (ax + bx) / 2, cz = (az + bz) / 2;
    put(world, box(L, .08, DIAG.hw * 2, road), cx, .66, cz).rotation.y = yaw;
    for (let k = 3; k < L - 2; k += 8) { const t = k / L, qx = ax + (bx - ax) * t, qz = az + (bz - az) * t; if (Math.abs(qz) < 8 || Math.abs(qx) < 8 || Math.abs(qz - 40) < 8 || Math.abs(qx + 40) < 8 || Math.abs(Math.abs(qx) - RING) < 8 || Math.abs(Math.abs(qz) - RING) < 8) continue; // no competing centreline through a junction with the grid
      const dm = put(world, box(3, .1, .5, lane), ax + (bx - ax) * t, .72, az + (bz - az) * t); dm.rotation.y = yaw; dm.castShadow = false; } }
  for (let di = 1; di < DIAGS.length; di++) { const DA = DIAGS[di - 1], DB = DIAGS[di]; /* Update 131 (Main 10:59: the abrupt 1.5->1.0 shoulder seam needed a coherent taper): flat trapezoid from DA.hw at the shared joint to DB.hw 2.5u into the narrower segment, drawn over the band; same (x,-z)+rotateX flat-shape idiom as the notch/quay pieces, same winding convention */
    if (Math.abs(DA.hw - DB.hw) < .01 || DA.p1[0] !== DB.p0[0] || DA.p1[1] !== DB.p0[1]) continue;
    const tdx = DB.p1[0] - DB.p0[0], tdz = DB.p1[1] - DB.p0[1], tl0 = Math.hypot(tdx, tdz), tux = tdx / tl0, tuz = tdz / tl0, tpx = -tuz, tpz = tux, tL = 2.5, tjx = DB.p0[0], tjz = DB.p0[1];
    const tsh = new THREE.Shape(); [[tjx + tpx * DA.hw, tjz + tpz * DA.hw], [tjx - tpx * DA.hw, tjz - tpz * DA.hw], [tjx + tux * tL - tpx * DB.hw, tjz + tuz * tL - tpz * DB.hw], [tjx + tux * tL + tpx * DB.hw, tjz + tuz * tL + tpz * DB.hw]].forEach(([tX, tZ], tk) => tk ? tsh.lineTo(tX, -tZ) : tsh.moveTo(tX, -tZ)); tsh.closePath();
    const tg = new THREE.ShapeGeometry(tsh); tg.rotateX(-Math.PI / 2); const tm = new THREE.Mesh(tg, M(road)); tm.position.y = .668; tm.castShadow = false; world.add(tm); }
  for (const sg of [-1, 1]) { if (RCUTS.length) { /* Update 118a: ring slabs/dashes break at RCUTS rects (lima rect 3 = the first cut on the ring itself - its z=-77 arm ran parallel over the Rimac band). cutSegs clamped to the old slab extent keeps every other cut city byte-identical (their rects are all off-ring, verified: moscow/madrid/nairobi/mumbai/delhi rects z/x ranges never reach +-RING) */ for (const [u0, u1] of cutSegs('x', sg * RING)) { const a = Math.max(u0, -(RING + 4.5)), b2 = Math.min(u1, RING + 4.5); if (b2 - a > 2) put(world, box(b2 - a, .08, 8, road), (a + b2) / 2, .64, sg * RING).castShadow = false; } for (const [u0, u1] of cutSegs('z', sg * RING)) { const a = Math.max(u0, -(RING + 4.5)), b2 = Math.min(u1, RING + 4.5); if (b2 - a > 2) put(world, box(8, .08, b2 - a, road), sg * RING, .64, (a + b2) / 2).castShadow = false; } } else { put(world, box(RING * 2 + 9, .08, 8, road), 0, .64, sg * RING).castShadow = false; put(world, box(8, .08, RING * 2 + 9, road), sg * RING, .64, 0).castShadow = false; } }
  for (let i = -RING; i <= RING; i += 10) for (const sg of [-1, 1]) { if (!inCut(i, sg * RING)) put(world, box(3, .1, .5, lane), i, .7, sg * RING).castShadow = false; if (!inCut(sg * RING, i)) put(world, box(.5, .1, 3, lane), sg * RING, .7, i).castShadow = false; }
  let PROM = null; /* promenade band for the pilot cities: placement-only keep-clear so buildings and props stay off the walk (players and the taxi grid are untouched) */
  const roadKeep = (x, z, p) => roadAsphalt(x, z, p) || (CIRC && circD(x, z) < CIRC.r1 + (p > 0 ? p * 1.42 : 0)) || (PROM && (() => { const cd = PROM.ax === 'x' ? x : z, ld = PROM.sg * (PROM.line - cd); return ld > -1 && ld < 7.4 + (p > 0 ? p * 1.42 : 0); })()); // placement-only: the circle island and the promenade band are kept clear, but they are not drivable road (roadAsphalt stays pure for the taxi grid)
  const onRoad = (x, z) => z <= shoreAt(x) && !(ESH && x > shoreX(z)) && !inCut(x, z) && (Math.abs(x) < 6 || Math.abs(z) < 6 || Math.abs(z - 40) < 4.5 || Math.abs(x + 40) < 4.5
    || (Math.abs(Math.abs(x) - RING) < 5 && Math.abs(z) < RING + 5) || (Math.abs(Math.abs(z) - RING) < 5 && Math.abs(x) < RING + 5) || (CIRC && circD(x, z) > CIRC.r0 - 1.5 && circD(x, z) < CIRC.r1 + 1.5) || inArc(x, z, (ARC ? ARC.hw : 0) + 1.5)) || onDiag(x, z, 1.5) /* Update 134: diag term outside the inCut gate (same readiness fix) */;
  // true drawn asphalt extents (cross half 4.5, arms half 3, ring half 4); pad inflates (clearance gap) or shrinks (lane-keeping band)
  const roadAsphalt = (x, z, pad) => { const p = pad || 0; if (z > shoreAt(x) || (ESH && x > shoreX(z))) return false; if (inCut(x, z)) return onDiag(x, z, p > 0 ? p * 1.42 : p); /* Update 134 (Main 11:31 rendering/siting must agree): a DRAWN diagonal band inside a cut must stay siting-visible or placements can occupy visible asphalt - the 133 Tinubu rect exposed this (the Broad St end at the square was predicate-invisible while drawn); only lagosisland has RCUTS cutting a diagonal (buenosaires/mexicocity RCUTS-empty = byte-identical behavior) */ // roads, pickups and vehicles stop at the waterline
    return Math.abs(x) < 4.5 + p || Math.abs(z) < 4.5 + p || (!CANAL && Math.abs(z - 40) < 3 + p) || (CANAL && p > 0 && Math.abs(z - 40) < 2.7 + p) || (!CANALX && Math.abs(x + 40) < 3 + p) /* CANAL: placement pads also keep buildings, blocks and trees off the canal water itself (footprint-exact via roadKeep; p<=0 lane-keeping untouched) */
      || (Math.abs(Math.abs(x) - RING) < 4 + p && Math.abs(z) < RING + 4 + p) || (Math.abs(Math.abs(z) - RING) < 4 + p && Math.abs(x) < RING + 4 + p) || onDiag(x, z, p > 0 ? p * 1.42 : p) || (CIRC && circD(x, z) > CIRC.r0 - (p > 0 ? p * 1.42 : p) && circD(x, z) < CIRC.r1 + (p > 0 ? p * 1.42 : p)) || inArc(x, z, (ARC ? ARC.hw : 0) + (p > 0 ? p * 1.42 : p)); }; // positive pads grow by sqrt2: the diagonal strip and the circle are oblique to axis-aligned footprints (square footprint corner)

const PLAZA_NOTCH = {
  lagosisland: { outline: [[19.32,-20.82],[17.32,-16.00],[14.14,-11.86],[10.00,-8.68],[5.18,-6.68],[0.00,-6.00],[-5.18,-6.68],[-10.00,-8.68],[-14.14,-11.86],[-17.32,-16.00],[-19.32,-20.82],[-20.00,-26.00],[-19.32,-31.18],[-17.32,-36.00],[-14.14,-40.14],[-10.00,-43.32],[-5.18,-45.32],[0.00,-46.00],[5.18,-45.32],[10.00,-43.32],[14.14,-40.14],[17.32,-36.00],[19.32,-31.18],[20.00,-26.00],[19.77,-22.95],[20.30,-22.70],[19.89,-22.99],[13.21,-26.94],[13.00,-27.07],[11.11,-28.39],[8.65,-30.08],[7.12,-31.14],[4.40,-32.95],[2.09,-37.81],[1.68,-38.70],[-1.06,-43.95],[-1.55,-44.48],[-2.24,-44.70],[-2.95,-44.54],[-3.48,-44.05],[-3.70,-43.36],[-3.54,-42.65],[-0.84,-37.46],[-0.45,-36.61],[2.28,-31.13],[5.52,-28.84],[7.05,-27.78],[9.51,-26.09],[11.46,-24.73],[11.77,-24.54],[18.37,-20.63],[18.70,-20.40],[19.15,-20.23]] }, /* Update 131 (Main 10:59 grounded plaza/street relationship): the sourced Broad St way passes THROUGH the r-20 plaza circle's E/SE quadrant to its end inside the circle - the plaza outline takes a bite along the fitted path (cathedral side 1.1u, far side 1.5u, dead-end cap at the way terminus); cathedral model band gap 0.29u (recorded tight); real-world relationship kept: the cathedral fronts Broad Street. The r-20 places pad is UNCHANGED (placement exclusion still the full circle). */
  bangkok: { outline: [[8.02,-26.0],[8.34,-25.59],[8.68,-25.14],[9.06,-24.66],[9.47,-24.12],[9.94,-23.51],[10.47,-22.82],[11.07,-22.04],[11.78,-21.12],[12.61,-20.03],[13.63,-18.71],[14.89,-17.07],[16.51,-14.97],[16.06,-14.09],[15.46,-13.31],[14.82,-12.57],[14.14,-11.86],[13.43,-11.18],[12.69,-10.54],[11.91,-9.94],[11.11,-9.37],[10.28,-8.85],[9.43,-8.36],[8.55,-7.92],[7.65,-7.52],[6.74,-7.17],[5.81,-6.86],[4.86,-6.6],[3.9,-6.38],[2.93,-6.22],[1.96,-6.1],[0.98,-6.02],[0.0,-6.0],[-0.98,-6.02],[-1.96,-6.1],[-2.93,-6.22],[-3.9,-6.38],[-4.86,-6.6],[-5.81,-6.86],[-6.74,-7.17],[-7.65,-7.52],[-8.55,-7.92],[-9.43,-8.36],[-10.28,-8.85],[-11.11,-9.37],[-11.91,-9.94],[-12.69,-10.54],[-13.43,-11.18],[-14.14,-11.86],[-14.82,-12.57],[-15.46,-13.31],[-16.06,-14.09],[-16.63,-14.89],[-17.15,-15.72],[-17.64,-16.57],[-18.08,-17.45],[-18.48,-18.35],[-18.83,-19.26],[-19.14,-20.19],[-19.4,-21.14],[-19.62,-22.1],[-19.78,-23.07],[-19.9,-24.04],[-19.98,-25.02],[-20.0,-26.0],[-19.98,-26.98],[-19.9,-27.96],[-19.78,-28.93],[-19.62,-29.9],[-19.4,-30.86],[-19.14,-31.81],[-18.83,-32.74],[-18.48,-33.65],[-18.08,-34.55],[-17.64,-35.43],[-17.15,-36.28],[-16.63,-37.11],[-16.06,-37.91],[-15.46,-38.69],[-14.82,-39.43],[-14.14,-40.14],[-13.43,-40.82],[-12.69,-41.46],[-11.91,-42.06],[-11.11,-42.63],[-10.28,-43.15],[-9.43,-43.64],[-8.55,-44.08],[-7.65,-44.48],[-6.74,-44.83],[-5.81,-45.14],[-4.62,-44.46],[-3.19,-42.04],[-2.11,-40.22],[-1.26,-38.79],[-0.57,-37.63],[-0.0,-36.67],[0.48,-35.85],[0.91,-35.24],[1.3,-34.74],[1.65,-34.29],[1.97,-33.87],[2.27,-33.48],[2.55,-33.12],[2.81,-32.78],[3.05,-32.46],[3.29,-32.15],[3.51,-31.86],[3.73,-31.58],[3.94,-31.31],[4.14,-31.05],[4.34,-30.79],[4.53,-30.53],[4.73,-30.28],[4.92,-30.04],[5.11,-29.79],[5.3,-29.54],[5.49,-29.29],[5.69,-29.04],[5.88,-28.78],[6.08,-28.52],[6.29,-28.25],[6.51,-27.97],[6.73,-27.69],[6.96,-27.38],[7.2,-27.07],[7.46,-26.73],[7.73,-26.38]] }, /* Update 118k: centreline nearest approach to the (0,-26) plaza centre 13.5u < r20 - outline clamped to the near-bank polyline (course offset 4.6u toward the plaza), 128-ray sample, 49 clamped verts verified on the offset course; quay strip not generated this slice (cosmetic, recorded follow-up; 2 of 3 prior notch cities have one) */ // Update 109: radial-clamp plaza outline + quay for cities whose sourced river course enters the r20 plaza disc; outline = r(theta)=min(20, ray distance to the near-bank polyline = course offset 4.6u toward the plaza), 128-ray sample; river keeps its transformed course, the generic pad geometry adapts (Main 9:58); quay = 1.4u paving strip along the in-disc bank section. Centreline stylization + transformed arrangement, not bank survey or real-relationship map.
  moscow: { outline: [[20.00, -26.00],[19.98, -25.02],[19.90, -24.04],[19.78, -23.07],[19.62, -22.10],[19.40, -21.14],[19.14, -20.19],[18.83, -19.26],[18.48, -18.35],[18.08, -17.45],[17.64, -16.57],[17.15, -15.72],[16.63, -14.89],[16.06, -14.09],[15.46, -13.31],[14.82, -12.57],[14.14, -11.86],[13.43, -11.18],[12.69, -10.54],[11.91, -9.94],[11.11, -9.37],[10.28, -8.85],[9.43, -8.36],[8.55, -7.92],[7.65, -7.52],[6.66, -7.38],[5.68, -7.28],[4.71, -7.19],[3.76, -7.09],[2.82, -7.00],[1.88, -6.91],[0.94, -6.82],[0.00, -6.72],[-0.95, -6.63],[-1.92, -6.54],[-2.90, -6.44],[-3.90, -6.38],[-4.86, -6.60],[-5.81, -6.86],[-6.74, -7.17],[-7.65, -7.52],[-8.55, -7.92],[-9.43, -8.36],[-10.28, -8.85],[-11.11, -9.37],[-11.91, -9.94],[-12.69, -10.54],[-13.43, -11.18],[-14.14, -11.86],[-14.82, -12.57],[-15.46, -13.31],[-16.06, -14.09],[-16.63, -14.89],[-17.15, -15.72],[-17.64, -16.57],[-18.08, -17.45],[-18.48, -18.35],[-18.83, -19.26],[-19.14, -20.19],[-19.40, -21.14],[-19.62, -22.10],[-19.78, -23.07],[-19.90, -24.04],[-19.98, -25.02],[-20.00, -26.00],[-19.98, -26.98],[-19.90, -27.96],[-19.78, -28.93],[-19.62, -29.90],[-19.40, -30.86],[-19.14, -31.81],[-18.83, -32.74],[-18.48, -33.65],[-18.08, -34.55],[-17.64, -35.43],[-17.15, -36.28],[-16.63, -37.11],[-16.06, -37.91],[-15.46, -38.69],[-14.82, -39.43],[-14.14, -40.14],[-13.43, -40.82],[-12.69, -41.46],[-11.91, -42.06],[-11.11, -42.63],[-10.28, -43.15],[-9.43, -43.64],[-8.55, -44.08],[-7.65, -44.48],[-6.74, -44.83],[-5.81, -45.14],[-4.86, -45.40],[-3.90, -45.62],[-2.93, -45.78],[-1.96, -45.90],[-0.98, -45.98],[-0.00, -46.00],[0.98, -45.98],[1.96, -45.90],[2.93, -45.78],[3.90, -45.62],[4.86, -45.40],[5.81, -45.14],[6.74, -44.83],[7.65, -44.48],[8.55, -44.08],[9.43, -43.64],[10.28, -43.15],[11.11, -42.63],[11.91, -42.06],[12.69, -41.46],[13.43, -40.82],[14.14, -40.14],[14.82, -39.43],[15.46, -38.69],[16.06, -37.91],[16.63, -37.11],[17.15, -36.28],[17.64, -35.43],[18.08, -34.55],[18.48, -33.65],[18.83, -32.74],[19.14, -31.81],[19.40, -30.86],[19.62, -29.90],[19.78, -28.93],[19.90, -27.96],[19.98, -26.98]] }, /* Update 113: marginal rim trim only - the Moskva near bank (course offset 4.6 toward the plaza) clips the r20 pad rim by max 0.82u over a ~35deg southern arc (rays 25-35); NO quay strip (trim too small to carry one; london/paris quays unchanged). Same centreline-stylization + transformed-arrangement limits as london/paris */
  london: { outline: [[7.06, -26.00],[7.02, -25.65],[6.99, -25.31],[6.96, -24.97],[6.92, -24.62],[6.89, -24.27],[6.85, -23.92],[6.82, -23.56],[6.78, -23.19],[6.75, -22.81],[6.71, -22.42],[6.67, -22.00],[6.62, -21.57],[6.58, -21.12],[6.53, -20.64],[6.48, -20.12],[6.43, -19.57],[6.37, -18.97],[6.31, -18.32],[6.24, -17.59],[6.16, -16.78],[6.07, -15.88],[5.97, -14.84],[5.85, -13.63],[5.71, -12.21],[5.54, -10.50],[5.34, -8.40],[4.86, -6.60],[3.90, -6.38],[2.93, -6.22],[1.96, -6.10],[0.98, -6.02],[0.00, -6.00],[-0.98, -6.02],[-1.96, -6.10],[-2.93, -6.22],[-3.90, -6.38],[-4.86, -6.60],[-5.81, -6.86],[-6.74, -7.17],[-7.65, -7.52],[-8.55, -7.92],[-9.43, -8.36],[-10.28, -8.85],[-11.11, -9.37],[-11.91, -9.94],[-12.69, -10.54],[-13.43, -11.18],[-14.14, -11.86],[-14.82, -12.57],[-15.46, -13.31],[-16.06, -14.09],[-16.63, -14.89],[-17.15, -15.72],[-17.64, -16.57],[-18.08, -17.45],[-18.48, -18.35],[-18.83, -19.26],[-19.14, -20.19],[-19.40, -21.14],[-19.62, -22.10],[-19.78, -23.07],[-19.90, -24.04],[-19.98, -25.02],[-20.00, -26.00],[-19.98, -26.98],[-19.90, -27.96],[-19.78, -28.93],[-19.62, -29.90],[-19.40, -30.86],[-19.14, -31.81],[-18.83, -32.74],[-18.48, -33.65],[-18.08, -34.55],[-17.64, -35.43],[-17.15, -36.28],[-16.63, -37.11],[-16.06, -37.91],[-15.46, -38.69],[-14.82, -39.43],[-14.14, -40.14],[-13.43, -40.82],[-12.69, -41.46],[-11.91, -42.06],[-11.11, -42.63],[-10.28, -43.15],[-9.43, -43.64],[-8.55, -44.08],[-7.65, -44.48],[-6.74, -44.83],[-5.81, -45.14],[-4.86, -45.40],[-3.90, -45.62],[-2.93, -45.78],[-1.96, -45.90],[-0.98, -45.98],[-0.00, -46.00],[0.98, -45.98],[1.96, -45.90],[2.93, -45.78],[3.90, -45.62],[4.86, -45.40],[5.81, -45.14],[6.74, -44.83],[7.65, -44.48],[8.55, -44.08],[8.63, -42.15],[8.43, -40.06],[8.26, -38.37],[8.13, -36.96],[8.01, -35.76],[7.91, -34.73],[7.82, -33.82],[7.74, -33.02],[7.67, -32.30],[7.61, -31.64],[7.55, -31.04],[7.50, -30.49],[7.45, -29.98],[7.40, -29.50],[7.35, -29.05],[7.31, -28.62],[7.27, -28.21],[7.23, -27.81],[7.20, -27.43],[7.16, -27.06],[7.13, -26.70],[7.09, -26.35]], quay: [[5.17, -6.68],[5.32, -8.23],[5.47, -9.79],[5.63, -11.34],[5.78, -12.89],[5.93, -14.45],[6.08, -16.00],[6.23, -17.55],[6.38, -19.11],[6.54, -20.66],[6.69, -22.21],[6.84, -23.76],[6.99, -25.32],[7.14, -26.87],[7.29, -28.42],[7.44, -29.98],[7.60, -31.53],[7.75, -33.08],[7.90, -34.64],[8.05, -36.19],[8.20, -37.74],[8.35, -39.30],[8.51, -40.85],[8.66, -42.40],[8.81, -43.96],[8.19, -42.70],[8.00, -41.16],[7.81, -39.63],[7.61, -38.11],[7.40, -36.60],[7.18, -35.09],[6.95, -33.60],[6.71, -32.14],[6.46, -30.71],[6.21, -29.32],[5.96, -27.98],[5.75, -26.70],[5.60, -25.45],[5.51, -24.20],[5.47, -22.90],[5.45, -21.54],[5.43, -20.13],[5.40, -18.68],[5.35, -17.20],[5.29, -15.69],[5.21, -14.17],[5.12, -12.65],[5.03, -11.11],[4.92, -9.57],[4.81, -8.03]] },
  paris: { outline: [[20.00, -26.00],[19.98, -25.02],[19.90, -24.04],[19.78, -23.07],[19.62, -22.10],[19.40, -21.14],[19.14, -20.19],[18.83, -19.26],[18.48, -18.35],[18.08, -17.45],[17.64, -16.57],[17.15, -15.72],[16.63, -14.89],[16.06, -14.09],[15.46, -13.31],[14.82, -12.57],[14.14, -11.86],[13.43, -11.18],[12.69, -10.54],[11.91, -9.94],[11.11, -9.37],[10.28, -8.85],[9.43, -8.36],[8.55, -7.92],[7.65, -7.52],[6.74, -7.17],[5.81, -6.86],[4.86, -6.60],[3.90, -6.38],[2.93, -6.22],[1.96, -6.10],[0.98, -6.02],[0.00, -6.00],[-0.98, -6.02],[-1.96, -6.10],[-2.93, -6.22],[-3.90, -6.38],[-4.86, -6.60],[-5.81, -6.86],[-6.74, -7.17],[-7.65, -7.52],[-8.55, -7.92],[-9.43, -8.36],[-10.28, -8.85],[-11.11, -9.37],[-11.91, -9.94],[-12.69, -10.54],[-13.43, -11.18],[-14.14, -11.86],[-14.82, -12.57],[-15.46, -13.31],[-16.06, -14.09],[-16.63, -14.89],[-17.15, -15.72],[-17.64, -16.57],[-18.08, -17.45],[-18.48, -18.35],[-18.83, -19.26],[-18.77, -20.30],[-17.93, -21.51],[-17.17, -22.58],[-16.49, -23.55],[-15.87, -24.44],[-15.30, -25.25],[-14.77, -26.00],[-14.28, -26.70],[-13.82, -27.36],[-13.38, -27.98],[-12.96, -28.58],[-12.56, -29.15],[-12.18, -29.69],[-11.80, -30.22],[-11.44, -30.74],[-11.09, -31.24],[-10.74, -31.74],[-10.39, -32.23],[-10.05, -32.72],[-9.71, -33.20],[-9.37, -33.69],[-9.03, -34.18],[-8.68, -34.68],[-8.25, -35.10],[-7.79, -35.49],[-7.33, -35.88],[-6.87, -36.28],[-6.40, -36.67],[-5.92, -37.08],[-5.43, -37.49],[-4.94, -37.91],[-4.42, -38.35],[-3.88, -38.81],[-3.33, -39.28],[-2.74, -39.78],[-2.12, -40.30],[-1.46, -40.86],[-0.76, -41.45],[-0.00, -42.10],[0.83, -42.80],[1.73, -43.56],[2.73, -44.41],[3.85, -45.36],[4.86, -45.40],[5.81, -45.14],[6.74, -44.83],[7.65, -44.48],[8.55, -44.08],[9.43, -43.64],[10.28, -43.15],[11.11, -42.63],[11.91, -42.06],[12.69, -41.46],[13.43, -40.82],[14.14, -40.14],[14.82, -39.43],[15.46, -38.69],[16.06, -37.91],[16.63, -37.11],[17.15, -36.28],[17.64, -35.43],[18.08, -34.55],[18.48, -33.65],[18.83, -32.74],[19.14, -31.81],[19.40, -30.86],[19.62, -29.90],[19.78, -28.93],[19.90, -27.96],[19.98, -26.98]], quay: [[4.10, -45.57],[2.95, -44.60],[1.80, -43.62],[0.65, -42.65],[-0.50, -41.67],[-1.65, -40.70],[-2.81, -39.72],[-3.96, -38.74],[-5.11, -37.77],[-6.26, -36.79],[-7.41, -35.82],[-8.56, -34.84],[-9.44, -33.60],[-10.31, -32.35],[-11.18, -31.11],[-12.06, -29.86],[-12.93, -28.62],[-13.81, -27.38],[-14.68, -26.13],[-15.55, -24.89],[-16.43, -23.64],[-17.30, -22.40],[-18.18, -21.16],[-19.05, -19.91],[-17.72, -20.34],[-16.82, -21.52],[-15.93, -22.68],[-15.04, -23.84],[-14.16, -24.99],[-13.28, -26.12],[-12.41, -27.24],[-11.56, -28.34],[-10.72, -29.44],[-9.91, -30.53],[-9.12, -31.62],[-8.34, -32.72],[-7.59, -33.83],[-6.57, -34.70],[-5.56, -35.58],[-4.55, -36.48],[-3.54, -37.41],[-2.52, -38.35],[-1.50, -39.30],[-0.46, -40.27],[0.59, -41.25],[1.66, -42.23],[2.73, -43.22],[3.81, -44.20]] } };

  if (RIVERW) { // Update 110/111: bridge rails + posts where asphalt crosses the band (CRING idiom, main 10:09); crossings found by sampling roadAsphalt along each segment (runs 2..16u = transverse; longer = road along the bank - no bridge); the road AXIS is measured from the local asphalt (longest of 4 sampled spans), the rail span is measured by walking the road edge over water - oblique crossings keep rails along the road (111 fix: perpendicular-to-river put diagonal rails across the deck); no colliders, no placement change
    const seen = [];
    const spanOn = (x, z, ax, az, fn, lim) => { let lo = 0, hi = 0; while (lo > -lim && fn(x - ax * (lo - .5), z - az * (lo - .5))) lo -= .5; while (hi < lim && fn(x + ax * (hi + .5), z + az * (hi + .5))) hi += .5; return [lo, hi]; };
    for (const [x0, z0, x1, z1] of RIVERW) {
      const L = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / L, dz = (z1 - z0) / L;
      let run = null;
      for (let t = 0; t <= L + .01; t += .5) {
        const on = t <= L && roadAsphalt(x0 + dx * Math.min(t, L), z0 + dz * Math.min(t, L), 0);
        if (on && !run) run = { t0: t };
        if (!on && run) {
          const rl = t - run.t0;
          if (rl >= 2 && rl <= 16) { const mx = x0 + dx * (run.t0 + t) / 2, mz = z0 + dz * (run.t0 + t) / 2;
            if (!seen.some(q => Math.hypot(q[0] - mx, q[1] - mz) < 4)) { seen.push([mx, mz]);
              let ax = 1, az = 0, best = -1; // road axis: longest asphalt span through the crossing among 4 directions
              for (const f of [0, .25, .5, .75]) { const ca = Math.cos(f * Math.PI), sa = Math.sin(f * Math.PI);
                const sp = spanOn(mx, mz, ca, sa, (qx, qz) => roadAsphalt(qx, qz, 0), 24); if (sp[1] - sp[0] > best) { best = sp[1] - sp[0]; ax = ca; az = sa; } }
              const pp = spanOn(mx, mz, -az, ax, (qx, qz) => roadAsphalt(qx, qz, 0), 8); // perpendicular asphalt span through the crossing
              if (pp[1] - pp[0] < 4) continue; // Update 112b: a sub-4u perpendicular span is an asphalt SLIVER, not a road (measured at the paris ring x=-78 / band-end joint (-81,47): pp 2u put a rail mid-road over the dashes) - deck read stands, no rails at a degenerate crossing
              const cm = (pp[0] + pp[1]) / 2, cx0 = mx - az * cm, cz0 = mz + ax * cm; // Update 112: project the crossing mid onto the band centre along the measured perpendicular - the river-sampled mid sits off the road centreline at oblique crossings, so a symmetric half-width about it landed an edge line off the asphalt (111 recorded limit, main 10:28 follow-up)
              const hw = Math.max(2, Math.min(6, (pp[1] - pp[0]) / 2 - .3));
              for (const s of [-1, 1]) { let ex = cx0 - az * s * hw, ez = cz0 + ax * s * hw;
                for (let k = 0; k < 6 && !roadAsphalt(ex, ez, 0); k++) { ex += az * s * .5; ez -= ax * s * .5; } // the .5-step span walk can overshoot a strict road boundary by > .3 (measured 112 at the ring band); walk the edge line back onto the asphalt before placing
                if (!roadAsphalt(ex, ez, 0)) continue;
                const wsp = spanOn(ex, ez, ax, az, (qx, qz) => inRiver(qx, qz, .2), 14); // water span along the road edge
                const deckW = pp[1] - pp[0], iw = Math.sign((cx0 - ex) * -az + (cz0 - ez) * ax) || 1; // Update 112b (main 10:50: the KL 25u edge rail traversed the intersecting x=0 arm corridor, crossing its dashes): split the water span where the asphalt INWARD of the edge line runs deeper than the deck's own width - the rail then ends at the intersecting corridor instead of barring it. Inward is derived from the WALKED edge position (the nominal edge can start off-asphalt and the .5-walk can land on the far edge, flipping the side)
                const emitRail = (u0, u1) => { const wl = u1 - u0; if (wl < 2) return; const cx2 = ex + ax * (u0 + u1) / 2, cz2 = ez + az * (u0 + u1) / 2;
                  const rail = put(world, box(.5, .5, wl + .8, '#7a5a42'), cx2, 1.05, cz2); rail.rotation.y = Math.atan2(ax, az); rail.castShadow = false;
                  for (const e of [-1, 1]) put(world, box(.5, 1.2, .5, '#7a5a42'), cx2 + ax * e * (wl / 2 - .1), 1.1, cz2 + az * e * (wl / 2 - .1)).castShadow = false; };
                for (let u = wsp[0], run0 = null; u <= wsp[1] + .999; u += .5) { const uu = Math.min(u, wsp[1]);
                  const depth = spanOn(ex + ax * uu, ez + az * uu, -az * iw, ax * iw, (qx, qz) => roadAsphalt(qx, qz, 0), deckW + 6)[1];
                  if (uu < wsp[1] && depth <= deckW + 1) { if (run0 === null) run0 = uu; } else if (run0 !== null) { emitRail(run0, uu); run0 = null; } } } } }
          run = null; } } } }
  // plaza + landmark
  const pn = PLAZA_NOTCH[id];
  if (pn) { // notched plaza: extruded outline (top at .9 like the cylinder) + flat quay strip along the notch
    const psh = new THREE.Shape(); pn.outline.forEach(([px, pz], i) => { if (i) psh.lineTo(px, -pz); else psh.moveTo(px, -pz); }); psh.closePath();
    const pg = new THREE.ExtrudeGeometry(psh, { depth: .3, bevelEnabled: false }); pg.rotateX(-Math.PI / 2);
    const pm = new THREE.Mesh(pg, M(plaza)); pm.position.y = .6; pm.castShadow = false; world.add(pm);
    if (pn.quay) { const qsh = new THREE.Shape(); pn.quay.forEach(([px, pz], i) => { if (i) qsh.lineTo(px, -pz); else qsh.moveTo(px, -pz); }); qsh.closePath();
      const qg = new THREE.ShapeGeometry(qsh); qg.rotateX(-Math.PI / 2);
      const qm = new THREE.Mesh(qg, M(plaza)); qm.position.y = .92; qm.castShadow = false; world.add(qm); }
  } else put(world, cyl(20, 20, .3, 24, plaza), 0, .75, -26).castShadow = false;
  const lm = new THREE.Group(); lm.position.set(0, .7, -26); world.add(lm);
  let lr = LM[def.landmark](lm);
  { const bb = new THREE.Box3().setFromObject(lm); const hgt = bb.max.y - bb.min.y; const cap = ({ rio: 20, newyork: 14, dubai: 20, toronto: 20, berlin: 20, seoul: 20, paris: 20, london: 20, buenosaires: 20, bangkok: 19, beijing: 20, athens: 20, nairobi: 20, jakarta: 20, madrid: 20, marrakesh: 20, lima: 20, lisbon: 20, amsterdam: 20, bogota: 20, auckland: 21, lagos: 18, stockholm: 21, kualalumpur: 20, moscow: 20, tokyo: 20, istanbul: 20 })[id] || 13; if (hgt > cap) { const k = cap / hgt; lm.scale.setScalar(k); lr = lr * k;
    if (id === 'london') colliders.push({ x: 0, z: -26 + 10 * k, r: Math.hypot(8, 4) * k }); } } // clock's palace wing (local box 8x16 at z=10, running south along the bank) would otherwise clip through players past the main disc
  colliders.push({ x: 0, z: -26, r: lr });
  places.push({ name: null, x: 0, z: -26, r: 20 });
  if (id === 'newyork') extrasNY(world, colliders, places, R);
  // swimming pool (walkable water, slows and lowers the swimmer) + harbour for coastal cities
  const POOL = { x: 0, z: 0, hw: 7, hd: 4.5 }; let hasPool = false;
  for (const [px, pz] of [[26, -14], [-24, -12], [24, 14], [-24, 16], [24, -46], [-24, -46], [24, 58], [-20, 58], [-56, 10], [56, -10]]) {
    const clear = Math.abs(px) < S - 14 && inLand(px - 12, pz) && inLand(px + 12, pz) && inLand(px, pz - 10) && inLand(px, pz + 10)
      && !onRoad(px - 9, pz) && !onRoad(px + 9, pz) && !onRoad(px, pz - 6) && !onRoad(px, pz + 6)
      && !places.some(p => Math.hypot(px - p.x, pz - p.z) < p.r + 10) && !colliders.some(k => Math.hypot(px - k.x, pz - k.z) < k.r + 10)
      && !(RCUTS.length && (NEWCLEAR[id] || []).some(([cx, cz, cr]) => Math.abs(px - cx) < cr + POOL.hw + 2 && Math.abs(pz - cz) < cr + POOL.hd + 2)); // cut cities: the pool stays out of named-place clearings
    if (clear) { POOL.x = px; POOL.z = pz; hasPool = true; break; }
  }
  if (hasPool) {
    put(world, box(POOL.hw * 2 + 2, .08, POOL.hd * 2 + 2, '#e8e4d8'), POOL.x, .6, POOL.z).castShadow = false;
    { const pw = put(world, box(POOL.hw * 2, .1, POOL.hd * 2, '#37c3e6', { roughness: .15, metalness: .05, emissive: '#1b7f9c', emissiveIntensity: .25 }), POOL.x, .66, POOL.z); pw.castShadow = false; }
    for (const s of [-1, 1]) put(world, cyl(.08, .08, 1.3, 6, '#cfd6dc'), POOL.x - POOL.hw - .3, 1.3, POOL.z + s * 1.2);
    put(world, box(1.6, .08, .9, '#f2f0e6'), POOL.x + POOL.hw + 2.2, .9, POOL.z - 1).castShadow = false;
    places.push({ name: 'Pool', x: POOL.x, z: POOL.z, r: 9 });
  }
  const inPool = (x, z) => hasPool && Math.abs(x - POOL.x) < POOL.hw && Math.abs(z - POOL.z) < POOL.hd;
  const SWIM_OUT = 8; /* Update 118t (user request Oct 29 17:17, todo-01M63QSTFJECNH2YKS3NMHB1JG): beach swimming - the swimmable near-shore sea band, this many units past the waterline. Gameplay arrangement: a uniform shallow wade/swim margin on every city waterfront, NOT a surveyed bathymetry. */
  const inSea = (x, z) => { // 118t: inside the sea swim band (past the waterline, within SWIM_OUT, laterally inside the playable window)
    if (!def.water) return false;
    if (def.water === 'south') { const wl = SHORE_ON ? shoreAt(x) : S - 4; return z > wl && z <= wl + SWIM_OUT && Math.abs(x) <= lim; }
    if (def.water === 'east') { const wl = ESH ? shoreX(z) : S - 4; return x > wl && x <= wl + SWIM_OUT && Math.abs(z) <= lim; }
    if (def.water === 'west') { const wl = -(S - 4); return x < wl && x >= wl - SWIM_OUT && Math.abs(z) <= lim; }
    if (def.water === 'north') { const wl = -(S - 4); return z < wl && z >= wl - SWIM_OUT && Math.abs(x) <= lim; }
    return false;
  };
  const inSwim = (x, z) => inPool(x, z) || inSea(x, z); // 118t: one predicate for every swimmable water (pool OR sea swim band)
  const BALL_OUT = 18; /* Update 148 (Main 2:36:41 - the beach/ball outcome's unimplemented water behaviour is an implementation gap, not a final-test item): balls may soak PAST the swim band into the near open sea, this many units past the waterline; contained by clampBall, washed back onshore by the app.js drift. Gameplay arrangement, NOT bathymetry (118t class). */
  const inSeaOpen = (x, z) => { // 148: any near sea past the waterline (no SWIM_OUT cap), laterally inside the playable window - ball float/soak zone
    if (!def.water) return false;
    if (def.water === 'south') { const wl = SHORE_ON ? shoreAt(x) : S - 4; return z > wl && z <= wl + BALL_OUT && Math.abs(x) <= lim; }
    if (def.water === 'east') { const wl = ESH ? shoreX(z) : S - 4; return x > wl && x <= wl + BALL_OUT && Math.abs(z) <= lim; }
    if (def.water === 'west') { const wl = -(S - 4); return x < wl && x >= wl - BALL_OUT && Math.abs(z) <= lim; }
    if (def.water === 'north') { const wl = -(S - 4); return z < wl && z >= wl - BALL_OUT && Math.abs(x) <= lim; }
    return false;
  };
  const boatColliders = [];
  let shore = null, hp = null;
  if (def.water) {
    const sg = (def.water === 'west' || def.water === 'north') ? -1 : 1, ax = (def.water === 'west' || def.water === 'east') ? 'x' : 'z';
    let line = sg * (ESH ? shoreX(22) : SHORE_ON ? shoreAt(22) : S - 6); // coastline coordinate on the water axis
    const P = (a, l) => ax === 'x' ? [a, l] : [l, a];             // (along-water-axis, lateral) -> x,z
    const SLOPE = l => ESH ? Math.atan((shoreX(l + 4) - shoreX(l - 4)) / 8) : SHORE_ON ? -Math.atan((shoreAt(l + 4) - shoreAt(l - 4)) / 8) : 0; // yaw that turns a z-aligned object to the local shore normal
    const PS = (off, l) => ESH ? [shoreX(l) + off, l] : SHORE_ON ? [l, shoreAt(l) + off] : P(line + sg * off, l); // offset from the local shoreline (sloped shore) or the flat line
    const place = (g, a, l, ry) => { const q = P(a, l); g.position.set(q[0], 1.0, q[1]); g.rotation.y = ry || 0; world.add(g); return g; };
    // pier: first lateral spot clear of landmarks and extras
    let LAT = 22;
    for (const cand of [22, -22, 36, -36, 8, -8, 50, -50]) {
      const q = P(line + sg * 2, cand);
      const bad = colliders.some(k => Math.hypot(q[0] - k.x, q[1] - k.z) < k.r + 9) || places.some(pp => pp.name && Math.hypot(q[0] - pp.x, q[1] - pp.z) < pp.r + 8);
      if (!bad) { LAT = cand; break; }
    }
    if (ESH) line = shoreX(LAT); else if (SHORE_ON) line = sg * shoreAt(LAT);
    { const q = P(line - sg * 2, LAT); places.push({ name: 'Harbour pier', x: q[0], z: q[1], r: 8 }); hp = q; }
    const pier = new THREE.Group();
    put(pier, box(ax === 'x' ? 14 : 3.2, .3, ax === 'x' ? 3.2 : 14, '#8a6a46'), 0, -.1, 0).castShadow = false;
    for (let k = -3; k <= 3; k++) put(pier, cyl(.18, .18, 1.6, 6, '#5a4630'), ax === 'x' ? k * 2.2 : 1.6, -.5, ax === 'x' ? 1.6 : k * 2.2);
    { const q = PS(5, LAT); pier.position.set(q[0], 1.03, q[1]); pier.rotation.y = SLOPE(LAT); world.add(pier); } /* deck top 1.08, clear of the water surface at 1.0 (was coplanar: z-fighting stripes) */
    const boatMesh = (hull, cab) => { const g = new THREE.Group(); put(g, box(2.2, .7, 5.4, hull), 0, .1, 0); put(g, cone(1.1, 1.8, 4, hull), 0, .1, 3.5).rotation.set(Math.PI / 2, Math.PI / 4, 0); put(g, box(1.5, .9, 1.8, cab), 0, .85, -.4); return g; };
    // moored small boats beside the pier
    [['#d94b3d', '#f2f0e6', 28], ['#2f7fd1', '#f2f0e6', 16]].forEach(b => { const g = boatMesh(b[0], b[1]); const q = PS(5, LAT + b[2] - 22); g.position.set(q[0], 1.0, q[1]); g.rotation.y = (ax === 'x' ? Math.PI / 2 : 0) + SLOPE(LAT + b[2] - 22); g.scale.setScalar(.9); world.add(g); });
    // anchored ship offshore (non-walkable, boats steer round it)
    const ship = new THREE.Group();
    put(ship, box(7, 3, 24, '#27384a'), 0, 1.5, 0); put(ship, box(6.2, 1.2, 20, '#c8402f'), 0, 3.4, 0);
    put(ship, box(5, 2.6, 8, '#f2f0e6'), 0, 5.3, -3); put(ship, box(3, 1.6, 4, '#f2f0e6'), 0, 7.4, -3); put(ship, cyl(.7, .9, 2.6, 8, '#e8b923'), 0, 8.4, -5);
    for (let k = 0; k < 4; k++) put(ship, box(1.2, 1.4, 1.6, '#b4552d'), 0, 4.6, 5 + k * 1.7);
    { const q = PS(38, LAT - 48); ship.position.set(q[0], .3, q[1]); ship.rotation.y = (ax === 'x' ? Math.PI / 2 : 0) + SLOPE(LAT - 48); world.add(ship); boatColliders.push({ x: q[0], z: q[1], r: 9 }); }
    { const f = buildFerry(); const q = PS(ESH ? 18 : 9, LAT + (ESH ? 20 : 13)); f.position.set(q[0], .3, q[1]); f.rotation.y = (ax === 'x' ? Math.PI / 2 : 0) + SLOPE(LAT + 13); world.add(f); boatColliders.push({ x: q[0], z: q[1], r: 7 }); }
    if (PROMSET.has(id) && !ESH && !SHORE_ON) { // flat-shore pilot only; poly/east shores keep their own line for a later pass
      PROM = { ax, sg, line: sg * (S - 6) };
      for (let l = -S + 12; l <= S - 12; l += 8) { // continuous paved walk, render-only: no draws, no colliders, players stroll it freely
        const qw = PS(-4, l);
        if (roadAsphalt(qw[0], qw[1], 4.4)) continue; /* arm-road mouths run to the water edge: the walk and railing skip them rather than fight the asphalt */
        put(world, box(ax === 'x' ? 4.6 : 7.98, .08, ax === 'x' ? 7.98 : 4.6, '#d8d2c2'), qw[0], .68, qw[1]).castShadow = false; /* top .72: above lane paint and road tops (.69) so no coplanar fight where lane overruns cross the shore band */
        if (Math.abs(l - LAT) > 7) { // the railing opens at the pier mouth
          const qr = PS(-1, l);
          put(world, box(ax === 'x' ? .14 : 7.98, .1, ax === 'x' ? 7.98 : .14, '#8a9298'), qr[0], 1.62, qr[1]).castShadow = false;
          for (const k of [-1, 0, 1]) { const qp = PS(-1, l + k * 2.6); put(world, cyl(.07, .07, 1.1, 5, '#6a7278'), qp[0], 1.15, qp[1]); }
        }
      }
      for (let l = -S + 18; l <= S - 18; l += 24) { // lamps and staggered benches, the same deterministic no-R() pattern as the road lamps
        const ql = PS(-6.6, l);
        if (inLand(ql[0], ql[1]) && !roadAsphalt(ql[0], ql[1], 1) && Math.hypot(ql[0] - hp[0], ql[1] - hp[1]) > 6 && !colliders.some(c => Math.hypot(c.x - ql[0], c.z - ql[1]) < c.r + 1) && !places.some(pp => pp.name && Math.hypot(ql[0] - pp.x, ql[1] - pp.z) < pp.r + 2)) {
          put(world, cyl(.1, .12, 4.2, 5, '#3a3d44'), ql[0], 2.7, ql[1]); put(world, sph(.3, '#fff2b0', { emissive: '#fff2b0', emissiveIntensity: .9 }), ql[0], 4.9, ql[1]); colliders.push({ x: ql[0], z: ql[1], r: .45 }); }
        const qb = PS(-4, l + 12);
        if (l + 12 <= S - 18 && inLand(qb[0], qb[1]) && !roadAsphalt(qb[0], qb[1], 1) && Math.hypot(qb[0] - hp[0], qb[1] - hp[1]) > 6 && !colliders.some(c => Math.hypot(c.x - qb[0], c.z - qb[1]) < c.r + 1) && !places.some(pp => pp.name && Math.hypot(qb[0] - pp.x, qb[1] - pp.z) < pp.r + 2)) {
          put(world, box(ax === 'x' ? .7 : 2.2, .5, ax === 'x' ? 2.2 : .7, '#8a6a46'), qb[0], .95, qb[1]); colliders.push({ x: qb[0], z: qb[1], r: .9 }); }
      }
      if (id === 'buenosaires') places.push({ name: 'Puerto Madero', x: line - 5, z: 52, r: 14 }); // Update 92: the sourced docklands barrio on the Rio de la Plata riverbank, east and slightly south of the centre - the walk IS the waterfront, no building implied
    }
    if (def.shorePoly || ESH) { // Update 89 (Toronto Harbourfront, poly shore) + Update 91 (Mumbai Marine Drive, east shore): the poly/east passes deferred at the PROMSET pilot:
      // a paved walk follows the curved waterline (sourced: Harbourfront/Queens Quay is Toronto's downtown waterfront
      // district - dev/HK-SOURCES.md Update 89); lamps/benches reuse the pilot's deterministic no-R() guards, walk and
      // bench yaw follow SLOPE(l) so the fabric hugs the poly shore. Render-only walk: no draws consumed, no stream shift.
      for (let l = -S + 12; l <= S - 12; l += 8) {
        const qw = PS(-4, l);
        if (roadAsphalt(qw[0], qw[1], 4.4)) continue; // arm-road mouths run to the water edge: skip, don't fight the asphalt
        if (colliders.some(c => Math.hypot(c.x - qw[0], c.z - qw[1]) < c.r + 3)) continue; // buildings/props standing at the water's edge: no walk through their walls
        if (Math.abs(SLOPE(l)) > .8) continue; // the poly's sharpest bay corner keeps its own line - straight 8u chords can't read a 75-degree turn
        const wm = put(world, box(ax === 'x' ? 4.6 : 7.98, .08, ax === 'x' ? 7.98 : 4.6, '#d8d2c2'), qw[0], .68, qw[1]); // elongated along the shore axis
        wm.rotation.y = SLOPE(l); wm.castShadow = false; // top .72, same height idiom as the pilot walk
      }
      for (let l = -S + 18; l <= S - 18; l += 24) { // lamps and staggered benches, the pilot's deterministic pattern
        const ql = PS(-6.6, l);
        if (inLand(ql[0], ql[1]) && !roadAsphalt(ql[0], ql[1], 1) && Math.hypot(ql[0] - hp[0], ql[1] - hp[1]) > 6 && !colliders.some(c => Math.hypot(c.x - ql[0], c.z - ql[1]) < c.r + 1) && !places.some(pp => pp.name && Math.hypot(ql[0] - pp.x, ql[1] - pp.z) < pp.r + 2)) {
          put(world, cyl(.1, .12, 4.2, 5, '#3a3d44'), ql[0], 2.7, ql[1]); put(world, sph(.3, '#fff2b0', { emissive: '#fff2b0', emissiveIntensity: .9 }), ql[0], 4.9, ql[1]); colliders.push({ x: ql[0], z: ql[1], r: .45 }); }
        const qb = PS(-4, l + 12);
        if (l + 12 <= S - 18 && inLand(qb[0], qb[1]) && !roadAsphalt(qb[0], qb[1], 1) && Math.hypot(qb[0] - hp[0], qb[1] - hp[1]) > 6 && !colliders.some(c => Math.hypot(c.x - qb[0], c.z - qb[1]) < c.r + 1) && !places.some(pp => pp.name && Math.hypot(qb[0] - pp.x, qb[1] - pp.z) < pp.r + 2)) {
          const bm = put(world, box(ax === 'x' ? .7 : 2.2, .5, ax === 'x' ? 2.2 : .7, '#8a6a46'), qb[0], .95, qb[1]); bm.rotation.y = SLOPE(l + 12); colliders.push({ x: qb[0], z: qb[1], r: .9 }); }
      }
      if (ESH) places.push({ name: 'Apollo Bunder', x: shoreX(40) - 5, z: 40, r: 14 }); // Update 91a: the Gateway's own harbour-front pier area on THIS (east/harbour) side - corrects Update 91's 'Marine Drive', which the same source places on the west-south-west-facing Back Bay (main 8:07)
      else places.push({ name: 'Harbourfront', x: 44, z: shoreAt(44) - 5, r: 14 }); // the real waterfront district name on the dry wedge (the wet generic quarter labels stay omitted)
    }
    shore = { ax, sg, line, lat: LAT };
  }
  if (id === 'kualalumpur') places.push({ name: 'Masjid Jamek marker', x: -26, z: -56, r: 10 }); // Update 90: named marker at the sourced Klang/Gombak confluence - NO mosque geometry, the label must not imply the building was built (main 7:55). Update 114 (Main 12:38): gated to kualalumpur - the RIVERW condition leaked this KL-confluence label at KL coords into london/paris/moscow/berlin places streams; bogus labels are a defect, not accepted geography
  if (id === 'london') places.push({ name: 'Trafalgar Square-inspired plaza', x: -23.29, z: -67.61, r: 12 }); /* Update 114 (Main 12:48): pre-registered sourced-landmark clearing - the fabric/decor/spot passes all run BEFORE extrasLondon builds the plaza, so the accepted source-grounded site is registered up front and the existing places guards keep generic fabric clear of it (real marker removal had freed a quarter lot building over this site; fabric adapts, the sourced landmark keeps its relationship). extrasLondon pins this exact site and does not re-push the place. */
  // airport: first clear spot away from roads, the landmark, the pool and the pier
  let airport = null;
  for (const mg of [22, 15, 10]) { if (airport) break;
  for (const [ax2, az2] of [[-48, 24], [48, 24], [-50, -50], [50, -50], [-52, 56], [52, 56], [0, 56], [-30, -56], [30, -56], [-56, 0], [56, 0], [-56, 30], [56, 30], [-56, -28], [56, -28], [-20, 62], [20, 62], [-62, 60], [62, 60], [50, -24], [40, -56], [44, -38], [-45, -25.5] /* Update 118: lima's relocation site (appended after 113b's, before the ESH entry - no other city's pick changes: every other city selects an earlier entry; mumbai/toronto keep their ESH tail). The sourced Rimac band crosses [50,-50]'s footprint (16 wet pad-1 grid samples, centreline 0.03-4.64u through the eastern half); a replica validated against today's [50,-50]@mg22 found NO listed candidate passing at any margin with the river, and map-wide probing (limasites.mjs) showed the SE strip is lima's only road-free region, split by the band (x=0 avenue + z=0 avenue + plaza margin + river leave a <2u contradiction). With the x=-40 street cut (RCUTS), (-45,-25.5) passes mg10 with >=10.5u river clearance on every pad row. Class: paris 113b (single forced move), NOT the Invalides permutation class */, ...(ESH ? [[-50, -40]] : [])]) { /* [44,-38] Update 113b (Main 11:47): paris's only pad-1 river-dry 40x34 site - map-wide probe: every other listed entry fails mg-independent road checks for paris, and the dry window bounded by the z=0 arm, the ring, the pool (26,-14) 30u and the diagonal Seine band leaves no site that also keeps the Les Invalides extra clear of the airport east-edge colliders ((43,-39) keeps Invalides but its SW grid corner (23,-56) samples 4.4u from the centreline < 5u pad-1). The Invalides extra therefore resites via its own site() search (accepted (63.98,-29.5) -> (63.98,-14.5), within its rad-40 of the sourced transform target); recorded as an affected placement. Appended LAST so no other city's pick changes */
    const ok = Math.abs(ax2) < S - 20 && Math.abs(az2) < S - 17 && inLand(ax2 - 20, az2) && inLand(ax2 + 20, az2)
      && !onRoad(ax2 - 22, az2) && !onRoad(ax2 + 22, az2) && !onRoad(ax2, az2 - 19) && !onRoad(ax2, az2 + 19) && !onRoad(ax2 - 20, az2 - 17) && !onRoad(ax2 + 20, az2 + 17) && !onRoad(ax2 - 20, az2 + 17) && !onRoad(ax2 + 20, az2 - 17)
      && !places.some(p => Math.hypot(ax2 - p.x, az2 - p.z) < (p.r > 12 ? p.r : 0) + mg) && !colliders.some(k => Math.hypot(ax2 - k.x, az2 - k.z) < k.r + mg) && !(hasPool && Math.hypot(ax2 - POOL.x, az2 - POOL.z) < 30)
      && !(() => { for (let dx = -20; dx <= 20; dx += 5) for (let dz = -17; dz <= 17; dz += 5.6) if (roadAsphalt(ax2 + dx, az2 + dz, 1)) return true; return false; })() // no road may cross the airfield footprint (the old 8-point check missed roads through the middle)
      && !(() => { for (let dx = -20; dx <= 20; dx += 5) for (let dz = -17; dz <= 17; dz += 5.6) if (inRiver(ax2 + dx, az2 + dz, 1)) return true; return false; })(); /* Update 113b (Main 11:47): no sourced river band may cross the airfield footprint - resolves the measured Seine through-crossing at paris (band enters (72,-62.26), exits (28,-61.26)); measured clearances keep london (1.32u band-edge), KL (22.5u) and moscow (24.1u) at [50,-50]. 113 attempt reverted pending owner authorization; the relocation was later directed in the main conversation. NOTE (Update 118, Main 13:47): this comment records history only - a code comment is never authority for relocation or any other action; authority comes from Main's live instructions */
    if (ok) { airport = { x: ax2, z: az2, arrive: [ax2, az2 + 8], yaw: Math.PI, r: 17 }; break; }
  } }
  if (airport && !def.noAirport) {
    const ap = buildAirport(); ap.position.set(airport.x, .62, airport.z); world.add(ap);
    for (const [lx, lz, r] of AIRPORT_COLLIDERS) colliders.push({ x: airport.x + lx, z: airport.z + lz, r });
    places.push({ name: CITY_AIRPORTS[id] ? CITY_AIRPORTS[id].name + ' (' + CITY_AIRPORTS[id].code + ')' : 'Airport', x: airport.x, z: airport.z, r: 28 });
  }
  const apBlock = (x, z, pad) => airport && Math.abs(x - airport.x) < AIRPORT_HALF.x + pad && Math.abs(z - airport.z) < AIRPORT_HALF.z + pad;
  // social stage: one per city, culturally themed (visual design only; perform/watch logic lives in app.js)
  let stage = null;
  { const th = STAGE_THEMES[id] || { roof: 'gable', bd: 'bands', c1: '#b3502e', c2: '#c99a3a', name: 'City stage' };
    for (const [sx, sz] of [[17, 14], [-17, 14], [58, 17], [58, -17], [-58, 17], [-58, -17], [17, 58], [-17, 58], [17, -58], [-17, -58], [58, -44], [-58, -44], ...(ESH ? [[-58, 11], [-54, 11]] : [])]) {
      const rectClear = (cx, cz, hw, hd) => !colliders.some(k => Math.abs(k.x - cx) < hw + k.r && Math.abs(k.z - cz) < hd + k.r);
      const ok = [[-9, -5], [9, -5], [-9, 17], [9, 17], [0, 6], [0, -5]].every(([dx, dz]) => { const x = sx + dx, z = sz + dz;
        return inLand(x, z) && !onRoad(x, z) && !(Math.abs(z) > 28 && Math.abs(z) < S - 14 && Math.abs(x) > 28 && Math.abs(x) < S - 14) && !apBlock(x, z, 8) && !inRiver(x, z, 2) && !(hasPool && Math.abs(x - POOL.x) < POOL.hw + 3 && Math.abs(z - POOL.z) < POOL.hd + 3); })
        && Math.hypot(sx, sz + 26) > 28
        && !places.some(pl => pl.name && Math.hypot(sx - pl.x, sz - pl.z) < pl.r + 12)
        && rectClear(sx, sz, 7, 5) && rectClear(sx, sz + 11, 10, 7);
      if (!ok || (RCUTS.length && (NEWCLEAR[id] || []).some(([cx, cz, cr]) => Math.abs(cx - sx) < cr + 10 && cz > sz - 4 - cr && cz < sz + 21 + cr))) continue; // cut cities: the stage and its audience apron keep clear of named-place clearings
      stage = { x: sx, z: sz, w: 12, d: 8, h: .9, ramp: 3 };
      const top = .62 + stage.h, W = stage.w, D = stage.d;
      put(world, box(W, stage.h, D, '#8a5a34'), sx, top - stage.h / 2, sz);
      put(world, box(W, .08, D, '#a9744b'), sx, top + .04, sz).castShadow = false;
      for (let i = -2; i <= 2; i++) put(world, box(.1, .025, D - .4, '#96613a'), sx + i * 2.2, top + .09, sz).castShadow = false;
      const ramp = put(world, box(4, stage.h, stage.ramp, '#8a5a34'), sx, top - stage.h / 2, sz + D / 2 + stage.ramp / 2);
      ramp.rotation.x = -Math.atan2(stage.h, stage.ramp);
      const stageCameraStart = world.children.length;
      // themed backdrop panel
      const bbz = sz - D / 2 + .3;
      put(world, box(W - 1.2, 3.6, .16, '#f0e6cf'), sx, top + 2.2, bbz);
      if (th.bd === 'bands') { put(world, box(W - 1.2, .3, .2, th.c2), sx, top + 3.9, bbz); put(world, box(W - 1.2, .3, .2, th.c2), sx, top + .55, bbz); }
      else if (th.bd === 'rays') { for (let k = -2; k <= 2; k++) { const rb = put(world, box(.22, 3, .18, th.c2), sx + k * 2.1, top + 2.2, bbz + .05); rb.rotation.z = -k * .34; } }
      else if (th.bd === 'arch') { for (let k = -3; k <= 3; k++) put(world, box(1.3, .45, .2, th.c2), sx + k * 1.5, top + 3.1 + Math.cos(k / 3 * 1.2) * .7, bbz + .05); }
      else { for (let k = 0; k < 6; k++) { const zb = put(world, box(.9, .4, .18, th.c2), sx - W / 2 + 1.6 + k * 1.7, top + 2.2 + (k % 2 ? .5 : -.1), bbz + .05); zb.rotation.z = k % 2 ? .5 : -.5; } }
      // canopy posts
      for (const [px, pz] of [[-W / 2 + .6, -D / 2 + .5], [W / 2 - .6, -D / 2 + .5], [-W / 2 + .6, D / 2 - .6], [W / 2 - .6, D / 2 - .6]]) {
        put(world, cyl(.14, .18, 5.2, 6, '#6d4426'), sx + px, top + 2.6, sz + pz);
        colliders.push({ x: sx + px, z: sz + pz, r: .45 });
      }
      // roof variants
      if (th.roof === 'gable') { const slope = .32, slabD = (D + 2.4) / 2, roofM = M(th.c1);
        const r1 = put(world, new THREE.Mesh(new THREE.BoxGeometry(W + 2.4, .16, slabD), roofM), sx, top + 5.4 + Math.tan(slope) * slabD / 2, sz - slabD / 2 + .2); r1.rotation.x = slope;
        const r2 = put(world, new THREE.Mesh(new THREE.BoxGeometry(W + 2.4, .16, slabD), roofM), sx, top + 5.4 + Math.tan(slope) * slabD / 2, sz + slabD / 2 - .2); r2.rotation.x = -slope; }
      else if (th.roof === 'flat') { put(world, box(W + 2.2, .18, D + 2, th.c1), sx, top + 5.3, sz);
        put(world, box(W * .7, .7, .12, th.c2), sx, top + 4.8, sz + D / 2 + 1); }
      else if (th.roof === 'tier') { put(world, box(W + 2.4, .16, D + 2.4, th.c1), sx, top + 5.35, sz);
        put(world, box(W * .6, .16, D * .66, th.c1), sx, top + 6.2, sz);
        put(world, cone(1, .9, 4, th.c2), sx, top + 6.75, sz).rotation.y = .78; }
      else if (th.roof === 'dome') { put(world, box(W + 1.8, .15, D + 1.8, th.c1), sx, top + 5.25, sz);
        const dm = put(world, sph(2.7, th.c1), sx, top + 5.45, sz); dm.scale.y = .62;
        put(world, cyl(.1, .18, 1.3, 6, th.c2), sx, top + 7.5, sz); }
      else if (th.roof === 'marquee') { put(world, box(W + 2.2, .18, D + 2, th.c1), sx, top + 5.3, sz);
        put(world, box(4.2, 1.8, .35, th.c1), sx, top + 6.4, sz + D / 2 + .9);
        for (let k = -3; k <= 3; k++) put(world, sph(.15, th.c2, { emissive: th.c2, emissiveIntensity: .85 }), sx + k * .56, top + 5.65, sz + D / 2 + 1.1).castShadow = false; }
      else if (th.roof === 'pergola') { for (let k = -2; k <= 2; k++) put(world, box(W + 2, .22, .5, th.c1), sx, top + 5.35, sz + k * (D + 1.2) / 5);
        put(world, box(.45, .18, D + 1.8, th.c1), sx - W / 2 + .6, top + 5.2, sz); put(world, box(.45, .18, D + 1.8, th.c1), sx + W / 2 - .6, top + 5.2, sz); }
      else if (th.roof === 'thatch') { put(world, cone(6.2, 2.6, 4, th.c1), sx, top + 6.5, sz).rotation.y = .78; }
      else if (th.roof === 'sail') { const s1 = put(world, box(W * .5, 4.2, .25, th.c1), sx - 2.2, top + 6.8, sz - 1.2); s1.rotation.z = .32;
        const s2 = put(world, box(W * .38, 3.1, .25, th.c1), sx + 2.6, top + 6.3, sz - 1); s2.rotation.z = -.38; }
      // Keep canopy/backdrop meshes as camera ray targets, including after static merging.
      occluders.push(...world.children.slice(stageCameraStart));
      // speakers + mic
      for (const spx of [-W / 2 + 1.05, W / 2 - 1.05]) {
        put(world, box(1.05, 1.4, .85, '#22262b'), sx + spx, top + .74, sz + D / 2 - .9);
        put(world, box(.8, .7, .65, '#2c3138'), sx + spx, top + 1.8, sz + D / 2 - .9);
      }
      put(world, cyl(.16, .2, .08, 8, '#2c3138'), sx, top + .12, sz + 1.2);
      put(world, cyl(.04, .04, 1.35, 6, '#2c3138'), sx, top + .8, sz + 1.2);
      put(world, sph(.13, '#3a3f46'), sx, top + 1.52, sz + 1.2);
      // audience bench arcs
      for (let row = 0; row < 3; row++) { const rr = 6.5 + row * 2;
        for (const side of [-1, 1]) for (let k = 0; k < 3; k++) { const a = side * (.38 + k * .36);
          const bx = sx + Math.sin(a) * rr, bz2 = sz + D / 2 + 1 + Math.cos(a) * rr * .82;
          const seat = put(world, box(1.7, .16, .5, '#a9744b'), bx, 1.04, bz2, a);
          put(world, box(.16, .42, .4, '#8a5a34'), bx - Math.cos(a) * .65, .83, bz2 + Math.sin(a) * .65, a);
          put(world, box(.16, .42, .4, '#8a5a34'), bx + Math.cos(a) * .65, .83, bz2 - Math.sin(a) * .65, a);
          seat.castShadow = false; colliders.push({ x: bx, z: bz2, r: .8 }); } }
      // audience court
      put(world, box(18, .07, 11, '#d8c9a0'), sx, .655, sz + D / 2 + 6.5).castShadow = false;
      // animated light beams (swept in app.js)
      const beams = [];
      [th.c2, th.c1, '#ffffff'].forEach((c, i) => {
        const bm = new THREE.Mesh(new THREE.ConeGeometry(2, 8.5, 10, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .15, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
        bm.position.set(sx - 3.5 + i * 3.5, top + 2.6, sz + 1.4); bm.castShadow = false; world.add(bm); beams.push(bm);
      });
      stage.beams = beams;
      places.push({ name: th.name, x: sx, z: sz, r: 18 });
      break;
    } }
  // streetscape: avenue trees, benches, bus shelters and crosswalks along the main roads
  { const spots = [];
    for (let t = -S + 12; t < S - 8; t += 13) { for (const side of [-8.2, 8.2]) { spots.push([side, t, 'tree']); spots.push([t, side, 'tree']); } }
    for (let t = -S + 20; t < S - 14; t += 27) { spots.push([5.6, t, 'bench']); spots.push([t, -5.6, 'bench']); }
    for (const [x, z] of [[7.4, -50], [-7.4, 38], [30, 7.4], [-60, -7.4]]) spots.push([x, z, 'shelter']);
    for (const [x, z, kind] of spots) {
      if (onDiag(x, z, 2.5) || (ARC && inArc(x, z, ARC.hw + 2.5)) || (CIRC && circD(x, z) < CIRC.r1 + 2.5) /* circle island kept clear of furniture too */ || nearCut(x, z, 10) || !inLand(x, z) || inRiver(x, z, 2) || apBlock(x, z, 4) || Math.hypot(x, z + 26) < 23 || (hasPool && Math.abs(x - POOL.x) < POOL.hw + 4 && Math.abs(z - POOL.z) < POOL.hd + 4)) continue;
      if (Math.abs(x + 40) < 6 || Math.abs(z - 40) < 6) continue;
      if (colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 1.6) || places.some(p => p.name && Math.hypot(p.x - x, p.z - z) < p.r)) continue;
      if (kind === 'tree') { const t = PALMS.has(id) ? palm(.85 + R() * .3) : leafyTree(1, def.tree); t.position.set(x, .6, z); if (!PALMS.has(id)) t.scale.setScalar(.55 + R() * .25); world.add(t); occPush(t, PALMS.has(id)); colliders.push({ x, z, r: .5 }); }
      else if (kind === 'bench') { const alongZ = Math.abs(x) < Math.abs(z) ? false : true; put(world, box(alongZ ? .8 : 2.4, .45, alongZ ? 2.4 : .8, '#8a6a46'), x, 1.0, z); put(world, box(alongZ ? .2 : 2.4, .9, alongZ ? 2.4 : .2, '#8a6a46'), x + (alongZ ? .5 : 0), 1.5, z + (alongZ ? 0 : .5)); colliders.push({ x, z, r: 1.1 }); }
      else { put(world, box(3.6, .2, 1.8, '#4a5560'), x, 3.2, z); for (const sx of [-1.6, 1.6]) put(world, box(.15, 2.4, .15, '#4a5560'), x + sx, 2, z - .7); put(world, box(3.4, 1.6, .1, '#bfe4ff', { emissive: '#7fb8e8', emissiveIntensity: .15 }), x, 2.1, z - .8).castShadow = false; put(world, box(2.2, .4, .8, '#8a6a46'), x, 1.1, z); colliders.push({ x, z, r: 1.8 }); }
    }
    // crosswalk stripes either side of the main crossing and the ring crossings
    for (const [cx, cz, alongX] of [[0, 0, true], [0, 0, false], [-40, 0, false], [0, 40, true], [RING, 0, false], [-RING, 0, false], [0, RING, true], [0, -RING, true],
        [-40, 40, true], [-40, 40, false], [-40, RING, false], [-40, -RING, false], [RING, 40, true], [-RING, 40, true],
        [RING, RING, true], [RING, RING, false], [RING, -RING, true], [RING, -RING, false], [-RING, RING, true], [-RING, RING, false], [-RING, -RING, true], [-RING, -RING, false]]) {
      if (!inLand(cx, cz)) continue;
      for (const sg of [-1, 1]) { if ([-3, 0, 3].some(k => onDiag(alongX ? cx + sg * 8.2 : cx + k * 1.1, alongX ? cz + k * 1.1 : cz + sg * 8.2, 2.8)) || (CIRC && [-3, 0, 3].some(k => { const d = circD(alongX ? cx + sg * 8.2 : cx + k * 1.1, alongX ? cz + k * 1.1 : cz + sg * 8.2); return d > CIRC.r0 - 2.8 && d < CIRC.r1 + 2.8; })) || (ARC && [-3, 0, 3].some(k => inArc(alongX ? cx + sg * 8.2 : cx + k * 1.1, alongX ? cz + k * 1.1 : cz + sg * 8.2, ARC.hw + 2.8))) || (CRING && [-3, 0, 3].some(k => { const cd2 = circD(alongX ? cx + sg * 8.2 : cx + k * 1.1, alongX ? cz + k * 1.1 : cz + sg * 8.2); return cd2 > CRING.r0 - 2.8 && cd2 < CRING.r1 + 2.8; }))) continue; // a crosswalk whose bar would touch the diagonal, circle or canal ring is left out: no stop/crossing bars across the changed junction
      for (let k = -3; k <= 3; k++) { const wx = alongX ? cx + sg * 8.2 + 0 : cx + k * 1.1, wz = alongX ? cz + k * 1.1 : cz + sg * 8.2;
        let barBad = false; /* 118f/118g: test the FULL bar rectangle, center INCLUDED (Main 15:14 pixel review: the center-point guard left the lima deck run's end bars projecting over water; the first rectangle pass then missed bars whose CENTER alone was wet - berlin (69.8,36.7), london (-36.7,86.2), KL (-36.7,31.8)) */
        if (RIVERW || RCUTS.length) { const lx = alongX ? 0 : 1.6, lz = alongX ? 1.6 : 0; for (const t of [-1, -.75, -.5, -.25, 0, .25, .5, .75, 1]) { const sx = wx + t * lx, sz = wz + t * lz; if (inCut(sx, sz) || (RIVERW && inRiver(sx, sz, .5) && !roadAsphalt(sx, sz, 0))) { barBad = true; break; } } }
        if (!barBad && !roadAsphalt(wx, wz, 1.5)) barBad = true; /* Update 118h (Main 15:14: the outer-bar pattern is an unresolved design lead, not accepted-by-existence): every bar must sit on or near (pad 1.5 ~ bar-overhang tolerance) DRAWN asphalt - removes the ring-corner OUTER runs (14 bars per corner at |x| or |z| = RING+8.2, 4.2u past the ring slab onto bare ground) in all 37 cities + toronto's (-81..-74, 8.2) run over the lake (shore city: roadAsphalt stops at the waterline; the GSHHG line itself untouched). All-37-city probe: the ONLY bars beyond pad 1.5 were the corner runs and that toronto run; junction inner bars, street-edge overhang (<= .65u) and sidewalk-adjacent paint all stay. */
        if (barBad) continue; /* Update 118f (Main 14:32: render/predicate mismatch is implementation debt, not protected state): the 118a lima-only cut guard extends to every cut city (actual-build probe dev/harness/stripecut.mjs: nairobi had 7 bars floating at (-43..-36,-8.2), moscow 14 at (+-8.2,-3.3..3.3); madrid/mumbai/delhi had none, so they stay byte-identical) AND a shared river guard drops bars over the band off the drawn asphalt (roadAsphalt pad 0 = the drawn footprint, 118b-verified; decks ARE continuous asphalt, so on-deck paint stays): lima 2 deck-edge bars at (+-36.7/-43.3,-69.8), london 20 ring-corner bars over the Thames, moscow 15, kualalumpur 5, berlin 2, paris 2 - all still-verified floating on water BEFORE. Non-river non-cut cities: guard never fires, byte-identical. Update 118g: the same checks sample the bar's full 3.2-long rectangle (ends + quarters along its long axis), not just its center - a bar ANY part of which floats on the band off asphalt, or dips into a cut, is skipped (lima's (-40,-69.8) deck run shrinks to the bars fully on the 4.4-wide deck). */
        if ((CANAL && Math.abs(wz - 40) < 3.4 && Math.abs(wx + 40) > 3.6 && Math.abs(wx) > 4.7) || (CANALX && Math.abs(wx + 40) < 3.4 && Math.abs(wz) > 4.7 && Math.abs(wz - 40) > 3.6)) continue; // no crosswalk stripes on canal water
        put(world, box(alongX ? .7 : 3.2, .1, alongX ? 3.2 : .7, '#f0ede0'), wx, .71, wz).castShadow = false; } }
    } }
  // outer districts: park, market, sports ground, fountain square (one in each outer corner, skipped where water or the airport is in the way)
  { const slot = [[-95, -95, 'park'], [95, -95, 'market'], [95, 95, 'sports'], [-95, 95, 'square']];
    // whole-structure road clearance per district kind: [dx, dz, clearance] over the actual colliders each kind builds
    const ROAD_CHK = {
      park: [[-11, 0, 1.7], [11, 0, 1.7], [0, -11, 1.7], [0, 11, 1.7], [-7.8, -7.8, 1.7], [7.8, 7.8, 1.7], [-7.8, 7.8, 1.7], [7.8, -7.8, 1.7], [0, 2, 7.5]],
      market: [[-9, -8, 3.4], [-3, -8, 3.4], [3, -8, 3.4], [9, -8, 3.4], [-9, 0, 3.4], [9, 0, 3.4], [-9, 8, 3.4], [-3, 8, 3.4], [3, 8, 3.4], [9, 8, 3.4]],
      sports: [[12.6, 0, 7], [-12.6, 0, 7], [12.6, 7, 4], [-12.6, 7, 4], [12.6, -7, 4], [-12.6, -7, 4], [0, 0, 12]],
      square: [[0, 0, 6.6], [-11, 0, 1.8], [11, 0, 1.8], [0, -11, 1.8], [0, 11, 1.8], [-7.8, -7.8, 1.8], [7.8, 7.8, 1.8], [-7.8, 7.8, 1.8], [7.8, -7.8, 1.8], [-8.5, 0, 1], [8.5, 0, 1], [0, -8.5, 1], [0, 8.5, 1]],
    };
    for (const [cx0, cz0, kind] of slot) {
      // the sports ground's stands (cx +/- 12.6, r6) reach the ring asphalt from the outer corner: relocate it inboard, never drop it
      const sxx = Math.sign(cx0), szz = Math.sign(cz0);
      const cands = [[cx0, cz0], [cx0, szz * 40], [sxx * 40, cz0], [sxx * 95, 0], [0, szz * 95],
        ...(kind === 'sports' ? [[54, 54], [54, -54], [-54, 54], [-54, -54]] : [])]; // nudge along the outer band / near-edge before dropping a district
      for (const [cx, cz] of cands) {
      if (![[-12, -12], [12, -12], [-12, 12], [12, 12]].every(([dx, dz]) => inLand(cx + dx, cz + dz) && Math.abs(cx + dx) < S - 2 && Math.abs(cz + dz) < S - 2)) continue;
      if (apBlock(cx, cz, 18) || inRiver(cx, cz, 8) || colliders.some(k => Math.hypot(k.x - cx, k.z - cz) < k.r + 8) || places.some(p => p.name && Math.hypot(p.x - cx, p.z - cz) < p.r + 14)) continue;
      if (hasPool && Math.abs(cx - POOL.x) < POOL.hw + 20 && Math.abs(cz - POOL.z) < POOL.hd + 20) continue;
      if (ROAD_CHK[kind].some(([dx, dz, cl]) => roadAsphalt(cx + dx, cz + dz, cl))) continue; // every structure's whole footprint clear of the roads
      const grass = def.tree;
      if (kind === 'park') {
        put(world, box(25, .1, 25, '#5fae5a'), cx, .66, cz).castShadow = false;
        put(world, cyl(5.5, 5.5, .12, 20, '#3fa8d8', { roughness: .15 }), cx, .72, cz + 2).castShadow = false;
        for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, r = 9 + R() * 2; const t = leafyTree(1, grass); t.position.set(cx + Math.cos(a) * r, .6, cz + Math.sin(a) * r); t.scale.setScalar(.8 + R() * .5); world.add(t); occPush(t); colliders.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, r: .7 }); }
        for (const [bx, bz] of [[-8, 2], [8, 2], [0, -8]]) { put(world, box(2.6, .5, .8, '#8a6a46'), cx + bx, 1.1, cz + bz); put(world, box(2.6, 1, .2, '#8a6a46'), cx + bx, 1.6, cz + bz - .5); }
        colliders.push({ x: cx, z: cz + 2, r: 7 });
        places.push({ name: 'City park', x: cx, z: cz, r: 20 });
      } else if (kind === 'market') {
        put(world, box(25, .1, 25, '#c9bfa4'), cx, .66, cz).castShadow = false;
        for (let row = 0; row < 3; row++) for (let k = 0; k < 4; k++) { const x = cx - 9 + k * 6, z = cz - 8 + row * 8, c = def.bld[(row + k) % def.bld.length];
          put(world, box(3.8, 2, 2.4, '#8a6a46'), x, 1.7, z); put(world, box(4.4, .3, 3.2, c), x, 3.4, z).rotation.z = .08; for (const sx of [-2.2, 2.2]) put(world, cyl(.1, .1, 2.8, 5, '#5a4630'), x + sx, 2, z + 1.5);
          colliders.push({ x, z, r: 2.4 }); }
        places.push({ name: 'Market district', x: cx, z: cz, r: 20 });
      } else if (kind === 'sports') {
        put(world, box(25, .1, 25, '#9aa090'), cx, .66, cz).castShadow = false;
        put(world, cyl(11.5, 11.5, .14, 28, '#b5543c'), cx, .7, cz).castShadow = false; put(world, cyl(8.6, 8.6, .18, 28, '#4aa24e'), cx, .73, cz).castShadow = false;
        for (const sx of [-1, 1]) { put(world, box(2, 5, 18, '#8d97a0'), cx + sx * 12.6, 3, cz); put(world, box(.3, 4, 12, '#e8e4d8'), cx + sx * 8.8, 2.6, cz).castShadow = false; }
        colliders.push({ x: cx + 12.6, z: cz, r: 6 }, { x: cx - 12.6, z: cz, r: 6 }, { x: cx + 12.6, z: cz + 7, r: 3 }, { x: cx - 12.6, z: cz - 7, r: 3 });
        places.push({ name: 'Sports ground', x: cx, z: cz, r: 20 });
      } else {
        put(world, cyl(12.5, 12.5, .12, 24, '#d4cdb8'), cx, .7, cz).castShadow = false;
        put(world, cyl(5, 5.4, 1.4, 16, '#bfc6cc'), cx, 1.3, cz); put(world, cyl(3.4, 3.8, 1.1, 16, '#3fa8d8', { roughness: .15 }), cx, 2.2, cz); put(world, cyl(.5, .8, 5, 8, '#bfc6cc'), cx, 3.6, cz); put(world, sph(1.1, '#bfe4ff', { emissive: '#7fb8e8', emissiveIntensity: .4 }), cx, 6.4, cz);
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; put(world, box(2.4, .5, .8, '#8a6a46'), cx + Math.cos(a) * 8.5, 1.1, cz + Math.sin(a) * 8.5).rotation.y = -a + Math.PI / 2; const t = leafyTree(1, grass); t.position.set(cx + Math.cos(a + .39) * 11, .6, cz + Math.sin(a + .39) * 11); t.scale.setScalar(.7); world.add(t); occPush(t); colliders.push({ x: cx + Math.cos(a + .39) * 11, z: cz + Math.sin(a + .39) * 11, r: 1.25 }); }
        colliders.push({ x: cx, z: cz, r: 5.6 });
        places.push({ name: 'Fountain square', x: cx, z: cz, r: 18 });
      }
      break; } // first clear candidate wins
    } }
  // buildings
  // each city gets one themed quarter so no two districts feel like the same grid
  const THEME = ({ rome: 'old', athens: 'old', istanbul: 'old', cairo: 'old', delhi: 'old', beijing: 'old', moscow: 'old', paris: 'old', london: 'old',
    newyork: 'down', tokyo: 'down', dubai: 'down', hongkong: 'down', toronto: 'down', seoul: 'down', singapore: 'down', losangeles: 'down', berlin: 'down', mumbai: 'down', sydney: 'down', kualalumpur: 'down' })[id] || 'resort';
  const PARKSQ = new Set(['london', 'paris', 'delhi', 'berlin', 'tokyo', 'sydney', 'moscow', 'rome']);
  const SKYL = new Set(['dubai', 'newyork', 'tokyo', 'toronto', 'hongkong', 'seoul', 'singapore', 'losangeles', 'berlin', 'mumbai', 'sydney', 'kualalumpur']); /* skyline graduation pilot (row 15): downtown towers render taller near the quarter core and step down toward its edges - district silhouette composition, gameplay arrangement */
  const TERSET = new Set(['rome', 'paris', 'istanbul', 'athens', 'cairo', 'delhi', 'beijing', 'moscow', 'london']);
  /* resort quarter fabric (row 15, all resort cities): duplex rows and garden villas break the identical four-lot blocks in promenade quarters - gameplay arrangement after beach/promenade town fabric, not a mapped survey */ /* old-quarter fabric pilot (row 15): terrace pairs and courtyard houses break the identical four-lot blocks - gameplay arrangement after Mediterranean/ottoman old-town fabric, not a mapped survey */ /* park-quarter pilot (row 15): one of the two secondary quarters becomes a garden district - gameplay arrangement after the great city parks (Hyde Park, the Tuileries, Lodhi Gardens, Central Park), not a mapped place */
  let qsx = R() < .5 ? -1 : 1, qsz = R() < .5 ? -1 : 1; const qx0 = 28, qx1 = S - 14, qz0 = 28, qz1 = S - 14; if (id === 'moscow') { qsx = 1; qsz = -1; } if (id === 'bangkok') { qsx = -1; qsz = -1; } if (id === 'jakarta') { qsx = -1; qsz = -1; } if (id === 'nairobi') { qsx = 1; qsz = 1; } /* Update 118r: hold the accepted pre-river quarter arrangement (primary Promenade quarter (62,62), HEAD probe) across the river-def R-stream shift - 113a/tokyo salt class, same as 118k/118l */ /* Update 118l: hold the accepted pre-river quarter arrangement (primary (-62,-62), probe-verified) across the Ciliwung R-stream shift - 118k-fix pattern */ /* Update 118k: hold the accepted pre-river quarter arrangement (primary Promenade quarter (-62,-62), HEAD~1 probe) across the river-def R-stream shift - 113a/tokyo salt class; the new tall gold tower in the 118k afters is the seeded-cascade artifact this salt addresses, NOT an accepted landmark */ /* Update 113a: hold the accepted 113 quarter arrangement across the avenue-cut R-stream shift (both signs had flipped, permuting all four quarter labels); same class as the tokyo layout salt at :1372 - a per-city layout pin, draws still consumed so the stream stays aligned */ if (id === 'rome') { qsx = -1; qsz = 1; } /* Update 115: hold the accepted quarter arrangement across the Tiber-def R-stream shift (primary Old quarter (-62,62) in the pre-river HEAD dump; 113a/114 salt class) */ if (id === 'berlin') { qsx = -1; qsz = 1; } /* Update 114 (Main 12:38: prevent unrelated seeded cascades where feasible): hold the accepted quarter arrangement across the Spree-def R-stream shift; committed berlin = qsx -1 qsz 1 (read from the pre-river base dump: primary quarter Downtown at (-62,62)); same 113a/tokyo salt class */
  const inQuarter = (x, z) => Math.abs(z) > qz0 && Math.abs(z) < qz1 && Math.abs(x) > qx0 && Math.abs(x) < qx1;
  places.push({ name: THEME === 'old' ? 'Old quarter' : THEME === 'down' ? 'Downtown' : 'Promenade quarter', x: qsx * (qx0 + qx1) / 2, z: qsz * (qz0 + qz1) / 2, r: 24 });
  // per-city quarter fabric: culturally grounded block pitch (P), lane width (LW) and plaza kind for the
  // primary-theme quarters. Tied to each city's real urban character, not hash jitter: Haussmann boulevards in
  // Paris, medieval bazaar lanes in Istanbul/Cairo/Delhi, Plaka alleys in Athens, Tokyo's tight blocks, the
  // monumental avenues of Beijing/Moscow, LA's car arterials, Buenos Aires' famously wide 9 de Julio + Obelisco
  // square, hawker-centre plazas in Singapore, street-market squares across South/Southeast Asia and Mexico City.
  // Narrow-lane old towns stay pedestrian-scaled on purpose (walkable, cars squeeze out to the main roads) -
  // no travel/stage/event destination sits inside a quarter, so nothing critical is blocked.
  const QLAYOUT = {
    paris: { P: 24, LW: 10, plaza: 'fountain' }, // Haussmann boulevards, fountain squares
    london: { P: 20, LW: 7, plaza: 'fountain' }, // Trafalgar-style square
    rome: { P: 17, LW: 4.5, plaza: 'fountain' }, // centro storico lanes, Trevi
    athens: { P: 16, LW: 4, plaza: 'fountain' }, // Plaka alleys
    amsterdam: { P: 14, LW: 4, plaza: 'fountain' },
    lisbon: { P: 16, LW: 4, plaza: 'fountain' },
    lima: { P: 18, LW: 5, plaza: 'fountain' },
    marrakesh: { P: 14, LW: 4, plaza: 'stalls' },
    madrid: { P: 18, LW: 5, plaza: 'fountain' },
    nairobi: { P: 20, LW: 6, plaza: 'fountain' }, jakarta: { P: 18, LW: 5, plaza: 'stalls' },
    bogota: { P: 18, LW: 5, plaza: 'stalls' }, /* La Candelaria colonial grid, market squares */
    bogotadowntown: { P: 14, LW: 4, plaza: 'fountain' }, /* Plaza de Bolivar open square, narrow colonial lanes */
    lagosisland: { P: 16, LW: 4.5, plaza: 'fountain' }, /* Lagos Island commercial grid, Tinubu-Square fountain character */
    auckland: { P: 18, LW: 5, plaza: 'fountain' },
    lagos: { P: 17, LW: 4.5, plaza: 'stalls' }, /* Balogun-market fabric */
    stockholm: { P: 18, LW: 5, plaza: 'fountain' },
    istanbul: { P: 17, LW: 4.5, plaza: 'stalls' }, // bazaar fabric
    cairo: { P: 17, LW: 4.5, plaza: 'stalls' }, // Khan el-Khalili
    delhi: { P: 18, LW: 5, plaza: 'stalls' }, // Chandni Chowk
    moscow: { P: 24, LW: 10, plaza: 'pavilion' }, // monumental avenues
    beijing: { P: 24, LW: 10, plaza: 'pavilion' }, // wide modern avenues
    newyork: { P: 24, LW: 10, plaza: 'pavilion' }, // Manhattan grid avenues
    tokyo: { P: 17, LW: 5, plaza: 'fountain' }, // tight backstreet blocks
    seoul: { P: 19, LW: 6, plaza: 'fountain' },
    bangkok: { P: 17, LW: 5, plaza: 'stalls' }, // street markets
    mumbai: { P: 18, LW: 5.5, plaza: 'stalls' }, // Crawford Market fabric
    hongkong: { P: 18, LW: 5, plaza: 'stalls' }, // dense market streets
    singapore: { P: 22, LW: 9, plaza: 'pavilion' }, // hawker-centre squares
    dubai: { P: 25, LW: 11, plaza: 'pavilion' }, // modern arterials
    losangeles: { P: 26, LW: 12, plaza: 'pavilion' }, // car-city arterials
    buenosaires: { P: 24, LW: 11, plaza: 'obelisk' }, // 9 de Julio width + Obelisco
    mexicocity: { P: 19, LW: 6, plaza: 'stalls' }, // tianguis squares
    berlin: { P: 22, LW: 9, plaza: 'fountain' },
    toronto: { P: 22, LW: 9, plaza: 'pavilion' },
    sydney: { P: 21, LW: 8, plaza: 'pavilion' },
    kualalumpur: { P: 20, LW: 7, plaza: 'fountain' },
  };
  // street lattice inside the quarter: real lanes between blocks, per-theme block pitch and building mix
  const qCands = [];
  const genQ = (T, sx, sz) => {
  { const hsh = [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7), lay = T === THEME ? QLAYOUT[id] || {} : {};
    const P = lay.P || (T === 'old' ? 20 : 22) + (hsh % 3) - 1, LW = lay.LW || (T === 'down' ? 9 : T === 'old' ? 6 : 8) + (hsh >> 3) % 2, mid = (qx0 + qx1) / 2;
    const lane = T === 'old' ? '#8f8777' : T === 'down' ? '#3d4046' : '#b59a72';
    const n = Math.floor((qx1 - qx0) / P);
    const wl = qx0 + P + 1; /* garden-quarter walks run on the first block line, splitting the lawn without crossing the blocks */
    const cutRoad = (runs, fx, vert, w2) => { const out = []; for (const [lo, hi] of runs) { let s = null; for (let u = lo; u <= hi + .999; u += 1) { const uu = Math.min(u, hi); const px = vert ? fx : uu, pz = vert ? uu : fx; if (uu <= hi && (roadAsphalt(px, pz, w2 + .3) || (SLABCUT && inRiver(px, pz, w2 + .3)))) { if (s !== null) /* Update 113a (Main 11:34: quarter slabs visibly occluding the band): SLABCUT cities also break lane/walk slabs at the RIVER band, sampled at the slab half-width like the road cut; 113a moscow, 113c paris */ { if (uu - s > 2) out.push([s, uu]); s = null; } } else if (s === null && uu < hi) s = uu; } if (s !== null && hi - s > 2) out.push([s, hi]); } return out; }; /* Update 112: quarter lane/walk slabs (top .70) now break where they cross MAIN-ROAD asphalt (top .68) - same clearance pattern as the canal-ring rc cut, sampled at 1u with the slab half-width so the slab edges clear the asphalt, not just the centre line. Root cause of main 10:28 (lon111c-3: broad tan slab, dashes floating across it, at the london north-ring crossing z=-78 x25-33): old-quarter lane k=0 (centre x29, LW 7) lay OVER the ring; rendering only, no R()/collider impact */
    if (T === 'park') { const plen = qx1 - qx0 + P; for (const [u0, u1] of cutRoad([[sz * mid - plen / 2, sz * mid + plen / 2]], sx * wl, true, 2.5)) put(world, box(5, .08, u1 - u0, '#cfc4a4'), sx * wl, .66, (u0 + u1) / 2).castShadow = false; for (const [u0, u1] of cutRoad([[sx * mid - plen / 2, sx * mid + plen / 2]], sz * wl, false, 2.5)) put(world, box(u1 - u0, .08, 5, '#cfc4a4'), (u0 + u1) / 2, .66, sz * wl).castShadow = false; }
    else for (let k = 0; k <= n; k++) { const o = qx0 + k * P - LW / 2 + 1, LL = qx1 - qx0 + P;
      const rc = (c, lo, hi) => { if (!CRING) return [[lo, hi]]; const a0 = Math.max(0, Math.abs(c) - LW / 2 - .3), a1 = Math.abs(c) + LW / 2 + .3; /* the band must clear the slab's near and far edges, not just its centre line */
        if (a0 >= CRING.r1 + 1) return [[lo, hi]]; const w1 = Math.sqrt(Math.max(0, CRING.r1 * CRING.r1 - a0 * a0)) + 1, w0 = a1 < CRING.r0 - 1 ? Math.sqrt(Math.max(0, CRING.r0 * CRING.r0 - a1 * a1)) - 1 : 0;
        const out = []; for (const [u, v] of [[lo, -w1], [-w0, w0], [w1, hi]]) { const q0 = Math.max(u, lo), q1 = Math.min(v, hi); if (q1 - q0 > 2) out.push([q0, q1]); } return out; }; /* quarter lanes end 1 unit short of the quays: no asphalt over canal water, continuous readable channel */
      for (const [u0, u1] of cutRoad(rc(sx * (o + LW / 2), sz * mid - LL / 2, sz * mid + LL / 2), sx * (o + LW / 2), true, LW / 2)) put(world, box(LW, .08, u1 - u0, lane), sx * (o + LW / 2), .66, (u0 + u1) / 2).castShadow = false; // .66: the z=40/x=-40 arms also sit at .65 - exact-coplanar overlap z-fought at crossings; .01 up matches the .64 centre/ring clearance
      for (const [u0, u1] of cutRoad(rc(sz * (o + LW / 2), sx * mid - LL / 2, sx * mid + LL / 2), sz * (o + LW / 2), false, LW / 2)) put(world, box(u1 - u0, .08, LW, lane), (u0 + u1) / 2, .66, sz * (o + LW / 2)).castShadow = false; }
    for (let a = 0; a < n; a++) for (let c = 0; c < n; c++) {
      const bx = qx0 + a * P + P / 2 + 1, bz = qz0 + c * P + P / 2 + 1, room = P - LW;

      if (ESH && sx * bx + room / 2 > shoreXMin(sz * bz, room / 2)) continue; // east-sea city: block not wholly on land
      if (SHORE_ON && sz * bz + room / 2 > shoreMin(sx * bx, room / 2)) continue; // block not wholly on land (inset shore): no plaza or towers in the water
      if (a === (n > 2 ? 1 : 1) && c === (n > 2 ? 1 : 0) && !roadAsphalt(sx * bx, sz * bz, room / 2 + .3) && !apBlock(sx * bx, sz * bz, room / 2 + 2)) { // plaza block (one per quarter), wholly off the main roads and out of the airport apron: paved square with fountain, benches and a tree ring
        const px = sx * bx, pz = sz * bz, pv = T === 'old' ? '#b9ad94' : T === 'park' ? '#9cb57e' : T === 'down' ? '#8d9299' : '#d6c08f';
        if (id === 'istanbul' && Math.abs(px + 62) < 5 && Math.abs(pz + 62) < 5) { R(); R(); R(); R(); continue; } /* Update 143: suppress the generated pavilion plaza block at the Grand Bazaar window (-62,-62) - parcel-local, ONLY this rect (Main 1:24:52: no historical-rectangle activation; generated fabric has preservation value - exactly this one block). The plaza branch's only R consumption is the shared tree-ring scale loop (4 draws): consuming exactly 4 here keeps the placement stream byte-identical (no quarter/tree/slot cascade) */
        put(world, box(room, .1, room, pv), px, .68, pz).castShadow = false;
        if (T === 'park' && (hsh >> 2) % 2 === 0) { const rr2 = room / 2; put(world, cyl(rr2 - 1, rr2 - 1, .4, 28, '#b9ad94'), px, .85, pz).castShadow = false; put(world, cyl(rr2 - 2.2, rr2 - 2.2, .24, 28, '#3fa8d8', { roughness: .15 }), px, 1, pz).castShadow = false; /* water sits proud of the solid rim: rim top 1.05, water top 1.12 */ colliders.push({ x: px, z: pz, r: rr2 - .6 }); for (let k = 0; k < 4; k++) { const an = k * Math.PI / 2; put(world, box(2.2, .5, .7, '#8a6a46'), px + Math.cos(an) * (rr2 + 2.2), .95, pz + Math.sin(an) * (rr2 + 2.2)).rotation.y = -an; } for (const sgn of [-1, 1]) { const t2 = leafyTree(1, def.tree); t2.position.set(px + sgn * (rr2 + 4.5), .6, pz + sgn * 2); t2.scale.setScalar(.9); world.add(t2); occPush(t2); colliders.push({ x: px + sgn * (rr2 + 4.5), z: pz + sgn * 2, r: 1.25 }); } if (!genQ.done) genQ.done = {}; const dk = sx + ',' + sz; if (!genQ.done[dk]) { genQ.done[dk] = 1; places.push({ name: 'Park pond', x: px, z: pz, r: 8 }); } continue; } /* park quarter square = pond with a stone rim, benches outside the rim and two flanking trees */
        const kindP = lay.plaza || (T === 'park' ? 'fountain' : ['fountain', 'obelisk', 'stalls', 'pavilion'][(hsh + a + c + (sx > 0 ? 1 : 0)) % 4]);
        if (kindP === 'fountain') { put(world, cyl(2.2, 2.4, .9, 14, '#bfc6cc'), px, 1.1, pz); put(world, cyl(1.6, 1.8, .7, 14, '#3fa8d8', { roughness: .15 }), px, 1.5, pz); put(world, cyl(.3, .4, 2.6, 8, '#bfc6cc'), px, 2.4, pz); put(world, sph(.55, '#bfe4ff', { emissive: '#7fb8e8', emissiveIntensity: .4 }), px, 4, pz); colliders.push({ x: px, z: pz, r: 2.6 }); }
        else if (kindP === 'obelisk') { put(world, box(3, .6, 3, '#aaa497'), px, 1, pz); put(world, box(1.4, 8, 1.4, '#d8d2c0'), px, 5, pz); put(world, cone(1, 1.6, 4, '#c9a84a'), px, 9.8, pz).rotation.y = .78; colliders.push({ x: px, z: pz, r: 1.9 }); }
        else if (kindP === 'stalls') { const cc = ['#e8553a', '#3a8ae8', '#e8c43a', '#4ab870']; for (let k = 0; k < 4; k++) { const sxk = px + (k % 2 ? 3.4 : -3.4), szk = pz + (k < 2 ? -3.2 : 3.2); put(world, box(3, .9, 1.6, '#8a6a46'), sxk, 1.15, szk); put(world, box(3.4, .25, 2.2, cc[k]), sxk, 3.1, szk); for (const dx of [-1.5, 1.5]) put(world, box(.15, 2.4, .15, '#5a4a3a'), sxk + dx, 1.9, szk); colliders.push({ x: sxk, z: szk, r: 1.5 }); } }
        else { put(world, box(7, .4, 7, '#b8b0a0'), px, .9, pz); for (const dx of [-3, 3]) for (const dz of [-3, 3]) put(world, cyl(.3, .3, 3.6, 8, '#e4dccb'), px + dx, 2.7, pz + dz); put(world, cone(5.4, 2.2, 4, '#9a5a44'), px, 5.6, pz).rotation.y = .78; for (const dx of [-3, 3]) for (const dz of [-3, 3]) colliders.push({ x: px + dx, z: pz + dz, r: .5 }); }
        colliders.push({ x: px, z: pz, r: 2.6 });
        for (let k = 0; k < 4; k++) { const an = k * Math.PI / 2 + .78, bxx = px + Math.cos(an) * (room / 2 - 1.6), bzz = pz + Math.sin(an) * (room / 2 - 1.6); const t = leafyTree(1, def.tree); t.position.set(bxx, .6, bzz); t.scale.setScalar(.7 + R() * .3); world.add(t); occPush(t); colliders.push({ x: bxx, z: bzz, r: 1.25 }); }
        for (let k = 0; k < 4; k++) { const an = k * Math.PI / 2; put(world, box(2.2, .5, .7, '#8a6a46'), px + Math.cos(an) * 4.2, .95, pz + Math.sin(an) * 4.2).rotation.y = -an; }
        if (!genQ.done) genQ.done = {}; const dk = sx + ',' + sz; if (!genQ.done[dk]) { genQ.done[dk] = 1; places.push({ name: T === 'old' ? 'Old town square' : T === 'down' ? 'Plaza' : T === 'park' ? 'Garden square' : 'Promenade square', x: px, z: pz, r: 8 }); }
        continue;
      }
      if (T === 'park') { const rr = seeded((hsh ^ (a * 7349 + c * 9151 + (sx > 0 ? 131 : 0) + (sz > 0 ? 17 : 0))) >>> 0); /* own RNG: the placement stream, other quarters and the seeded draws stay untouched */
        for (let k = 0, nt = ((hsh >> 2) % 2 === 1 ? 3 : 2) + Math.floor(rr() * 3); k < nt; k++) { let planted = false;
          for (let at = 0; at < 2 && !planted; at++) { const tx = sx * (bx + (rr() * 2 - 1) * (room / 2 - 1.6)), tz = sz * (bz + (rr() * 2 - 1) * (room / 2 - 1.6));
            if (Math.abs(tx - sx * wl) < 3.7 || Math.abs(tz - sz * wl) < 3.7) continue; /* the gravel walks stay open */
            if (roadKeep(tx, tz, 1.6) || !inLand(tx, tz) || apBlock(tx, tz, 2)) continue;
            if (stage && Math.abs(tx - stage.x) < 12 && tz - stage.z > -7 && tz - stage.z < 21) continue;
            if (hasPool && Math.abs(tx - POOL.x) < POOL.hw + 3 && Math.abs(tz - POOL.z) < POOL.hd + 3) continue;
            if (colliders.some(c2 => Math.hypot(c2.x - tx, c2.z - tz) < (c2.r || Math.max(c2.hw || 0, c2.hd || 0)) + 1.6)) continue;
            const t = leafyTree(1, def.tree); t.position.set(tx, .6, tz); t.scale.setScalar(.75 + rr() * .5); world.add(t); occPush(t); colliders.push({ x: tx, z: tz, r: 1.25 }); planted = true; } }
        continue; }
      if (T === 'down') { const ww = room - 5 + R() * 2, dd2 = room - 5 + R() * 2, hh = 26 + R() * 30, dQ = Math.hypot(bx - mid, bz - mid); qCands.push({ T, x: sx * bx, z: sz * bz, w: ww, d: dd2, h: hh, hr: SKYL.has(id) ? hh * (dQ < 14 ? 1 : Math.max(.48, 1 - (dQ - 14) * .016)) : hh }); } /* R() order unchanged (w, d, h); hr is the rendered profile height, h stays the stream value */
      else if (T === 'old' && TERSET.has(id)) { const rr = seeded((hsh ^ (a * 4523 + c * 8861 + (sx > 0 ? 97 : 0) + (sz > 0 ? 31 : 0))) >>> 0); /* own RNG for the variant pick */
        const dr = [R(), R(), R(), R(), R(), R(), R(), R()]; /* the quad pattern's exact 8 draws (bs,h x4): the placement stream stays identical for every city */
        const v = rr();
        if (v < .55) { const g = 4.6; for (let k = 0; k < 4; k++) { const [ox, oz] = [[-1, -1], [1, -1], [-1, 1], [1, 1]][k]; const bs = 4.2 + dr[k * 2] * .9; qCands.push({ T, x: sx * (bx + ox * g), z: sz * (bz + oz * g), w: bs, d: bs, h: 4 + dr[k * 2 + 1] * 4 }); } }
        else if (v < .85) { const w1 = 3.8 + dr[0] * 1.2, w2 = 3.8 + dr[2] * 1.2, dd = room - 1.6, alongX = rr() < .5; /* terrace pair: two row-house slabs with a narrow passage between, shorter than the quad footprint so lanes stay wider */
          if (alongX) { qCands.push({ T, x: sx * (bx - .9 - w2 / 2), z: sz * bz, w: w1, d: dd, h: 4 + dr[1] * 4 }); qCands.push({ T, x: sx * (bx + .9 + w1 / 2), z: sz * bz, w: w2, d: dd, h: 4 + dr[3] * 4 }); }
          else { qCands.push({ T, x: sx * bx, z: sz * (bz - .9 - w2 / 2), w: dd, d: w1, h: 4 + dr[1] * 4 }); qCands.push({ T, x: sx * bx, z: sz * (bz + .9 + w1 / 2), w: dd, d: w2, h: 4 + dr[3] * 4 }); } } /* group centred on the block, 1.8 passage between the slabs */
        else { const wh = Math.min(room - 2.4, 6.8 + dr[0] * 2.4); qCands.push({ T, x: sx * bx, z: sz * bz, w: wh, d: wh, h: 3.2 + dr[1] * 2.5 }); } /* courtyard house: one broader low house fills the block */
      }
      else if (T === 'resort' && THEME === 'resort') { const rr = seeded((hsh ^ (a * 6151 + c * 7877 + (sx > 0 ? 53 : 0) + (sz > 0 ? 29 : 0))) >>> 0); /* own RNG for the variant pick */
        const lots = []; /* the quad pattern's exact draws (skip, then bs, h per kept lot): the placement stream stays identical for every city */
        for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { if (R() < .2) continue; lots.push({ ox, oz, bs: 4.4 + R() * .9, h: 3 + R() * 3.5 }); }
        const v = rr(), g = 4.6;
        if (v < .5 || lots.length < 2) { for (const L of lots) qCands.push({ T, x: sx * (bx + L.ox * g), z: sz * (bz + L.oz * g), w: L.bs, d: L.bs, h: L.h }); }
        else if (v < .85) { for (const rz of [-1, 1]) { const row = lots.filter(L => L.oz === rz); /* duplex rows: each kept lot row merges into one elongated house, footprint stays inside the quad's worst-case extent */
            if (row.length === 1) { const L = row[0]; qCands.push({ T, x: sx * (bx + L.ox * g), z: sz * (bz + L.oz * g), w: L.bs, d: L.bs, h: L.h }); }
            else if (row.length > 1) qCands.push({ T, x: sx * bx, z: sz * (bz + rz * g), w: Math.min(row[0].bs + row[1].bs + 1.7, 11.4), d: Math.min(row[0].bs, row[1].bs), h: Math.max(row[0].h, row[1].h) }); } }
        else { const L = lots[0], wh = Math.min(room - 2.4, L.bs + 2.2); qCands.push({ T, x: sx * bx, z: sz * bz, w: wh, d: wh, h: 2.8 + (L.h - 3) * .6 }); } /* garden villa: one broader low house fills the block centre */
      }
            else { const g = 4.6; for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { if (T !== 'old' && R() < .2) continue; const bs = T === 'old' ? 4.2 + R() * .9 : 4.4 + R() * .9; qCands.push({ T, x: sx * (bx + ox * g), z: sz * (bz + oz * g), w: bs, d: bs, h: T === 'old' ? 4 + R() * 4 : 3 + R() * 3.5 }); } }
    } }
  };
  genQ(THEME, qsx, qsz);
  const THEME2 = THEME === 'old' ? 'resort' : THEME === 'down' ? 'old' : 'down';
  const PQ2 = PARKSQ.has(id) && qsx > 0 && qsz > 0; /* the airport apron sits at (50,-50): a garden quarter in that quadrant would end up on the tarmac, so it takes the other secondary quarter instead */
  const TQ3 = PQ2 ? 'park' : THEME2, TQ4 = PARKSQ.has(id) && !PQ2 ? 'park' : THEME2;
  genQ(TQ3, -qsx, qsz);
  genQ(TQ4, qsx, -qsz);
  genQ(THEME, -qsx, -qsz);
  for (const [T3, sx3, sz3] of [[TQ4, qsx, -qsz], [THEME, -qsx, -qsz]]) places.push({ name: T3 === 'old' ? 'Old quarter' : T3 === 'down' ? 'Downtown' : T3 === 'park' ? 'Garden quarter' : 'Promenade quarter', x: sx3 * (qx0 + qx1) / 2, z: sz3 * (qz0 + qz1) / 2, r: 24 });
  places.push({ name: TQ3 === 'old' ? 'Old quarter' : TQ3 === 'down' ? 'Downtown' : TQ3 === 'park' ? 'Garden quarter' : 'Promenade quarter', x: -qsx * (qx0 + qx1) / 2, z: qsz * (qz0 + qz1) / 2, r: 24 });

  for (let i = 0; i < 320 + qCands.length; i++) {
    const qc = i >= 320 ? qCands[i - 320] : null; const inQ = false;
    let x = qc ? qc.x : inQ ? qsx * (qx0 + R() * (qx1 - qx0)) : (R() * 2 - 1) * (S - 5), z = qc ? qc.z : (R() * 2 - 1) * (S - 5);
    let nudgedB = false;
    if (!qc && inQuarter(x, z)) continue;
    if (apBlock(x, z, 12) || !inLand(x, z) || inRiver(x, z, 7) || onRoad(x, z) || Math.hypot(x, z + 26) < 24 || places.some(p => p.name && p.r < 22 && Math.hypot(x - p.x, z - p.z) < p.r + 7) || (Math.abs(x) < 16 && z > -60 && z < 24)) continue;
    const st = STYLE[id] || { roof: 'flat', hmax: 18 };
    const inQt = inQuarter(x, z);
    let w = 5 + R() * 6, d = 5 + R() * 6; const near = Math.hypot(x, z) < 35;
    let h = (st.hmin || 5) + R() * Math.max(2, (near ? st.hmax : st.hmax * .6) - (st.hmin || 5));
    if (qc) { w = qc.w; d = qc.d; h = qc.h; }
    else if (inQt && THEME === 'old') { w = 3.4 + R() * 3; d = 3.4 + R() * 3; h = 3.5 + R() * 4; }
    else if (inQt && THEME === 'down') { w = 7 + R() * 5; d = 7 + R() * 5; h = Math.max(h, 14) * (1.5 + R() * .6); }
    else if (inQt) { w = 4 + R() * 3; d = 4 + R() * 3; h = 3 + R() * 3; }
    if (ESH && x + Math.max(w, d) / 2 + 3 > shoreXMin(z, Math.max(w, d) / 2)) continue;
    if (SHORE_ON && z + Math.max(w, d) / 2 + .5 > shoreMin(x, Math.max(w, d) / 2)) continue; // inset shore: whole footprint on land (Toronto only; shifts that city's later seeded draws)
    const hFull = h; // unclamped height drives every downstream conditional R() draw (stream-preserving);
    if (qc && qc.hr !== undefined) h = qc.hr; // skyline graduation: rendered height follows the district profile; hFull keeps placement/colliders/spots byte-identical
    if (id === 'singapore') { // garden-clearing falloff: near the supertree grove (0,-26) buildings RENDER lower
      const dl = Math.hypot(x, z + 26); // toward open garden ground so the 12.2-tall grove crowns its surroundings;
      if (dl < 64) h = Math.min(h, 6.5 + Math.max(0, dl - 24) * .16); // hFull keeps placement/colliders/spots byte-identical
    }
    if (id === 'hongkong') { // harbour-promenade falloff: near the landmark basin (0,-26) towers RENDER lower
      const dl2 = Math.hypot(x, z + 26); // so the miniature skyline composition reads; far towers untouched.
      if (dl2 < 64) h = Math.min(h, 8 + Math.max(0, dl2 - 24) * .22); // hFull keeps placement/colliders/spots byte-identical
    }
    let onNudged = false; // a later building may not land on an earlier NUDGED one either - no new overlaps involving moved lots
    for (const c of colliders) { if (c.nb && c.hw && Math.abs(x - c.x) < w / 2 + c.hw + .5 && Math.abs(z - c.z) < d / 2 + c.hd + .5) { onNudged = true; break; } }
    if (onNudged || roadKeep(x, z, Math.max(w, d) / 2 + .5)) { // whole building footprint (worst-case form) stays off the roads
      if (window.__lkSkips) { window.__lkSkips.road = (window.__lkSkips.road || 0) + 1; if (onNudged) window.__lkSkips.onNudged = (window.__lkSkips.onNudged || 0) + 1; }
      let nudged = false; // bounded in-lot nudge: keep the building if a small shift satisfies every constraint with the same footprint margin
      for (const rr of [1.5, 3]) { for (let q = 0; q < 8 && !nudged; q++) {
        const tx = x + Math.sin(q / 8 * 2 * Math.PI) * rr, tz = z + Math.cos(q / 8 * 2 * Math.PI) * rr;
        if (roadKeep(tx, tz, Math.max(w, d) / 2 + .5) || onRoad(tx, tz) || !inLand(tx, tz)) continue;
        let hitB = false; // don't converge onto another building: the nudged box must clear every placed building box (+0.5 gap)
        for (const c of colliders) { if (c.hw && Math.abs(tx - c.x) < w / 2 + c.hw + .5 && Math.abs(tz - c.z) < d / 2 + c.hd + .5) { hitB = true; break; } }
        if (hitB) continue;
        if (apBlock(tx, tz, 12) || inRiver(tx, tz, 7) || Math.hypot(tx, tz + 26) < 24 || places.some(p => p.name && p.r < 22 && Math.hypot(tx - p.x, tz - p.z) < p.r + 7) || (Math.abs(tx) < 16 && tz > -60 && tz < 24)) continue;
        x = tx; z = tz; nudged = true; nudgedB = true; if (window.__lkSkips) window.__lkSkips.nudged = (window.__lkSkips.nudged || 0) + 1; } }
      if (!nudged) continue; }
    if (id === 'sydney' && ((x > -42 && x < -6 && z > -70 && z < -42) || (x > -66 && x < -22 && z > 54 && z < 88))) continue; // Sydney clearings: Harbour Bridge, and QVB + Sydney Tower, stand at their real bearings from the Opera House
    if (NEWCLEAR[id] && NEWCLEAR[id].some(([cx, cz, cr]) => Math.abs(x - cx) < cr && Math.abs(z - cz) < cr)) continue; // clearings so named places of the newer cities stand at their real bearings, not in leftover gaps
    if (id === 'cairo' && x > -52 && x < -4 && z > -26 && z < 36) continue; // Giza clearing: Khafre and Menkaure stand at their real bearings from the Great Pyramid in open ground
    if (id === 'hongkong' && x > -32 && x < 42 && z > 70 && z < 110) continue; // Tsim Sha Tsui waterfront clearing: the named places (extrasHK) stand in open ground, not between towers
    const col = def.bld[Math.floor(R() * def.bld.length)];
    let bw = w, bd = d, bx = x, bz = z, b;
    if ((!qc || qc.T === 'down') && hFull > 8 && w >= 6) {
      const fr = R(), col2 = def.bld[(def.bld.indexOf(col) + 1) % def.bld.length];
      const f = qc ? (fr < .5 ? 'podium' : fr < .8 ? 'twin' : 'slab') : (fr < .3 ? 'podium' : fr < .55 ? 'lwing' : fr < .8 ? 'twin' : 'slab');
      if (f === 'podium') { // podium: wide base with a centred tower, total height unchanged
        const h1 = Math.min(h * .35, 8);
        occluders.push(put(world, box(w, h1, d, col2), x, .6 + h1 / 2, z));
        b = put(world, box(w * .72, h - h1, d * .72, col), x, .6 + h1 + (h - h1) / 2, z);
        bw = w * .72; bd = d * .72;
      } else if (f === 'lwing') { // L-wing: tall main with a lower side wing
        b = put(world, box(w * .68, h, d, col), x - w * .16, .6 + h / 2, z); bx = x - w * .16; bw = w * .68;
        occluders.push(put(world, box(w * .32, h * .55, d * .62, col2), x + w * .34, .6 + h * .275, z + d * .19));
      } else if (f === 'twin') { // twin slabs at staggered heights
        b = put(world, box(w * .46, h, d * .9, col), x - w * .26, .6 + h / 2, z); bx = x - w * .26; bw = w * .46; bd = d * .9;
        occluders.push(put(world, box(w * .46, h * .78, d * .9, col2), x + w * .26, .6 + h * .39, z));
      } else b = put(world, box(w, h, d, col), x, .6 + h / 2, z);
    } else b = put(world, box(w, h, d, col), x, .6 + h / 2, z);
    occluders.push(b);
    const rx = bx, rz = bz, rw = bw, rd = bd;
    const top = .6 + h;
    if (st.roof === 'mansard') { put(world, box(rw - .6, 2.4, rd - .6, '#4a5560'), rx, top + 1.2, rz); for (let k = -1; k <= 1; k += 2) put(world, box(.7, 1.4, .7, '#6a5a50'), rx + k * rw * .25, top + 3, rz); }
    else if (st.roof === 'dome') { put(world, sph(Math.min(rw, rd) * .38, '#6a8fa8'), rx, top + 1, rz); }
    else if (st.roof === 'chimney') { put(world, box(rw + .4, .7, rd + .4, '#555a63'), rx, top + .35, rz); for (const k of [-1, 1]) put(world, box(.9, 2.2, .9, '#8d4a3a'), rx + k * rw * .28, top + 1.8, rz); }
    else if (st.roof === 'water') { put(world, box(rw + .4, .6, rd + .4, '#555a63'), rx, top + .3, rz); put(world, cyl(1.1, 1.1, 2.2, 8, '#8a5a3a'), rx, top + 1.7, rz); put(world, cone(1.3, .9, 8, '#5a3a28'), rx, top + 3.2, rz); }
    else if (st.roof === 'neon') { const nc = ['#ff3d7f', '#35d0ff', '#ffe03a', '#9d6bff'][Math.floor(R() * 4)]; put(world, box(rw + .4, .6, rd + .4, '#555a63'), rx, top + .3, rz); put(world, box(rw * .8, 2.2, .3, nc, { emissive: nc, emissiveIntensity: .9 }), rx, top - 2, rz + rd / 2 + .2).castShadow = false; }
    else if (st.roof === 'glass') { put(world, cyl(.15, .3, 5, 5, '#c0c8d0'), rx, top + 2.5, rz); }
    else if (st.roof === 'green') { put(world, box(rw - .5, .9, rd - .5, '#2f9a50'), rx, top + .45, rz); }
    else if (st.roof === 'slant') { put(world, cone(Math.max(rw, rd) * .62, 2.6, 4, st.colorful ? '#d8553a' : '#9a5a44'), rx, top + 1.3, rz).rotation.y = .78; }
    else put(world, box(rw + .4, .7, rd + .4, '#555a63'), rx, top + .35, rz);
    if (['flat', 'glass', 'chimney', 'water', 'green'].includes(st.roof) && rw >= 5 && rd >= 5) { // rooftop kit: visual only, own RNG (placement stream, colliders and slots untouched), kept inside the footprint
      const rr = seeded(([...id].reduce((a2, c2) => a2 * 31 + c2.charCodeAt(0), 11) ^ (i * 40503)) >>> 0), ox = rw * .26, oz = rd * .26, ry = top + (st.roof === 'green' ? .9 : st.roof === 'glass' ? 0 : .7);
      const kit = HOT_ROOFS.has(id) ? ['tank', 'solar', 'tank', 'ac'] : ['ac', 'antenna', 'stair', 'ac'];
      const n = rr() < .35 ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const it = kit[Math.floor(rr() * kit.length)], px = rx + (k ? -ox : ox) * (rr() < .5 ? 1 : -1) * .9, pz = rz + (k ? oz : -oz) * (rr() < .5 ? 1 : -1) * .9;
        if (it === 'tank') { put(world, cyl(.7, .7, 1.3, 8, '#5f7f9a'), px, ry + .65, pz); for (const [lx, lz] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) put(world, box(.1, .5, .1, '#4a4a4a'), px + lx, ry + .1, pz + lz); }
        else if (it === 'solar') { const sp = put(world, box(1.9, .1, 1.1, '#26466e'), px, ry + .5, pz); sp.rotation.x = -.45; }
        else if (it === 'stair') put(world, box(Math.min(2.4, rw * .3), 1.7, Math.min(2.4, rd * .3), '#9a9690'), px, ry + .85, pz);
        else if (it === 'antenna') { put(world, cyl(.05, .07, 3.6, 5, '#b8bcc0'), px, ry + 1.8, pz); put(world, box(1.2, .06, .06, '#b8bcc0'), px, ry + 3, pz); }
        else put(world, box(1.1, .75, .8, '#b8bcc0'), px, ry + .38, pz);
      }
    }
    if (st.colorful && R() < .5) b.material.color.set(['#f0c870', '#e8845a', '#7fc4b0', '#e86a8a'][Math.floor(R() * 4)]);
    if (st.roof !== 'neon') addFacade(world, facadeOf(id), seeded(([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) ^ (i * 2654435761)) >>> 0), rx, rz, rw, rd, h); // regional skin; own RNG - placement stream untouched
    if (qc) { // silhouette details per district theme
      const dk = '#2d2a28', ac = ['#e8553a', '#3a8ae8', '#e8c43a', '#4ab870', '#b84ae8'][Math.floor(R() * 5)];
      if (qc.T === 'old') {
        put(world, box(w * .28, 2.1, .25, dk), x + (R() < .5 ? -1 : 1) * w * .18, .6 + 1.05, z + d / 2 + .1);
        put(world, box(w * .6, .18, 1, '#7a5a3a'), x, .6 + 3, z + d / 2 + .5);
        for (const k of [-1, 1]) put(world, box(.9, 1.2, .2, '#4a6a5a'), x + k * w * .3, .6 + h * .55, z + d / 2 + .1);
        put(world, box(w + .5, .35, d + .5, '#6b3a2e'), x, top + .2, z);
        put(world, box(w * .55, 1.4, d * .5, '#7a4234'), x, top + 1.1, z);
        if (R() < .6) put(world, box(.8, 2.4, .8, '#8d4a3a'), x + w * .25, top + 2.2, z - d * .2);
      } else if (qc.T === 'down') {
        put(world, box(rw * .72, h * .18, rd * .72, '#9aa6b2'), rx, top + h * .09, rz);
        put(world, box(rw * .4, h * .1, rd * .4, '#7e8a96'), rx, top + h * .18 + h * .05, rz);
        put(world, cyl(.12, .25, 6 + R() * 6, 5, '#c8ccd0'), rx, top + h * .28 + 3, rz);
        for (const k of [-1, 1]) put(world, box(.5, h * .92, .3, ac, { emissive: ac, emissiveIntensity: .35 }), rx + k * rw * .38, .6 + h * .46, rz + rd / 2 + .2);
        put(world, box(rw * .5, 1.1, .3, dk), rx, .6 + .55 + 1.1, rz + rd / 2 + .2);
      } else {
        put(world, box(w + 1.6, .22, 1.6, '#e8d8b8'), x, .6 + h * .5, z + d / 2 + .8);
        put(world, box(w * .9, .12, 1.1, ac), x, .6 + 2.9, z + d / 2 + .7);
        for (const k of [-1, 1]) put(world, cyl(.1, .1, 2.8, 5, '#e8e0cc'), x + k * w * .42, .6 + 1.5, z + d / 2 + 1.1);
        put(world, box(w * .3, 2, .25, dk), x, .6 + 1, z + d / 2 + .1);
        put(world, box(w + .3, .5, d + .3, ac), x, top + .25, z);
      }
    }
    colliders.push({ x, z, r: Math.max(w, d) * .62, hw: w / 2, hd: d / 2, nb: nudgedB ? 1 : 0 }); // r stays the bounding circle for placement/camera spacing; hw/hd give physics the true box footprint; nb marks nudged placements for overlap audit
  }
  finalizeFacades(world); // Update 162: merge collected facade elements into one mesh per material group
  // trees + lamps
  for (let i = 0; i < 120; i++) {
    const x = (R() * 2 - 1) * (S - 4), z = (R() * 2 - 1) * (S - 4);
    if (inQuarter(x, z) || apBlock(x, z, 3) || !inLand(x, z) || inRiver(x, z, 2) || onRoad(x, z) || Math.hypot(x, z + 26) < 22) continue;
    if (stage && Math.abs(x - stage.x) < 12 && z - stage.z > -7 && z - stage.z < 21) continue;
    if (hasPool && Math.abs(x - POOL.x) < POOL.hw + 3 && Math.abs(z - POOL.z) < POOL.hd + 3) continue;
    if (hp && Math.hypot(x - hp[0], z - hp[1]) < 7) continue;
    if (colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 2)) continue;
    if ((id === 'jakarta' || id === 'lagosisland') && NEWCLEAR[id] /* Update 125: lagosisland named-place clearings also suppress scattered trees (jakarta-scoped precedent extended; other cities untouched) */ && NEWCLEAR[id].some(([cx, cz, cr]) => Math.abs(x - cx) < cr && Math.abs(z - cz) < cr)) continue; /* Update 118o: scattered trees respect the jakarta named-place clearings (118n finding: one scattered tree at (13,-66) was the last fabric blocking the west-bank dry window; sydney/cairo/hongkong-scoped clearing pattern at :2003-2006 - deliberately NOT global so the other NEWCLEAR cities' accepted fabric is untouched) */
    const t = leafyTree(1, def.tree); t.position.set(x, .6, z); t.scale.setScalar(.6 + R() * .5); world.add(t); occluders.push(t);
    colliders.push({ x, z, r: 1.25 });
  }
  for (let i = -S + 10; i < S - 6; i += 16) for (const sx of [-6.5, 6.5]) {
    if (nearCut(sx, i, 10) || !inLand(sx, i) || inRiver(sx, i, 1) || roadKeep(sx, i, .8)) continue; // posts stay off the asphalt (crossings, arm and ring bands) and out of the river band (Update 109: the sourced london/paris courses cross road arms)
    put(world, cyl(.1, .12, 4.2, 5, '#3a3d44'), sx, 2.7, i); put(world, sph(.3, '#fff2b0', { emissive: '#fff2b0', emissiveIntensity: .9 }), sx, 4.9, i); colliders.push({ x: sx, z: i, r: .45 });
  }
  // same lamps on the horizontal arm, the z=40 / x=-40 arms and the ring: deterministic grid, no R() consumed;
  // roadAsphalt guard keeps posts off every road band, collider-overlap check keeps them out of buildings
  const lampAt = (lx, lz) => {
    if (nearCut(lx, lz, 10) || !inLand(lx, lz) || inRiver(lx, lz, 1) || roadKeep(lx, lz, .8)) return;
    if (colliders.some(c => Math.hypot(c.x - lx, c.z - lz) < c.r + 1)) return;
    put(world, cyl(.1, .12, 4.2, 5, '#3a3d44'), lx, 2.7, lz); put(world, sph(.3, '#fff2b0', { emissive: '#fff2b0', emissiveIntensity: .9 }), lx, 4.9, lz); colliders.push({ x: lx, z: lz, r: .45 });
  };
  for (let i = -S + 10; i < S - 6; i += 16) for (const sz of [-6.5, 6.5]) lampAt(i, sz);
  for (let i = -S + 10; i < S - 6; i += 16) for (const off of [-5.2, 5.2]) { lampAt(i, 40 + off); lampAt(-40 + off, i); }
  for (let t = -RING + 8; t <= RING - 8; t += 18) for (const off of [-5.6, 5.6]) { lampAt(RING + off, t); lampAt(-RING + off, t); lampAt(t, RING + off); lampAt(t, -RING + off); }
  // signature street props
  { const st = STYLE[id] || {}; const kind = st.prop; const pc = st.pc || '#cccccc';
    if (kind) for (let i = 0; i < 9; i++) {
      const pr = kind === 'taxi' || kind === 'rickshaw' ? 1.5 : kind === 'cafe' ? 1.3 : kind === 'phonebox' ? .8 : kind === 'vending' ? .7 : .5;
      const alongX = i % 2 === 0, t = (R() * 2 - 1) * (S - 14), side = (R() < .5 ? -1 : 1) * (4.5 + pr + .5); // roadside: whole prop footprint + .5 gap clear of the asphalt (was +/-3.2, ON the road)
      const x = alongX ? t : side, z = alongX ? side : t;
      if (apBlock(x, z, 3) || !inLand(x, z) || inRiver(x, z, 2) || Math.hypot(x, z + 26) < 24 || Math.hypot(x, z) < 12) continue;
      if (roadKeep(x, z, pr + .5)) continue; // arms/ring/intersections too: footprint, not just centre, stays off every road
      if (kind === 'taxi' || kind === 'rickshaw') { put(world, box(alongX ? 3.4 : 1.8, 1.1, alongX ? 1.8 : 3.4, pc), x, 1.3, z); put(world, box(alongX ? 1.8 : 1.4, .8, alongX ? 1.4 : 1.8, kind === 'taxi' ? '#222' : '#1a1a1a'), x, 2.1, z); colliders.push({ x, z, r: 1.5 }); }
      else if (kind === 'phonebox') { put(world, box(1.1, 2.4, 1.1, pc), x, 1.8, z); put(world, box(.9, 1.2, .08, '#bfe4ff'), x, 2, z + .56); colliders.push({ x, z, r: .8 }); }
      else if (kind === 'vending') { put(world, box(1, 2, .8, pc, { emissive: pc, emissiveIntensity: .5 }), x, 1.7, z); colliders.push({ x, z, r: .7 }); }
      else if (kind === 'cafe') { put(world, cyl(1.5, 1.5, .1, 8, pc), x, 2.4, z); put(world, cyl(.08, .08, 1.7, 5, '#555'), x, 1.5, z); put(world, cyl(.5, .5, .1, 8, '#e8e0cf'), x + 2.2, 1.6, z); colliders.push({ x, z, r: 1.3 }); }
      else if (kind === 'palm') { put(world, cyl(.25, .35, 5, 6, '#8a6a3a'), x, 3.1, z); put(world, sph(1.4, '#4a9a3a'), x, 6, z); colliders.push({ x, z, r: .5 }); }
      else if (kind === 'lantern') { // lantern pole: post + cross-arm + two hanging emissive paper lanterns (night-market streets)
        put(world, cyl(.08, .1, 3.4, 5, '#4a3a30'), x, 2.3, z);
        put(world, box(alongX ? 2.2 : .12, .12, alongX ? .12 : 2.2, '#4a3a30'), x, 3.9, z);
        for (const k of [-.7, .7]) put(world, cyl(.26, .32, .5, 8, pc, { emissive: pc, emissiveIntensity: .8 }), x + (alongX ? k : 0), 3.55, z + (alongX ? 0 : k));
        colliders.push({ x, z, r: .5 }); }
    } }
  // street-section pilot (row 15): pavement slabs line both sides of the arm and ring roads, breaking at
  // junction mouths, road cuts, the circle/diagonal/arc and the promenade band - gameplay arrangement after
  // city sidewalk sections, not a mapped survey. Deterministic no-R() grid: the placement stream, colliders
  // and slots stay byte-identical; walkable kerb-proud slabs (top .72, like the promenade walk), no new colliders.
  { const pave = (tx, tz, alongX) => { /* one 6-unit tile, band 1.8 wide, inner edge .2 clear of the asphalt side face */
      const hw = alongX ? 3 : .9, hd = alongX ? .9 : 3;
      for (const [px2, pz2] of [[tx - hw, tz - hd], [tx + hw, tz - hd], [tx - hw, tz + hd], [tx + hw, tz + hd]]) if (!inLand(px2, pz2)) return;
      if (nearCut(tx, tz, 2) || (hasPool && Math.abs(tx - POOL.x) < POOL.hw + 2 && Math.abs(tz - POOL.z) < POOL.hd + 2)) return;
      if (PROM) { const cd = PROM.ax === 'x' ? tx : tz, ld = PROM.sg * (PROM.line - cd); if (ld > -2 && ld < 8.8) return; }
      if (CIRC && circD(tx, tz) < CIRC.r1 + 1.6) return;
      if (onDiag(tx, tz, 1.6)) return;
      if (ARC && inArc(tx, tz, ARC.hw + 1.4)) return;
      if (CRING) { const pd = Math.hypot(tx, tz); if (pd > CRING.r0 - 1.2 && pd < CRING.r1 + 1.2 && !onRoad(tx, tz)) return; } /* no pavement slabs over canal water or quays; bridge decks keep theirs */
      for (const c of colliders) { if (c.hw !== undefined) { if (Math.abs(tx - c.x) < hw + c.hw + .12 && Math.abs(tz - c.z) < hd + c.hd + .12) return; } else if (c.r >= 4 && Math.hypot(tx - c.x, tz - c.z) < c.r + 1.8) return; }
      put(world, box(alongX ? 6 : 1.8, .1, alongX ? 1.8 : 6, plaza), tx, .67, tz).castShadow = false; };
    const runBand = (alongX, c0, off, skips, lo, hi) => { /* one side of one centreline: 6-unit tiles along its cut segments */
      for (const [u0, u1] of cutSegs(alongX ? 'x' : 'z', c0)) { const a = Math.max(u0, lo), b = Math.min(u1, hi);
        for (let t = a + 3; t <= b - 3; t += 6) { if (skips.some(([c, cl]) => Math.abs(t - c) < cl + 3.8)) continue;
          if (alongX) pave(t, c0 + off, true); else pave(c0 + off, t, false); } } };
    const XSK = [[0, 4.5], [-40, 3], [RING, 4], [-RING, 4]], ZSK = [[0, 4.5], [40, 3], [RING, 4], [-RING, 4]]; /* cross-street mouths by axis */
    for (const off of [-5.6, 5.6]) { runBand(true, 0, off, XSK, -S, S); runBand(false, 0, off, ZSK, -S, S); }
    if (!CANAL) for (const off of [-4.1, 4.1]) runBand(true, 40, off, XSK, -S, S);
    if (!CANALX) for (const off of [-4.1, 4.1]) runBand(false, -40, off, ZSK, -S, S);
    for (const off of [-5.1, 5.1]) { runBand(false, RING, off, ZSK, -RING, RING); runBand(false, -RING, off, ZSK, -RING, RING); runBand(true, RING, off, XSK, -RING, RING); runBand(true, -RING, off, XSK, -RING, RING); } }
  if (id === 'lagosisland') { /* Update 126 (Main 10:37: stubs = unfinished design): coherent edge treatment for the TBS RCUTS rect - the cut streets END at the square (the real square is street-bounded; the cut roads are NOT real streets, the 125 caveat stands; probe126: exactly 4 stubs - the E-W avenue arm z -5.1..5.4 at both x edges and the N-S road x 73.3..82.8 at both z edges, zero asphalt left inside). Render-only + deterministic no-R(): placement stream, colliders, slots byte-identical. */
    for (const [cx, cz, w2, d2] of [[60.6, .15, 2.4, 11.4], [85, .15, 2.4, 11.4], [78.05, -12.4, 11.4, 2.4], [78.05, 8.2, 11.4, 2.4]])
      put(world, box(w2, .1, d2, plaza), cx, .67, cz).castShadow = false; // pavement cap across each stub: the street ends flush at the square edge (pilot convention, top .72 = asphalt top)
    for (const [bx2, bz2] of [[61.8, -3.6], [61.8, .15], [61.8, 3.9], [83.8, -3.6], [83.8, .15], [83.8, 3.9], [73.9, -11.1], [78.05, -11.1], [82.2, -11.1], [73.9, 6.9], [78.05, 6.9], [82.2, 6.9]])
      put(world, cyl(.12, .14, .9, 6, '#6a6a70'), bx2, 1.17, bz2).castShadow = false; // bollards at each street end (visual only, no colliders - walkable plaza edge)
    for (const [px3, pz3, w3, d3] of [[63.05, -2.1, 2.5, 18], [82.55, -2.1, 2.5, 18], [72.8, -9.85, 17, 2.5], [72.8, 5.65, 17, 2.5]])
      put(world, box(w3, .15, d3, '#d8cba6'), px3, 1.14, pz3).castShadow = false; // perimeter band: fills pad-mesh-to-rect-edge ring so the square reads paved edge-to-edge (matches the TBS pad, 1.14)
    /* Update 134 (superseded by 139): the 133 stream re-roll shifted the seeded parcel tiles and EXPOSED the district road-base underlay (Main 11:31 black-grid flag; mesh-inventory probe134 A/B vs 132) - scoped ground-repair plate in the district ground tone, ABOVE the city-wide 3d4046/4a4d55 district base slabs (top .70), BELOW the .75/.76 surviving parcel-tile tops; NOT a sourced feature: generic district fabric repair */
    /* Update 139 (superseded by 140): strip-based rework - Main's 00:54 pixel verdict: the axis-quantized strip edge (0.5u x 0.25u samples) stair-stepped ON the band silhouette, a sawtooth markedly worse than the 138 fringe it replaced. Lesson ledgered: raycast coverage verifies surface presence, NOT silhouette quality; edge claims need pixel inspection */
    /* Update 140: exact-geometry district plate (Main 00:54: fix the visible silhouette without hiding/narrowing the intended roadway). The plate is now TWO concave flat polygons (the corridor cuts the rect's NW corner piece off the main piece) built in the 131 flat-shape idiom ((x,-z) + rotateX(-PI/2), ShapeGeometry, M(def.ground)): the band-side edges trace the DRAWN corridor as offset polylines derived from DIAGS at hw+0.05, angle joints mitered (offset-line intersection), the hw 1.5->1.0 joint traced along the 131 taper's outer edge so the plate never touches asphalt anywhere - the road keeps its full drawn width with crisp straight edges, and the 0.05u margin sliver reads as a hairline of the same-tone base/dark shoulder. The bend wedge (the 136-verdict triangular artifact) is closed exactly by the mitered joint - no gap, no cap. Rect x 3.55..69.75 (0.05 off the x=0 avenue's drawn edge, no lip), z -68..-4.55 (0.05 off the z=0 avenue's drawn S edge), stub-cap notch x 59.4..61.8 to z -5.56 (the 125 caps at top .72 would otherwise be coplanar). Flat plane at y .7199: visually the 134 .72 plane, 1e-4 below it to break the recorded .72/.72 ties with scattered d4cdb8 pavement patches (the .71 experiment's shadow-bias flip was a 0.01 drop - 1e-4 is two orders below that, still-pair-verified); receiveShadow = true matches the old put() boxes. No strips, no quantization, no coincident side faces. Corner piece (plaza side, NW of the corridor) and main piece emitted as separate simple polygons */
    { const PM = .05, PNX0 = 59.4, PNX1 = 61.8, PNY = -5.56, PW = 3.55, PE = 69.75, PS = -68, PN = -4.55;
      const DSEGS = DIAGS.map(D => { const [ax, az] = D.p0, [bx, bz] = D.p1, L = Math.hypot(bx - ax, bz - az); return { ax, az, bx, bz, L, ux: (bx - ax) / L, uz: (bz - az) / L, hw: D.hw }; });
      const offPt = (sg, t, s, h) => [sg.ax + sg.ux * t - s * sg.uz * (h + PM), sg.az + sg.uz * t + s * sg.ux * (h + PM)]; /* side s=+1 = the S edge, s=-1 = the N edge (left-normal convention, probe-verified) */
      const corrSide = s => { const pts = [offPt(DSEGS[0], 0, s, DSEGS[0].hw)];
        for (let i = 1; i < DSEGS.length; i++) { const A = DSEGS[i - 1], B = DSEGS[i];
          if (Math.abs(A.hw - B.hw) > .01) { pts.push(offPt(A, A.L, s, A.hw)); pts.push(offPt(B, 2.5, s, B.hw)); }
          else { const pa = offPt(A, A.L, s, A.hw), pb = offPt(B, 0, s, B.hw), den = A.ux * B.uz - A.uz * B.ux;
            if (Math.abs(den) < 1e-9) pts.push(pb); else { const t = ((pb[0] - pa[0]) * B.uz - (pb[1] - pa[1]) * B.ux) / den; pts.push([pa[0] + A.ux * t, pa[1] + A.uz * t]); } } }
        pts.push(offPt(DSEGS[DSEGS.length - 1], DSEGS[DSEGS.length - 1].L, s, DSEGS[DSEGS.length - 1].hw)); return pts; };
      const clipRect = pts => { for (let i = 0; i < pts.length - 1; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[i + 1]; if ((z0 - PN) * (z1 - PN) <= 0 && z0 !== z1) { const t = (PN - z0) / (z1 - z0); pts = [[x0 + (x1 - x0) * t, PN]].concat(pts.slice(i + 1)); break; } }
        for (let i = pts.length - 1; i > 0; i--) { const [x0, z0] = pts[i], [x1, z1] = pts[i - 1]; if ((x0 - PW) * (x1 - PW) <= 0 && x0 !== x1) { const t = (PW - x0) / (x1 - x0); pts = pts.slice(0, i).concat([[PW, z0 + (z1 - z0) * t]]); break; } } return pts; };
      const cA = clipRect(corrSide(1)), cB = clipRect(corrSide(-1));
      const corner = [[PW, PN]].concat(cB), main = [cA[0], [PNX0, PN], [PNX0, PNY], [PNX1, PNY], [PNX1, PN], [PE, PN], [PE, PS], [PW, PS], cA[cA.length - 1]].concat(cA.slice(0, -1).reverse());
      for (const poly of [corner, main]) { const psh = new THREE.Shape(); poly.forEach(([pX, pZ], pk) => pk ? psh.lineTo(pX, -pZ) : psh.moveTo(pX, -pZ)); psh.closePath();
        const pg = new THREE.ShapeGeometry(psh); pg.rotateX(-Math.PI / 2); const pm = new THREE.Mesh(pg, M(def.ground)); pm.position.y = .7199; pm.castShadow = false; pm.receiveShadow = true; world.add(pm); } }
    /* Update 137: NM forecourt apron - completes the pad/asphalt resolution (Main 00:07). The x=78 ring road is DRAWN hw ~3.5 (asphalt to x 82.0, probe137-raycast) vs predicate hw 3 (to 81) - the ~0.5 bleed slid under the museum's W wall (corrected footprint face 81.5, sourced way 671991295 bbox). Apron in the district pavement tone '#d4cdb8' (matches the existing 0.72 plate E, tucks 0.01 under it; +0.03 over the 0.68 asphalt - no z-fight either side) covers x 81.2..82.25, z 11.9..21.3: the visible road edge moves 82.0 -> 81.2 (predicate 81 - improved rendering/siting agreement, Main 11:31 rule), the wall rises from forecourt pavement with a 0.3u standoff (real: ~8.7m to the road W, reverse-geocode ledgered), and the collider W face (81.3) sits on pavement, not asphalt. Under-building portion hidden (harmless). No slot in the rect (SET_SLOTS scan); lane dashes at x=78 untouched; tree (79.2,6.3) S of the range. Schematic forecourt edge, not a sourced feature */
    put(world, box(1.05, .11, 9.4, '#d4cdb8'), 81.725, .655, 16.6).castShadow = false;
    /* Update 141: E-ring kerb line - closes the 137-retained base-ground micro-seam x 82.0..82.2 (probe141/141d-mapped: the .2 designed kerb gap between the ring asphalt's drawn bleed edge (~81.8-82.0) and the runBand pavement band's W edge (82.2) exposes the .60 base along the band's full length). Kerb in the 137-apron idiom: d4cdb8, top .71 = tucks .01 under the band (.72), +.03 over the asphalt bleed (.68), walkable, no colliders, no slots in the rect (SET_SLOTS scanned: nothing in x 81.95..82.25). Runs = exactly the measured band-presence runs (probe141d: [-72,-48],[-30,-12],[7,15],[21,30],[49,72]) minus the 137 apron z-range (11.9..21.3 - apron already covers the seam there; coplanar overlap avoided). NOT added where the band is absent by design: TBS pad z -11..7, the z=40 road crossing z 31..48 (asphalt there), ring-corner mouth skips z >72/<-72, and the z -47..-31 tree-disc-skip verge (recorded, deferred - a kerb stripe inside a 2u verge reads worse than the uniform verge). render-only, deterministic no-R() */
    for (const [kz0, kz1] of [[-72, -48], [-30, -12], [7, 11.85], [21.35, 30], [49, 72]])
      put(world, box(.3, .1, kz1 - kz0, '#d4cdb8'), 82.1, .655, (kz0 + kz1) / 2).castShadow = false;
    /* Update 136: Broad St furniture - the sourced street renders bare; real Broad St is a lit commercial street. Deterministic lampAt-model poles (no R() consumed) walking the band's arc length: one every 9u, alternating sides at hw+1.5 off the centreline. Guards: roadAsphalt(.8) (predicate incl. the 1.42x diag inflation - conservative), rect+disc colliders (+.6/+.8), slots (<1.4), the plaza circle (r 21.5 - no poles sunk in the pad), nearCut(3) (the street ends AT the square). Colliders r .45 like the grid lamps; placement AFTER extrasSet so pads are seen */
    { const pts = []; let acc = 0;
      for (const sg of def.diagonals) { const [ax, az] = sg.p0, [bx, bz] = sg.p1, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
        for (let t = 0; t <= len; t += .5) pts.push([acc + t, ax + ux * Math.min(t, len), az + uz * Math.min(t, len), ux, uz, sg.hw]);
        acc += len; }
      let flip = 1;
      const lampOK = (lx, lz) => inLand(lx, lz) && !inRiver(lx, lz, 1) && !roadAsphalt(lx, lz, .8) && !nearCut(lx, lz, 3) && Math.hypot(lx, lz + 26) >= 21.5 && !colliders.some(c => c.hw !== undefined ? Math.abs(lx - c.x) < c.hw + .6 && Math.abs(lz - c.z) < c.hd + .6 : Math.hypot(lx - c.x, lz - c.z) < c.r + .8) && !(SET_SLOTS.lagosisland || []).some(([sx2, sz2]) => Math.hypot(lx - sx2, lz - sz2) < 1.4);
      for (let a = 4; a < acc - 2; a += 8) { const q = pts.find(p => p[0] >= a); if (!q) break; const [, px, pz, ux, uz, hw] = q, off = hw + 1.5;
        let lx = px - flip * off * uz, lz = pz + flip * off * ux;
        if (!lampOK(lx, lz)) { const ax2 = px + flip * off * uz, az2 = pz - flip * off * ux; if (lampOK(ax2, az2)) { lx = ax2; lz = az2; } else continue; }
        flip = -flip;
        put(world, cyl(.1, .12, 4.2, 5, '#3a3d44'), lx, 2.7, lz); put(world, sph(.3, '#fff2b0', { emissive: '#fff2b0', emissiveIntensity: .9 }), lx, 4.9, lz); colliders.push({ x: lx, z: lz, r: .45 }); } }
    /* Update 133: Tinubu RCUT rect stub treatment (126 convention) - the avenue ends AT the square: S stub cap (0,-52), N stub cap SPLIT around the Broad St band gap (x -2.6..0.0 at z -41) so the street visibly flows into the square */
    for (const [cx, cz, w2, d2] of [[0, -52.3, 11.4, 2.4], [-4.15, -40.2, 3.1, 2.4], [2.85, -40.2, 5.7, 2.4]])
      put(world, box(w2, .1, d2, plaza), cx, .67, cz).castShadow = false;
    for (const [bx2, bz2] of [[-3.6, -52], [0.15, -52], [3.9, -52], [-3.6, -40.5], [0.15, -40.5], [3.9, -40.5]])
      put(world, cyl(.12, .14, .9, 6, '#6a6a70'), bx2, 1.17, bz2).castShadow = false; // bollards at each stub end (visual only)
    for (const [px3, pz3, w3, d3] of [[-10.1, -46, .8, 10], [-0.1, -46, 1.2, 10], [-5.2, -40.75, 11, .5], [-5.2, -51.5, 11, 1.0]])
      put(world, box(w3, .15, d3, '#d8cba6'), px3, 1.14, pz3).castShadow = false; // perimeter ring: pad-to-rect-edge, abuts the 9x9 pad (no overlap)
  }
  // collectible spots: along roads and the plaza
  for (let i = 0; i < 150; i++) {
    const x = (R() * 2 - 1) * (S - 8), z = (R() * 2 - 1) * (S - 8);
    if (apBlock(x, z, 2) || !inLand(x, z) || inRiver(x, z, 3.5) || hasPool && Math.abs(x - POOL.x) < POOL.hw + 2 && Math.abs(z - POOL.z) < POOL.hd + 2) continue;
    if (NEWCLEAR[id] && NEWCLEAR[id].some(([cx, cz, cr]) => Math.abs(x - cx) < cr - 1 && Math.abs(z - cz) < cr - 1)) continue; // keep named-place clearings free of pickup slots so the place can stand at its real bearing
    if (CANALX && Math.abs(x + 40) < 4.4 && Math.abs(z) > 5.5 && Math.abs(z - 40) > 3.5) continue; // no pickups in the canal water
    if (CANAL && Math.abs(z - 40) < 4.4 && (Math.abs(x + 40) > 3.5 && Math.abs(x) > 5.5)) continue; // no pickups in the canal water
    if (CRING && Math.hypot(x, z) > CRING.r0 - .8 && Math.hypot(x, z) < CRING.r1 + .8 && !onRoad(x, z)) continue; // no pickups in the canal ring water
    if (colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 1.4)) continue;
    itemSpots.push({ x, z });
  }
  for (let i = 0; i < 6; i++) { const c = new THREE.Group(); const a = sph(3 + R() * 2, '#ffffff', { roughness: 1, flatShading: true }); a.scale.y = .5; c.add(a); c.position.set((R() * 2 - 1) * 160, 70 + R() * 15, (R() * 2 - 1) * 120); world.add(c); clouds.push(c); }

  if (typeof location === 'undefined' || !new URLSearchParams(location.search).has('nomerge')) mergeStatic(world, [...clouds, ...butterflies]);
  const lim = S - 5;
  if (id === 'hongkong') extrasHK(world, colliders, places, S, roadAsphalt);
  if (id === 'dubai') extrasDubai(world, colliders, places, roadAsphalt);
  if (id === 'mumbai') extrasMumbai(world, colliders, places, roadAsphalt);
  if (id === 'bangkok') extrasBangkok(world, colliders, places, roadAsphalt);
  if (id === 'berlin') extrasBerlin(world, colliders, places, roadAsphalt, inRiver);
  if (id === 'moscow') extrasMoscow(world, colliders, places, roadAsphalt);
  if (id === 'seoul' || id === 'beijing') extrasSeoulBeijing(world, colliders, places, roadAsphalt, id);
  if (id === 'buenosaires') extrasBA(world, colliders, places, roadAsphalt);
  if (id === 'kualalumpur') extrasKL(world, colliders, places, roadAsphalt);
  extraAvoid = RCUTS.length && hasPool ? POOL : null;
  extraStage = RCUTS.length ? stage : null;
  extrasNewCities(world, colliders, places, roadAsphalt, id, inRiver); /* 118n: jakarta rv wiring */
  /* Update 138 (Main 00:21: the inside-museum lamp is an ordinary geometry defect within existing build scope - resolve, preserving intended road lighting): lampAt's collider check reads only DISC colliders (c.r+1), so the E-ring station (83.6,20) was placed inside the museum's RECT collider (swallowed since 125c; hidden by the oversized model until the 137 footprint correction exposed the volume). Scoped repair: if the (83.6,20) lamp exists AND sits inside a rect collider, remove its meshes+disc and re-site the station to (83.6,22.5) - same road line, same side, 1.6u off the drawn asphalt edge like every ring lamp, S of the museum (rect-clear incl. the porch columns at z 20.98, slot-clear >=1.4, roadKeep/nearCut guarded). The cadence gap at the junction (t=2 station is RCUT-skipped) is unchanged. Deterministic, no R(); lagosisland-scoped - other cities' accepted lamp layouts untouched */
  if (id === 'lagosisland') { const li = colliders.findIndex(c => c.r === .45 && Math.abs(c.x - 83.6) < .01 && Math.abs(c.z - 20) < .01);
    const inRect = (lx, lz) => colliders.some(c => c.hw !== undefined && Math.abs(lx - c.x) < c.hw + .95 && Math.abs(lz - c.z) < c.hd + .95);
    if (li >= 0 && inRect(83.6, 20)) { colliders.splice(li, 1);
      for (const m of world.children.filter(m => Math.abs(m.position.x - 83.6) < .01 && Math.abs(m.position.z - 20) < .01)) world.remove(m);
      if (!nearCut(83.6, 22.5, 10) && !roadKeep(83.6, 22.5, .8) && !inRect(83.6, 22.5) && !colliders.some(c => c.r !== undefined && Math.hypot(c.x - 83.6, c.z - 22.5) < c.r + 1)) lampAt(83.6, 22.5); } }
  extraAvoid = null; extraStage = null;
  if (id === 'rome') extrasRome(world, colliders, places, roadAsphalt, inRiver);
  if (id === 'athens') extrasAthens(world, colliders, places, roadAsphalt);
  if (id === 'singapore') extrasSingapore(world, colliders, places, roadAsphalt);
  if (id === 'sydney') extrasSydney(world, colliders, places, roadAsphalt, []);
  if (id === 'paris') extrasParis(world, colliders, places, roadAsphalt, []);
  if (id === 'cairo') extrasCairo(world, colliders, places, roadAsphalt, [[-30.55, 17.88]]);
  if (id === 'toronto') extrasToronto(world, colliders, places, roadAsphalt);
  if (id === 'london') extrasLondon(world, colliders, places, roadAsphalt); // after every generator: named places must not shift the seeded layout or the static pickup slots
  if (ESH) for (let i = places.length - 1; i >= 0; i--) if (places[i].x > shoreX(places[i].z) && places[i].name !== 'Harbour pier') places.splice(i, 1);
  if (SHORE_ON) for (let i = places.length - 1; i >= 0; i--) if (places[i].z > shoreAt(places[i].x) && places[i].name !== 'Harbour pier') places.splice(i, 1); // quarter centres and plazas that fall in the water are omitted, not relocated
  return {
    parkRectGuard: RCUTS.length > 0, noPark: CIRC ? ((x, z) => circD(x, z) < CIRC.r1 + 2) : null, /* the roundabout island is ground, not road: keep generated parked vehicles off it */ group: world, places, colliders, itemSpots, clouds, butterflies, sky: def.sky, fog: def.fog, sun: def.sun, stage, onRoad, roadAsphalt, plaza: { x: 0, z: -26, r: 20 },
    roads: [{ ax: 'z', c: 0, from: -S, to: S }, { ax: 'x', c: 0, from: -S, to: S }, { ax: 'z', c: 40, from: -S, to: S }, { ax: 'x', c: -40, from: -S, to: S },
      { ax: 'z', c: RING, from: -RING, to: RING }, { ax: 'z', c: -RING, from: -RING, to: RING }, { ax: 'x', c: RING, from: -RING, to: RING }, { ax: 'x', c: -RING, from: -RING, to: RING }].filter(r => !(r.ax === 'z' && r.c > shoreMax)),
    occluders, airport, ferry: hp ? { x: hp[0], z: hp[1], arrive: [hp[0], hp[1]], r: 11 } : null,
    groundY: (x, z) => {
      if (x === undefined || !stage) return .62;
      const onPlat = Math.abs(x - stage.x) < stage.w / 2 && Math.abs(z - stage.z) < stage.d / 2;
      if (onPlat) return .62 + stage.h;
      const rz = z - (stage.z + stage.d / 2);
      if (Math.abs(x - stage.x) < 2 && rz >= 0 && rz <= stage.ramp) return .62 + stage.h * (1 - rz / stage.ramp);
      return .62;
    },
    clamp(x, z) {
      x = Math.max(-lim, Math.min(lim, x)); z = Math.max(-lim, Math.min(lim, z));
      if (def.water === 'west') x = Math.max(-S + 8, x); if (def.water === 'east') x = Math.min(ESH ? shoreX(z) - 2 : S - 8, x);
      if (def.water === 'north') z = Math.max(-S + 8, z); if (def.water === 'south') z = Math.min(SHORE_ON ? shoreAt(x) - 2 : S - 8, z);
      return [x, z];
    },
    clampSwim(x, z) { // 118t: ON-FOOT-ONLY relaxed clamp - the water side lets a walking player wade SWIM_OUT units past the waterline (beach swimming); vehicles and taxis keep clamp(), so they never enter the swim band
      let x0 = Math.max(-lim, Math.min(lim, x)), z0 = Math.max(-lim, Math.min(lim, z)); // 118t: lateral/land sides keep the +-lim cap...
      if (def.water === 'west') x0 = Math.min(lim, Math.max(-(S - 4) - SWIM_OUT, x)); // ...but the water side relaxes PAST +-lim to waterline+SWIM_OUT (the cap would strangle a plain shore's band to 1u - 118t probe fix)
      if (def.water === 'east') x0 = Math.max(-lim, Math.min((ESH ? shoreX(z) : S - 4) + SWIM_OUT, x));
      if (def.water === 'north') z0 = Math.min(lim, Math.max(-(S - 4) - SWIM_OUT, z));
      if (def.water === 'south') z0 = Math.max(-lim, Math.min((SHORE_ON ? shoreAt(x) : S - 4) + SWIM_OUT, z));
      return [x0, z0];
    },
    clampBall(x, z) { // 148: ball-specific water clamp - same as clampSwim but the water side relaxes to waterline + BALL_OUT (soak zone); land/lateral sides identical
      let x0 = Math.max(-lim, Math.min(lim, x)), z0 = Math.max(-lim, Math.min(lim, z));
      if (def.water === 'west') x0 = Math.min(lim, Math.max(-(S - 4) - BALL_OUT, x));
      if (def.water === 'east') x0 = Math.max(-lim, Math.min((ESH ? shoreX(z) : S - 4) + BALL_OUT, x));
      if (def.water === 'north') z0 = Math.min(lim, Math.max(-(S - 4) - BALL_OUT, z));
      if (def.water === 'south') z0 = Math.max(-lim, Math.min((SHORE_ON ? shoreAt(x) : S - 4) + BALL_OUT, z));
      return [x0, z0];
    },
    spawn: { x: 0, z: 10 },
    beachBalls: (() => { // 118v: playable beach balls on the sand band - FIXED coords derived from the shore defs (no seeded stream consumed); a spot blocked by a collider is dropped
      if (!def.water) return [];
      const out = []; let n = 0;
      for (const a of [-42, 0, 42]) {
        let x, z;
        if (def.water === 'south') { x = a; z = (SHORE_ON ? shoreAt(a) : S - 6) - 3; }
        else if (def.water === 'east') { x = (ESH ? shoreX(a) : S - 6) - 3; z = a; }
        else if (def.water === 'west') { x = -(S - 6) + 3; z = a; }
        else { x = a; z = -(S - 6) + 3; } // north
        if (colliders.some(cc => !cc.off && (cc.hw !== undefined ? Math.abs(x - cc.x) < cc.hw + .8 && Math.abs(z - cc.z) < cc.hd + .8 : Math.hypot(x - cc.x, z - cc.z) < cc.r + .8))) continue;
        out.push({ id: 'bb' + n++, x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2 });
      }
      return out;
    })(),
    surf: (() => { // 118x: stylized animated surf ribbons - FIXED geometry derived from the authored shore defs (no seeded stream consumed); ambient visual only, NOT bathymetry/wave data
      if (!def.water) return null;
      // 118x-rev3: the surf renders against the DRAWN water edge, not the S-6 predicate line - for flat (non-poly) shores the drawn sea slab is the 16-wide box centered +-S+4, so its landward edge is +-(S-4), TWO units seaward of the S-6 predicate (slabprobe: no slab coverage x in [104,106] on flat-east sydney, asphalt/sand drawn there - the rev2 foam at 104-106 painted over it, Main 19:11 pixel verdict). Poly shores (shoreAt/shoreX) already match their drawn polygons. The S-6 swim predicate mismatch itself is pre-existing (118t) and NOT changed here.
      if (def.water === 'south') return { ori: 's', lim, at: x => SHORE_ON ? shoreAt(x) : S - 4 };
      if (def.water === 'east') return { ori: 'e', lim, at: z => ESH ? shoreX(z) : S - 4 };
      if (def.water === 'west') return { ori: 'w', lim, at: () => -(S - 4) };
      return { ori: 'n', lim, at: () => -(S - 4) };
    })(),
    inPool, inSwim, inSea, inSeaOpen, inRiver, pool: hasPool ? POOL : null, harbour: shore,
    waterDepth: 0,
    // boats: only in coastal cities. t = distance out to sea from the coastline.
    boat: shore && {
      nearShore(x, z) { if (ESH) return Math.abs(x - shoreX(z)) < 16; if (SHORE_ON) return Math.abs(z - shoreAt(x)) < 16; const v = shore.ax === 'x' ? x : z; return Math.abs(v - shore.line) < 16; },
      toWater(x, z) { if (ESH) return [shoreX(z) + 2.5, z]; if (SHORE_ON) return [x, shoreAt(x) + 2.5]; const v = shore.ax === 'x' ? x : z; const nv = shore.line + shore.sg * 2.5; return shore.ax === 'x' ? [nv, z] : [x, nv]; },
      toLand(x, z) { if (ESH) return [shoreX(z) - 1.5, z]; if (SHORE_ON) return [x, shoreAt(x) - 1.5]; const v = shore.ax === 'x' ? x : z; const nv = shore.line - shore.sg * 1.5; return shore.ax === 'x' ? [nv, z] : [x, nv]; },
      clamp(x, z) {
        if (ESH) { z = Math.max(-lim, Math.min(lim, z)); return [shoreX(z) + Math.max(1, Math.min(60, x - shoreX(z))), z]; }
        if (SHORE_ON) { x = Math.max(-lim, Math.min(lim, x)); return [x, shoreAt(x) + Math.max(1, Math.min(60, z - shoreAt(x)))]; } // sloped shore: water depth measured from the local shoreline
        let a = shore.ax === 'x' ? x : z, l = shore.ax === 'x' ? z : x;
        l = Math.max(-lim, Math.min(lim, l));
        const t = (a - shore.line) * shore.sg; a = shore.line + shore.sg * Math.max(1, Math.min(60, t));
        return shore.ax === 'x' ? [a, l] : [l, a];
      },
      colliders: boatColliders,
    },
  };
}
