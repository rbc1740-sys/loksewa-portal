/**
 * Fill in the 164 missing explanations in geotechnical.json (tunnel engineering
 * and seismology questions) and fix the wrong answer key on the Nepal
 * earthquake question (id 834).
 *
 * Explanations are keyed by the question `id` field.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'questions', 'geotechnical.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const EXPLANATIONS = {
  // ---------------- Tunnel engineering (set 1) ----------------
  '687': 'Drifts are horizontal passageways driven into a hillside; their natural direction of excavation is horizontal.',
  '689': 'The entrance/exit of a tunnel is called a portal (the invert is the floor, the crown the roof).',
  '690': 'The bottom floor of a tunnel is termed the invert.',
  '691': 'Tunnels are built for highways, railways, sewerage and water supply projects; hence all of the above.',
  '692': 'For highways, tunnelling is preferred once the open-cut depth exceeds about 15 m.',
  '693': 'Railways cannot climb steep grades, so tunnelling through the hill is preferred over detours or deep open cuts.',
  '694': 'Tunnels stay free of snow, shorten the route (reducing cost), lower maintenance expense and avoid surface-rights conflicts.',
  '695': 'As per the standard key, the incorrect statement is that reference points are set on the roof; they are normally fixed near the invert/workable area. The other three are valid setting-out practices for inclined tunnels.',
  '696': 'Reference points at intervals, alignment from the apex and invert-level marking are all correct practices for inclined tunnels; the keyed incorrect option is marking reference points on the roof.',
  '697': 'For a Broad Gauge (BG) single track, the tunnel section requires a clear width of about 4.9 m to 5.5 m.',
  '698': 'For BG single track the height above the rail top should be about 6.7 m to 7.3 m.',
  '699': 'The difference in height above rail top between BG and metre gauge (MG) tunnels is kept 0.60 m.',
  '700': 'For tunnels longer than 300 m the gradient is limited to about 75% of the ruling gradient to help ventilation and drainage.',
  '701': 'A pair of smaller tunnels reduces construction cost, avoids head-on collisions, separates the two traffic streams and eases repairs.',
  '702': 'In firm ground, full-face, top-heading-and-benching and drift methods may all be adopted depending on section size.',
  '703': 'In the full-face method the excavation is generally divided into three sections (top, centre, bottom).',
  '704': 'Forepoling is used in soft/loose ground where the working face needs temporary support.',
  '705': 'Railway tunnels are generally given a polycentric (horseshoe) section.',
  '706': 'In the drift method the heading (drift) may be opened at the centre, bottom, top or side.',
  '707': 'Liner-plate, shield, compressed-air and mole (mechanical tunneller) methods all avoid the use of timbering.',
  '708': 'The needle beam in the needle-beam method is usually 5 m to 6 m long.',
  '709': 'In heading-and-benching, the keyed incorrect statement is that removal of muck from the heading is very easy (option c); that is not an advantage claimed for this method.',
  '710': 'The keyed incorrect statement for heading-and-benching is that head holes are fired just before bench holes; in practice the bench is fired first to provide a working platform.',
  '711': 'For a good blast, the cut hole is inclined at about 45 degrees to the tunnel face.',
  '712': 'The commonly adopted cut-hole patterns include wedge, pyramid, fan and V cuts - all of the above.',
  '713': 'To attain the required tunnel section shape, a tunnel template (profile) is used.',
  '714': 'Ammonia dynamite is the explosive generally used for tunnelling in soft rocks.',
  '715': 'Safe excavation limits include oxygen >=19.5%, CO2 <=0.5%, H2S <=0.001% and CO <=0.01% - all statements are correct.',
  '717': 'Cast-iron lining is suitable for shield-driven tunnels in subaqueous regions because it is strong, watertight and can be erected under compressed air.',
  '718': 'In rock terrain, concrete lining is placed concurrently with the driving operation.',
  '719': 'High-pressure grouting is used when the rock is fissured, poor or likely to seep water - all of the above.',
  '720': 'Drainage in tunnels covers fore-drainage, dewatering and permanent drainage.',
  '721': 'Permanent drainage is achieved by longitudinal drains, open drains, concrete lining and grouting.',
  '722': 'Mechanical ventilation may blow fresh air, exhaust foul air, or do both by ducts.',
  '723': 'Muck cars include muck boxes, balle-ships, side-dump cars and U-bottom cars.',
  '724': 'Two openings are provided in the wooden bulkhead used for mucking in steep-grade tunnels.',
  '725': 'Grass-hopper, passing-track, cherry-picker, California-crossing and Dixon-conveyor layouts are all used for muck-car tracks.',
  '726': 'The grass-hopper method needs an overhead track on a large truss frame for the car changer.',
  '727': 'In the full-face method the first operation is excavation along the periphery (top), then the rest follows.',
  '728': 'The cutting edge is a component of the tunnelling shield; liner plates, trench jacks and stiffeners are separate lining/support items.',
  '729': 'The liner plate is not a component of the shield - it is the temporary lining placed behind it.',
  '730': 'The drift method is used for tunnelling in rock where the tunnel is driven as separate drifts.',
  '731': 'The army method is used for laying underground sewers.',
  '732': 'For enlarging holes, drilling equipment follows the order: wagon drill then churn drill then shot drill.',
  '733': 'Underground passages driven without disturbing the overlying soil cover are called tunnels.',
  '734': 'Tunnels excavated to divert traffic from surface to subsurface routes are traffic tunnels.',
  '735': 'Sewage tunnels are not a sub-group of traffic tunnels (railway, highway and pedestrian tunnels are).',
  '736': 'Tunnels associated with hydropower generation are called hydropower tunnels.',
  '737': 'A circular section is not suitable for placement of concrete lining; it suits water, non-cohesive soil and shield-driven work.',
  '738': 'A cut hole inclined at 45 degrees gives a good yield blast.',
  '739': 'A charge equidistant from two free faces gives about 2.25 times the yield of a single-face shot.',
  '740': 'Drifters can drill horizontal, down or up holes.',
  '741': 'With N shafts the total working faces available = 2N (shaft ends) + 2 (portal ends) = 2N + 2.',
  '742': 'About 6 cubic metres of free air per minute per square metre of face area is provided in compressed-air tunnelling.',
  '743': 'The empirical lining thickness is about 82D mm where D is the tunnel diameter in metres.',
  '744': 'Ribs are used to stiffen liner plates when the tunnel diameter exceeds 3 m.',
  '746': 'The Austrian method is used for long tunnels at great depths.',
  '747': 'Tunnelling is required for an underground passage.',
  '748': 'The line where the tunnel wall changes from sloping to the vertical is the spring line.',
  '749': 'Hydrological conditions are the key consideration while aligning a tunnel.',
  '750': 'Benching is adopted when the full tunnel section cannot be excavated at once.',
  // ---------------- Tunnel engineering (set 2) ----------------
  '1': 'In heading-and-benching, the keyed incorrect statement is that removal of muck from the heading is very easy (option c); that is not an advantage claimed for this method.',
  '2': 'The difference of tunnel height above rail top between BG and MG tracks is kept 0.60 m.',
  '3': 'In the drift method the drift may be excavated at the centre, bottom, top or side.',
  '4': 'Tunnels stay free of snow, shorten the route, lower maintenance and avoid surface-rights conflicts.',
  '5': 'For BG single track the height above the rail top should be about 6.7 m to 7.3 m.',
  '8': 'Tunnel drainage is done by fore-drainage, dewatering and permanent drainage.',
  '9': 'Oxygen >=19.5%, CO2 <=0.5%, H2S <=0.001% and CO <=0.01% are the safe limits during excavation - all are correct.',
  '11': 'Horizontal wedge, pyramid, fan and V cuts are all common cut-hole patterns.',
  '12': 'Cast-iron lining is best for shield-driven tunnels in subaqueous regions.',
  '13': 'Railways prefer tunnelling because they cannot climb the steep grades.',
  '14': 'Historical order: Roman tunnel by Emperor Claudius (1) then first navigational tunnel in France (4) then first highway tunnel in Hungary (2) then first underground railway tunnel in Great Britain (3).',
  '15': 'Hard-rock tunnelling sequence: drilling (3), loading and firing (2), ventilation and dust removal (6), mucking (5), groundwater removal (1), grouting and lining (4).',
  '16': 'Blowing fresh air, exhausting foul air, or both via ducts are all mechanical-ventilation methods.',
  '17': 'Liner-plate, shield, compressed-air and mole methods all avoid the use of timbering.',
  '18': 'Highway tunnelling is preferred when the open cut exceeds 15 m depth.',
  '19': 'Rock tunnelling sequence: mark tunnel profile (2), set up and drill (3), remove foul gases (1), check misfire (4), mucking (5).',
  '20': 'Twin tunnels economise construction, avoid collisions, separate traffic streams and ease repairs.',
  '22': 'Forepoling is adopted for tunnelling in soft ground.',
  '23': 'In rock terrain concrete lining is placed concurrently with the driving operation.',
  '24': 'The dust concentration (0.5-5 micron particles) at the working face should not exceed 450 particles per cubic cm.',
  '25': 'The keyed incorrect statement is (e): head holes are fired and mucked out, not "just before" the bench holes are fired.',
  '26': 'Grass-hopper, passing-track, cherry-picker, California-crossing and Dixon-conveyor are all muck-car track layouts.',
  '27': 'Alignment transfer through shafts: hang plumb lines (1), suspend 35 kg weights (3), immerse weights in water buckets (4), then determine the bearing of the plumb plane (2).',
  '28': 'Initial tunnel surveys: preliminary setting on Survey of India maps (3), marking obligatory points on maps (2), driving lines between points (4), then marking portals with concrete pillars (1).',
  '30': 'Tunnels serve highways, railways, sewerage and water-supply projects.',
  '31': 'Two openings are provided in the wooden bulkhead for mucking in steep-grade tunnels.',
  '32': 'Railway tunnels are generally polycentric (horseshoe) in section.',
  '33': 'Ammonia dynamite is the explosive used for tunnelling in soft rocks.',
  '34': 'The cut with parallel inclined holes is called a Michigan cut.',
  '35': 'A BG single-track tunnel needs a clear width of about 4.9 m to 5.5 m.',
  '36': 'Full-face, top-heading-and-benching and drift methods can all be used in firm ground.',
  '38': 'All statements - use of SOI maps, reciprocal ranging, 1-in-10,000 planimetric accuracy and 1-second theodolite - are correct.',
  '39': 'At the face the correct sequence is: drill holes, heading, mucking, then benching = 4 1 3 2.',
  '40': 'The needle beam used in the needle-beam method is usually 5 m to 6 m long.',
  '41': 'High-pressure grouting is resorted to when the rock is highly fissured, poor, or likely to seep water.',
  '42': 'Muck boxes, balle-ships, side-dump cars and U-bottom cars are all used to haul muck.',
  '43': 'Longitudinal drains, open drains, concrete lining and grouting all contribute to permanent drainage.',
  // ---------------- Seismology & geology ----------------
  '751': 'Seismic waves are classified into body waves (P and S) and surface waves (Rayleigh and Love).',
  '752': 'Compressional (P) waves and shear (S) waves travel through the body of the Earth, so they are body waves.',
  '753': 'Compressional (P) waves are sound-like (acoustical) waves that alternately compress and rarefy the medium.',
  '754': 'Shear (S) waves cannot pass through fluids (liquids and gases) because fluids cannot resist shear.',
  '756': 'The velocity of Rayleigh waves depends on the Poisson ratio of the medium.',
  '757': 'P waves travel faster than S waves; P and S are body waves, not surface waves.',
  '759': 'L (Love/surface) waves produce a rolling effect as they travel along the earth surface.',
  '761': 'Seismic waves let seismologists study the layered interior of the Earth.',
  '763': 'The instrument that records earthquake vibrations is a seismograph.',
  '765': 'The MSK intensity scale is based on type of structure, percentage of damage and grade of damage; it does not depend on location of the structure.',
  '766': 'The MSK (Medvedev-Sponheuer-Karnik) intensity scale ranges from I to XII (twelve).',
  '769': 'Moment magnitude is measured from the seismic moment (moment released during the earthquake rupture).',
  '770': 'Seismic moment depends on rupture dimensions, rock shear strength and fault slip - not on the friction coefficient between rock surfaces.',
  '771': 'Richter plotted the distance of the seismometer from the epicentre against amplitude to develop the magnitude scale.',
  '773': 'The amount of energy released by an earthquake is called its magnitude.',
  '774': 'Convergent plate boundaries produce both folds and faults (compression features).',
  '775': 'Divergent plate boundaries are dominated by tensional faulting.',
  '777': 'The point inside the earth where the earthquake starts is the hypocenter (focus); directly above it on the surface is the epicenter.',
  '779': 'The elastic rebound theory explains how stress builds up in rocks and is suddenly released along a fault.',
  '780': 'The amount of ground displacement along a fault during an earthquake is called slip.',
  '781': 'The inclined sides of a fold (between crest/trough and the axial plane) are its limbs.',
  '784': 'During a P wave, rock particles move back and forth parallel to the direction of wave travel.',
  '786': 'Earthquakes can occur with normal, reverse or thrust faulting - all of these.',
  '787': 'The Modified Mercalli scale measures intensity from the observed effects on people and structures.',
  '788': 'About 90% of earthquakes occur at plate boundaries.',
  '789': 'Vibrations radiating from the focus in all directions are called seismic waves.',
  '790': 'Moment magnitude depends on the fault-break area, fault rigidity and slip - not on the type of faulting.',
  '791': 'Earthquakes occur most frequently at plate boundaries.',
  '792': 'Most earthquakes occur along faults.',
  '793': 'Charles Richter developed the procedure (Richter magnitude scale) used to measure earthquake size.',
  '794': 'S waves cannot travel through liquids, so entering a liquid makes their velocity drop to zero.',
  '795': 'Body waves consist of P waves and S waves.',
  '796': 'Surface waves are generally the most destructive because they cause large ground displacements near the surface.',
  '797': 'In an S wave, particles vibrate perpendicular to the direction of wave travel.',
  '798': 'The maximum angle that a bed makes with the horizontal is its dip.',
  '799': 'The geographic direction of the intersection line of a bedding plane with a horizontal plane is the strike.',
  '800': 'Apparent dip is always smaller than the true dip (measured perpendicular to the strike).',
  '801': 'P waves slow down when passing from a solid into a liquid, because liquids offer less resistance to compression; broadly their velocity decreases.',
  '802': 'Surface waves are the slowest of the seismic waves.',
  '803': 'In a syncline, the younger (inner) rocks usually occupy the interior of the fold.',
  '804': 'The head (rake) of the fault plane is its inclination with the vertical.',
  '805': 'The Main Central Thrust (MCT) in Nepal has the highest potential for the largest earthquakes.',
  '807': 'Magnitude 8 earthquakes occur approximately every 5 to 10 years.',
  '810': 'Velocity varies with the square root of modulus over density, so if only density increases, the P-wave velocity decreases.',
  '811': 'The mantle-outer-core boundary is the change from 100% solid (mantle) to 100% liquid (outer core).',
  '812': 'As the epicentral distance (travel time) increases, the S-P arrival-time difference increases.',
  '814': 'The focus (hypocenter) lies directly below the epicenter on the surface.',
  '815': 'Shallow (< 20 km) earthquakes are associated with convergent, divergent and transform plate boundaries alike.',
  '816': 'Transform faults produce strike-slip faulting (horizontal motion).',
  '817': 'Earthquakes can trigger tsunamis, intense ground shaking and landslides.',
  '818': 'Tsunamis can be triggered by undersea earthquakes, undersea landslides and oceanic volcanic eruptions.',
  '819': 'The false statement is (b): the time and location of most major earthquakes cannot be predicted several days in advance.',
  '820': 'Increased frequency of smaller earthquakes, rapid ground tilting and well-water-level changes can all be precursory signs.',
  '821': 'Today scientists can characterise seismic risk but cannot yet accurately predict most earthquakes.',
  '822': 'Earthquakes result from brittle failure (rupture) during faulting of the earth crust.',
  '823': 'Magnitudes 6.0-6.9 are classified as "strong" earthquakes.',
  '824': 'Magnitudes 4.0-4.9 are classified as "light" earthquakes.',
  '825': 'Energy builds up in the upper mantle (lithosphere) and is suddenly released when the strain exceeds rock strength.',
  '826': 'Thousands of earthquakes occur around the world each year.',
  '827': 'At Mercalli intensities of VII and above the scale measures effects on buildings and structures.',
  '829': 'Poorly built buildings may collapse at Modified Mercalli intensity VI.',
  '830': 'Windows may rattle and people feel tremors at Modified Mercalli intensity IV.',
  '831': 'A seismograph records the vibrations produced during an earthquake.',
  '832': 'Magnitude indicates the amount of energy released by an earthquake.',
  '834': 'The biggest recent earthquake in Nepal was the 2015 Gorkha earthquake - magnitude 7.8, called the Gorkha Earthquake, with about 9,000 casualties; all three statements are true.',
  '835': 'Tectonic movement is mainly due to sea-floor spreading and the resulting plate motion.',
  };

// Key by id; collect empty-explanation ids first
const missing = [];
for (let i = 0; i < data.length; i++) {
  const q = data[i];
  if (!q.explanation || !q.explanation.trim()) missing.push({ i, id: q.id });
}

const missingIds = missing.map((m) => String(m.id));
const keyIds = Object.keys(EXPLANATIONS);
const notCovered = missingIds.filter((id) => !(id in EXPLANATIONS));
const extra = keyIds.filter((id) => !missingIds.includes(id));

if (notCovered.length) {
  console.error('No explanation authored for ids:', notCovered.join(', '));
  process.exit(1);
}
if (extra.length) {
  console.error('Explanations for ids not missing:', extra.join(', '));
  process.exit(1);
}

let added = 0;
for (const { i, id } of missing) {
  data[i].explanation = EXPLANATIONS[id];
  added++;
}

// Fix wrong answer on the Nepal earthquake question (id 834): all options are true.
const gorkha = data.find((q) => String(q.id) === '834');
if (gorkha) {
  if (gorkha.answer !== 'd') {
    const before = gorkha.answer;
    gorkha.answer = 'd';
    console.log('[fix] id 834 answer ' + before + ' -> d (all of above)');
  }
}

fs.writeFileSync(FILE, JSON.stringify(data, null, 4) + '\n', 'utf8');

const nowMissing = data.filter((q) => !q.explanation || !q.explanation.trim()).length;
console.log('[ok] geotechnical.json: added ' + added + ' explanations, remaining missing: ' + nowMissing);
console.log('[ok] gorkha answer is d: ' + String(gorkha.answer === 'd'));

// Also fix the Modern History "Nepal Prajaparishad" question: option b was
// "1990 B.S." (factually wrong) and the explanation was empty. The party was
// founded 2 June 1936 AD ~ Jestha 1993 B.S.
{
  const abs = path.resolve(__dirname, '..', 'questions', 'modern_history_of_nepal.json');
  let content = fs.readFileSync(abs, 'utf8');
  const pairs = [
    { from: '"b":  "1990 B.S."', to: '"b":  "1993 B.S."' },
    {
      from: '"explanation":  ""',
      to:
        '"explanation":  "The Nepal Prajaparishad (Praja Parishad), regarded as the first political party of Nepal, was founded on 2 June 1936 AD (= Jestha 1993 B.S.) by Dashrath Chand and Tanka Prasad Acharya."',
    },
  ];
  for (const { from, to } of pairs) {
    const idx = content.indexOf(from);
    if (idx === -1) throw new Error('NOT FOUND in modern_history_of_nepal.json: ' + from.slice(0, 60));
    content = content.slice(0, idx) + to + content.slice(idx + from.length);
  }
  fs.writeFileSync(abs, content, 'utf8');
  console.log('[ok] modern_history_of_nepal.json: fixed Prajaparishad option (1990 -> 1993 B.S.) and added explanation');
}

// Also fix the Nepal Prajaparishad date option (1990 -> 1993):
{
  const abs = path.resolve(__dirname, '..', 'questions', 'modern_history_of_nepal.json');
  let content = fs.readFileSync(abs, 'utf8');
  const idx = content.indexOf('"b":  "1990 B.S."');
  if (idx === -1) {
    console.log('[ok] modern_history_of_nepal.json: option b already fixed');
  } else {
    throw new Error('UNEXPECTED: option b still says 1990 B.S.');
  }
}