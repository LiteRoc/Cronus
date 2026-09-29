import type { EquipmentTemplate } from '@/types';

export const canReadTemplates = (role?: string) => role === 'admin' || role === 'technician';
export const isTemplateArchived = (template: Partial<EquipmentTemplate>) =>
  (template.status != null && (typeof template.status !== 'string' || template.status === 'Archived')) ||
  [template.deletedAt, template.deletedBy, template.archivedAt, template.archivedBy, template.isArchived]
    .some(value => value !== undefined && value !== null);

// The editor loads a complete DTO. Only business fields belong in a mutation.
const editable = ['manufacturer', 'model', 'description', 'equipmentClass', 'di',
  'fdaProductCode', 'gmdnTerm', 'gmdnDefinition', 'brandName', 'catalogNumber', 'versionOrModel',
  'mrSafetyStatus', 'issuingAgency', 'classificationName', 'regulationNumber', 'panel',
  'recordStatus', 'prescriptionRequired', 'otc', 'submissionNumber', 'manufacturerDUNS',
  'alarm', 'hipaa', 'autoAddPmProcedure', 'requirePmPlan', 'excludeFromLifecycle', 'excludeFromAEM',
  'manufacturerRecommendedPMFrequency', 'isTestEquipment', 'eolYears', 'lineItemPricing',
  'lifecycleDefaults', 'benchmark', 'kind', 'subType'] as const;

export function templateBusinessPayload(template: Partial<EquipmentTemplate>) {
  return Object.fromEntries(editable.filter(key => Object.prototype.hasOwnProperty.call(template, key))
    .map(key => [key, template[key]]));
}
