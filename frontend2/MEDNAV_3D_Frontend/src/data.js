// DEMONSTRATION DATA ONLY. Replace with your validated backend/API responses.
export const CREW = [
  { id: 'A01', name: 'Alex Morgan', role: 'Flight Engineer', mission: 'ISS-72', status: 'Active', heartRate: 72, sleep: 6.8, bp: '118 / 76', spo2: 98, temperature: 36.7, stress: 24, coverage: 78, symptom: 'Mild headache' },
  { id: 'A02', name: 'Taylor Brooks', role: 'Mission Specialist', mission: 'ISS-72', status: 'Active', heartRate: 68, sleep: 7.3, bp: '116 / 74', spo2: 99, temperature: 36.6, stress: 18, coverage: 91, symptom: 'None reported' },
  { id: 'A03', name: 'Jordan Lee', role: 'Science Officer', mission: 'ISS-72', status: 'Active', heartRate: 78, sleep: 6.2, bp: '122 / 80', spo2: 97, temperature: 36.9, stress: 39, coverage: 69, symptom: 'Sleep disturbance' },
  { id: 'A04', name: 'Casey Reed', role: 'Medical Officer', mission: 'ISS-72', status: 'Active', heartRate: 70, sleep: 7.1, bp: '119 / 77', spo2: 98, temperature: 36.5, stress: 21, coverage: 86, symptom: 'None reported' },
];

export const INVENTORY = [
  { name: 'Medication (Pain Relief)', quantity: 24, status: 'Available', tone: 'green' },
  { name: 'Diagnostic Kit (Blood)', quantity: 0, status: 'Out of stock', tone: 'yellow' },
  { name: 'Wearable Sensor (HR/O₂)', quantity: 1, status: 'Needs service', tone: 'pink' },
];

// This is educational context, not clinical interpretation or individual diagnosis.
export const PARTS = {
  brain: { label: 'Brain', system: 'Neurological', description: 'Coordinates cognition, movement, sensory processing and autonomic function.', metric: 'Cognitive check', value: 'Not connected', note: 'No live neurological sensor linked.' },
  brainstem: { label: 'Brainstem', system: 'Neurological', description: 'Connects the brain to the spinal cord and supports vital automatic functions.', metric: 'Neuro assessment', value: 'Not connected' },
  cerebellum: { label: 'Cerebellum', system: 'Neurological', description: 'Contributes to balance and coordination.', metric: 'Motion testing', value: 'Not connected' },
  heart: { label: 'Heart', system: 'Cardiovascular', description: 'Pumps blood through systemic and pulmonary circulation.', metric: 'Heart rate', value: (p) => `${p.heartRate} bpm`, note: 'Synthetic heart-rate sample; not a live wearable feed.' },
  lung_l: { label: 'Left Lung', system: 'Respiratory', description: 'Performs gas exchange between air and blood.', metric: 'SpO₂', value: (p) => `${p.spo2}%` },
  lung_r: { label: 'Right Lung', system: 'Respiratory', description: 'Performs gas exchange between air and blood.', metric: 'SpO₂', value: (p) => `${p.spo2}%` },
  lungs: { label: 'Lungs', system: 'Respiratory', description: 'Take in oxygen and remove carbon dioxide.', metric: 'SpO₂', value: (p) => `${p.spo2}%` },
  liver: { label: 'Liver', system: 'Digestive', description: 'Supports metabolism, processing of nutrients and production of bile.', metric: 'Liver panel', value: 'Not connected' },
  kidney_l: { label: 'Left Kidney', system: 'Renal', description: 'Filters blood and helps regulate fluid and electrolyte balance.', metric: 'Renal test', value: 'Not connected' },
  kidney_r: { label: 'Right Kidney', system: 'Renal', description: 'Filters blood and helps regulate fluid and electrolyte balance.', metric: 'Renal test', value: 'Not connected' },
  stomach: { label: 'Stomach', system: 'Digestive', description: 'Helps break down and move food through the digestive tract.', metric: 'Digestive report', value: 'Not connected' },
  intestine_small: { label: 'Small Intestine', system: 'Digestive', description: 'Absorbs nutrients during digestion.', metric: 'Digestive report', value: 'Not connected' },
  spine: { label: 'Spine', system: 'Skeletal', description: 'Provides structural support and protects the spinal cord.', metric: 'Posture sensor', value: 'Not connected' },
  spine_cervical: { label: 'Cervical Spine', system: 'Skeletal', description: 'Supports the head and protects the upper spinal cord.', metric: 'Posture sensor', value: 'Not connected' },
  spine_thoracic: { label: 'Thoracic Spine', system: 'Skeletal', description: 'Supports the thorax and connects with the ribs.', metric: 'Posture sensor', value: 'Not connected' },
  spine_lumbar: { label: 'Lumbar Spine', system: 'Skeletal', description: 'Supports body weight and enables lower back movement.', metric: 'Posture sensor', value: 'Not connected' },
  arm_l: { label: 'Left Arm', system: 'Musculoskeletal', description: 'Contains bones and muscles for upper-limb motion.', metric: 'Movement sensor', value: 'Not connected' },
  arm_r: { label: 'Right Arm', system: 'Musculoskeletal', description: 'Contains bones and muscles for upper-limb motion.', metric: 'Movement sensor', value: 'Not connected' },
  leg_l: { label: 'Left Leg', system: 'Musculoskeletal', description: 'Supports locomotion, stability and weight bearing.', metric: 'Movement sensor', value: 'Not connected' },
  leg_r: { label: 'Right Leg', system: 'Musculoskeletal', description: 'Supports locomotion, stability and weight bearing.', metric: 'Movement sensor', value: 'Not connected' },
  head: { label: 'Head', system: 'Anatomical region', description: 'Contains the brain and major sensory structures.', metric: 'Headache report', value: (p) => p.symptom },
  chest: { label: 'Chest', system: 'Anatomical region', description: 'Protects the heart, lungs and major blood vessels.', metric: 'Heart rate', value: (p) => `${p.heartRate} bpm` },
  pelvis: { label: 'Pelvis', system: 'Musculoskeletal', description: 'Supports the trunk and connects it to the lower limbs.', metric: 'Mobility sensor', value: 'Not connected' },
  skin: { label: 'Skin', system: 'Integumentary', description: 'The outer protective barrier of the body.', metric: 'Temperature', value: (p) => `${p.temperature.toFixed(1)} °C` },
};

export const FREQUENT_PARTS = ['brain', 'heart', 'lung_l', 'lung_r', 'liver', 'kidney_l', 'stomach', 'spine'];

export function formatPartKey(key) {
  if (!key) return 'Human Body';
  if (PARTS[key]) return PARTS[key].label;
  return key.replace(/_/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bL\b$/, '(L)').replace(/\bR\b$/, '(R)');
}
export function partInfo(key, crew) {
  const info = PARTS[key] || {
    label: formatPartKey(key), system: 'Anatomical structure',
    description: 'Selectable 3D anatomical structure. Connect a validated dataset or device feed to show structure-specific measurements.',
    metric: 'Sensor data', value: 'Not connected',
  };
  return { ...info, value: typeof info.value === 'function' ? info.value(crew) : info.value };
}
