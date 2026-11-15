import conditionsData from '../../../health_care/conditions_and_symptoms.json';
import medicationsData from '../../../health_care/medications_formulary.json';

export type ClinicalResource = {
  id: string;
  shortCitation: string;
  sourceOrg: string;
  summary: string;
  offlineGuideline: string;
  referenceUrl: string;
};

export type OfflineConditionEntry = {
  title: string;
  plain_summary: string;
  trigger_vitals_and_symptoms: string[];
  immediate_actions: string[];
  preferred_medication_id: string | null;
  avoid_medication_ids: string[];
  urgency: string;
  sources: Array<{ org: string; citation: string; url: string }>;
};

export type OfflineMedicationEntry = {
  name: string;
  indications: string;
  adult_dosage: string;
  warnings: string;
  source_citation: string;
  source_url: string;
  resources?: Array<{ org: string; citation: string; url: string }>;
};

export type OfflineHealthCareGuide = {
  condition: OfflineConditionEntry | null;
  medication: OfflineMedicationEntry | null;
};

/**
 * Offline-bundled spaceflight pharmacology & NASA medical reference dataset.
 * Embedded directly in frontend bundle so clinical suggestion sources remain
 * available even without internet connectivity.
 */
export const OFFLINE_CLINICAL_RESOURCES: Record<string, ClinicalResource> = {
  wotring_2015: {
    id: 'wotring_2015',
    shortCitation: 'Wotring, V. E. (2015) · FASEB J (PMC4621588)',
    sourceOrg: 'NASA JSC / The FASEB Journal',
    summary:
      '10-year ISS crew medication analysis confirming analgesics, sleep aids, and motion countermeasures as core onboard treatments.',
    offlineGuideline:
      'Offline cached finding: Pain relievers (acetaminophen/ibuprofen), sleep regulators (melatonin), and anti-emetics/vestibular meds (meclizine, ondansetron) account for top ISS crew usage, with sleep aid use ~10x higher than terrestrial baselines.',
    referenceUrl: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4621588/',
  },
  nasa_std_3001: {
    id: 'nasa_std_3001',
    shortCitation: 'NASA-STD-3001 Vol. 1 & 2 · ISS Medical Checklist',
    sourceOrg: 'NASA Space Flight Human-System Standard',
    summary:
      'Governs onboard medical kit sizing by crew duration, Convenience/Oral Pack protocols, and symptom escalation thresholds.',
    offlineGuideline:
      'Offline cached guideline: Directs Crew Medical Officers (CMO) on fever screening, fluid-shift hydration, and prioritizing first-line oral stabilization doses when resupply is constrained.',
    referenceUrl: 'https://standards.nasa.gov',
  },
  buckland_2024: {
    id: 'buckland_2024',
    shortCitation: 'Buckland et al. (2024) · npj Microgravity (PMC11266549)',
    sourceOrg: 'npj Microgravity / NASA ExMC',
    summary:
      'Validates formulary stock preservation and per-crew reserve calculation for long-duration exploration missions.',
    offlineGuideline:
      'Offline cached finding: Finite onboard formularies require balancing acute symptomatic dosing with remaining mission days so no single event exhausts multi-crew reserves.',
    referenceUrl: 'https://doi.org/10.1038/s41526-024-00414-3',
  },
  daniels_jsc: {
    id: 'daniels_jsc',
    shortCitation: 'Daniels & Williams · Br J Clin Pharmacol (PMID 37940128)',
    sourceOrg: 'NASA Johnson Space Center',
    summary:
      'Covers drug formulation selection, oral pack stability, and therapeutic fallback choices in microgravity.',
    offlineGuideline:
      'Offline cached guideline: Prefers stable solid oral dosage forms (e.g., Acetaminophen 500 mg, Ondansetron ODT) and defined therapeutic substitutes when first-line stock reaches zero.',
    referenceUrl: 'https://doi.org/10.1111/bcp.15957',
  },
  eyal_2019: {
    id: 'eyal_2019',
    shortCitation: 'Eyal et al. (2019) · Pharm Res (PMID 31152244)',
    sourceOrg: 'Pharmaceutical Research',
    summary:
      'Guides contraindication filtering and avoidance of gastric/renal strain during dehydration or nausea.',
    offlineGuideline:
      'Offline cached guideline: Avoids NSAIDs (ibuprofen) during active dehydration, orthostatic dizziness, or nausea; substitutes acetaminophen and oral rehydration.',
    referenceUrl: 'https://doi.org/10.1007/s11095-019-2649-9',
  },
  mader_2011: {
    id: 'mader_2011',
    shortCitation: 'Mader et al. (2011) · Ophthalmology (PMID 21840600)',
    sourceOrg: 'Ophthalmology / NASA JSC',
    summary:
      'Seminal NASA report documenting microgravity optic disc edema, globe flattening, and visual acuity shifts (SANS).',
    offlineGuideline:
      'Offline cached guideline: Visual acuity shifts in microgravity require ocular imaging/ultrasound and Flight Surgeon evaluation rather than routine analgesics.',
    referenceUrl: 'https://pubmed.ncbi.nlm.nih.gov/21840600/',
  },
};

export function getMedicationPurpose(medicationId: string | null | undefined): string | null {
  if (!medicationId) return null;
  const medications = medicationsData.medications as Record<string, OfflineMedicationEntry>;
  return medications[medicationId]?.indications ?? null;
}

export function getOfflineHealthCareGuide(
  conditionId: string | null | undefined,
  medicationId: string | null | undefined
): OfflineHealthCareGuide | null {
  const conditions = conditionsData.conditions as Record<string, OfflineConditionEntry>;
  const medications = medicationsData.medications as Record<string, OfflineMedicationEntry>;
  const condition = conditionId && conditions[conditionId] ? conditions[conditionId] : null;
  const medication = medicationId && medications[medicationId] ? medications[medicationId] : null;
  if (!condition && !medication) return null;
  return { condition, medication };
}

export function getClinicalResourcesForSuggestion(
  medicationId: string | null | undefined,
  hasSecondaryCoTreatments: boolean,
  conditionId?: string | null
): ClinicalResource[] {
  const guide = getOfflineHealthCareGuide(conditionId, medicationId);
  const bundled: ClinicalResource[] = [];

  if (guide?.medication) {
    const medRes = guide.medication.resources?.length
      ? guide.medication.resources.slice(0, 1)
      : [
          {
            org: 'MedlinePlus / NIH Offline Reference (health_care/)',
            citation: guide.medication.source_citation,
            url: guide.medication.source_url,
          },
        ];
    medRes.forEach((src, i) => {
      if (!bundled.some((b) => b.referenceUrl === src.url)) {
        bundled.push({
          id: `hc_med_${medicationId}_${i}`,
          shortCitation: src.citation,
          sourceOrg: src.org,
          summary: `${guide.medication!.name}: ${guide.medication!.indications}`,
          offlineGuideline: `Adult dosing: ${guide.medication!.adult_dosage} Safety: ${guide.medication!.warnings}`,
          referenceUrl: src.url,
        });
      }
    });
  }

  if (guide?.condition?.sources?.length) {
    guide.condition.sources.slice(0, 1).forEach((src, i) => {
      if (!bundled.some((b) => b.referenceUrl === src.url)) {
        bundled.push({
          id: `hc_cond_${conditionId}_${i}`,
          shortCitation: src.citation,
          sourceOrg: src.org,
          summary: guide.condition?.plain_summary ?? '',
          offlineGuideline: `Offline health_care/ guideline: ${guide.condition?.immediate_actions[0] ?? ''}`,
          referenceUrl: src.url,
        });
      }
    });
  }

  const keys: string[] =
    conditionId === 'sans_ocular_shift'
      ? ['mader_2011', 'nasa_std_3001']
      : ['wotring_2015', 'nasa_std_3001'];

  if (medicationId === 'ibuprofen_400mg' || medicationId === 'acetaminophen_500mg' || hasSecondaryCoTreatments) {
    keys.push('eyal_2019');
  } else if (medicationId) {
    keys.push('daniels_jsc');
  }

  keys.push('buckland_2024');

  const academic = keys
    .map((k) => OFFLINE_CLINICAL_RESOURCES[k])
    .filter((item): item is ClinicalResource => Boolean(item) && !bundled.some((b) => b.referenceUrl === item.referenceUrl));

  return [...bundled, ...academic].slice(0, 2);
}
