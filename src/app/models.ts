export type Role = 'author' | 'examiner' | 'viewer'

export interface Claim {
  id: string
  number: number
  title: string
  text: string
  independent: boolean
}

export interface Paragraph {
  id: string
  section: string
  text: string
}

export interface Feature {
  id: string
  claimId: string
  label: string
  text: string
  parentId: string | null
  referenceIds: string[]
  supportIds: string[]
  ownerRole: Role
}

export interface Annotation {
  id: string
  featureId: string
  authorRole: Role
  authorName: string
  text: string
  updatedAt: string
}

export interface OrphanMapping {
  id: string
  featureLabel: string
  paragraphId: string
  reason: string
}

export interface ClaimVersion {
  id: string
  name: string
  createdAt: string
  claims: Claim[]
  features: Feature[]
}

export type VersionSnapshot = Pick<ClaimVersion, 'claims' | 'features'>

export type ChangeKind = 'added' | 'removed' | 'modified'

export interface FieldChange {
  field: string
  before: string
  after: string
}

export interface ListChange {
  field: string
  added: string[]
  removed: string[]
}

export interface ChangeEntry {
  kind: ChangeKind
  id: string
  label: string
  scope: string
  detail: string
  fields: FieldChange[]
  lists: ListChange[]
}

export interface DiffSummary {
  added: number
  removed: number
  modified: number
}

export interface VersionDiff {
  baseName: string
  targetName: string
  generatedAt: string
  claimChanges: ChangeEntry[]
  featureChanges: ChangeEntry[]
  summary: { claims: DiffSummary; features: DiffSummary }
  identical: boolean
}

export interface Position {
  tab: string
  claimId: string
  featureId: string | null
  scrollY: number
}

export interface WorkbenchState {
  claims: Claim[]
  paragraphs: Paragraph[]
  features: Feature[]
  annotations: Annotation[]
  orphanMappings: OrphanMapping[]
  versions: ClaimVersion[]
  role: Role
  selectedClaimId: string
  selectedFeatureId: string | null
  activeTab: string
  currentUserRole: Role
}

export interface ValidationIssue {
  id: string
  severity: 'error' | 'warning'
  type: 'cycle' | 'missing-support' | 'orphan-mapping' | 'empty-feature'
  featureId?: string
  title: string
  detail: string
}
