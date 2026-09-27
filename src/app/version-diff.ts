import type { Claim, ClaimVersion, Feature } from './models'

export type DiffStatus = 'added' | 'removed' | 'modified'

export interface FieldChange {
  field: string
  label: string
  before: string
  after: string
}

export interface SetChange {
  added: string[]
  removed: string[]
}

export interface ClaimChange {
  id: string
  number: number
  status: DiffStatus
  fields: FieldChange[]
}

export interface FeatureChange {
  id: string
  label: string
  claimNumber: number
  status: DiffStatus
  fields: FieldChange[]
  references: SetChange
  supports: SetChange
}

export interface VersionComparison {
  baseId: string
  baseName: string
  targetId: string
  targetName: string
  generatedAt: string
  claims: ClaimChange[]
  features: FeatureChange[]
  summary: {
    claimsAdded: number
    claimsRemoved: number
    claimsModified: number
    featuresAdded: number
    featuresRemoved: number
    featuresModified: number
  }
  hasChanges: boolean
}

const emptySet = (): SetChange => ({ added: [], removed: [] })

function diffSet(beforeIds: string[], afterIds: string[], labelOf: (id: string) => string): SetChange {
  return {
    added: afterIds.filter(id => !beforeIds.includes(id)).map(labelOf),
    removed: beforeIds.filter(id => !afterIds.includes(id)).map(labelOf)
  }
}

function pushField(fields: FieldChange[], field: string, label: string, before: string, after: string): void {
  if (before !== after) fields.push({ field, label, before, after })
}

function sortByNumber<T extends { number?: number; claimNumber?: number; label?: string }>(items: T[]): T[] {
  return items.sort((x, y) => {
    const nx = x.number ?? x.claimNumber ?? 0
    const ny = y.number ?? y.claimNumber ?? 0
    return nx - ny || (x.label ?? '').localeCompare(y.label ?? '', 'zh-CN')
  })
}

/**
 * 比较两个版本快照，输出完整变更清单。
 * 只收录有变化的条目：新增、移除、改写；未变化的权利要求与特征不出现。
 * 说明书依据按段落编号（section）列出增删，编号无法解析时回退到原始 id。
 */
export function compareVersions(
  base: ClaimVersion,
  target: ClaimVersion,
  paragraphLabel: (id: string) => string = id => id
): VersionComparison {
  const baseClaims = new Map(base.claims.map(claim => [claim.id, claim]))
  const targetClaims = new Map(target.claims.map(claim => [claim.id, claim]))
  const baseFeatures = new Map(base.features.map(feature => [feature.id, feature]))
  const targetFeatures = new Map(target.features.map(feature => [feature.id, feature]))

  const claimNumberOf = (claims: Map<string, Claim>) => (id: string): number => claims.get(id)?.number ?? 0
  const featureLabelOf = (features: Map<string, Feature>) => (id: string): string => features.get(id)?.label ?? id

  const claimChanges: ClaimChange[] = []
  for (const id of new Set([...baseClaims.keys(), ...targetClaims.keys()])) {
    const before = baseClaims.get(id)
    const after = targetClaims.get(id)
    if (before && after) {
      const fields: FieldChange[] = []
      pushField(fields, 'number', '编号', String(before.number), String(after.number))
      pushField(fields, 'title', '名称', before.title, after.title)
      pushField(fields, 'independent', '权利要求类型', before.independent ? '独立权利要求' : '从属权利要求', after.independent ? '独立权利要求' : '从属权利要求')
      pushField(fields, 'text', '正文', before.text, after.text)
      if (fields.length) claimChanges.push({ id, number: after.number, status: 'modified', fields })
    } else if (after) {
      claimChanges.push({
        id, number: after.number, status: 'added',
        fields: [
          { field: 'number', label: '编号', before: '', after: String(after.number) },
          { field: 'title', label: '名称', before: '', after: after.title },
          { field: 'independent', label: '权利要求类型', before: '', after: after.independent ? '独立权利要求' : '从属权利要求' },
          { field: 'text', label: '正文', before: '', after: after.text }
        ]
      })
    } else if (before) {
      claimChanges.push({
        id, number: before.number, status: 'removed',
        fields: [
          { field: 'number', label: '编号', before: String(before.number), after: '' },
          { field: 'title', label: '名称', before: before.title, after: '' },
          { field: 'independent', label: '权利要求类型', before: before.independent ? '独立权利要求' : '从属权利要求', after: '' },
          { field: 'text', label: '正文', before: before.text, after: '' }
        ]
      })
    }
  }

  const featureChanges: FeatureChange[] = []
  for (const id of new Set([...baseFeatures.keys(), ...targetFeatures.keys()])) {
    const before = baseFeatures.get(id)
    const after = targetFeatures.get(id)
    if (before && after) {
      const fields: FieldChange[] = []
      pushField(fields, 'label', '特征名称', before.label, after.label)
      pushField(fields, 'text', '特征正文', before.text, after.text)
      pushField(fields, 'parent', '父级特征',
        before.parentId ? featureLabelOf(baseFeatures)(before.parentId) : '顶层特征',
        after.parentId ? featureLabelOf(targetFeatures)(after.parentId) : '顶层特征')
      pushField(fields, 'claim', '所属权利要求',
        `权利要求 ${claimNumberOf(baseClaims)(before.claimId)}`,
        `权利要求 ${claimNumberOf(targetClaims)(after.claimId)}`)
      pushField(fields, 'ownerRole', '负责角色', roleLabel(before.ownerRole), roleLabel(after.ownerRole))
      const references = diffSet(before.referenceIds, after.referenceIds, featureLabelOf(targetFeatures))
      const supports = diffSet(before.supportIds, after.supportIds, paragraphLabel)
      if (fields.length || references.added.length || references.removed.length || supports.added.length || supports.removed.length) {
        featureChanges.push({
          id, label: after.label, claimNumber: claimNumberOf(targetClaims)(after.claimId),
          status: 'modified', fields, references, supports
        })
      }
    } else if (after) {
      featureChanges.push({
        id, label: after.label, claimNumber: claimNumberOf(targetClaims)(after.claimId),
        status: 'added',
        fields: [
          { field: 'label', label: '特征名称', before: '', after: after.label },
          { field: 'text', label: '特征正文', before: '', after: after.text },
          { field: 'parent', label: '父级特征', before: '', after: after.parentId ? featureLabelOf(targetFeatures)(after.parentId) : '顶层特征' }
        ],
        references: { added: after.referenceIds.map(featureLabelOf(targetFeatures)), removed: [] },
        supports: { added: after.supportIds.map(paragraphLabel), removed: [] }
      })
    } else if (before) {
      featureChanges.push({
        id, label: before.label, claimNumber: claimNumberOf(baseClaims)(before.claimId),
        status: 'removed',
        fields: [
          { field: 'label', label: '特征名称', before: before.label, after: '' },
          { field: 'text', label: '特征正文', before: before.text, after: '' },
          { field: 'parent', label: '父级特征', before: before.parentId ? featureLabelOf(baseFeatures)(before.parentId) : '顶层特征', after: '' }
        ],
        references: { added: [], removed: before.referenceIds.map(featureLabelOf(baseFeatures)) },
        supports: { added: [], removed: before.supportIds.map(paragraphLabel) }
      })
    }
  }

  const claims = sortByNumber(claimChanges)
  const features = sortByNumber(featureChanges)
  const count = (items: Array<{ status: DiffStatus }>, status: DiffStatus) => items.filter(item => item.status === status).length
  return {
    baseId: base.id, baseName: base.name, targetId: target.id, targetName: target.name,
    generatedAt: new Date().toISOString(), claims, features,
    summary: {
      claimsAdded: count(claims, 'added'), claimsRemoved: count(claims, 'removed'), claimsModified: count(claims, 'modified'),
      featuresAdded: count(features, 'added'), featuresRemoved: count(features, 'removed'), featuresModified: count(features, 'modified')
    },
    hasChanges: claims.length + features.length > 0
  }
}

function roleLabel(role: Feature['ownerRole']): string {
  return ({ author: '代理人', examiner: '审查员', viewer: '观察者' })[role]
}
