export { SnapshotTimelineController } from "./controller";
export type { TimelineController } from "./controller";

// Evidence-to-timeline linking (Milestone 2.11)
export type {
  EvidenceLikeInput,
  EvidenceTimelineLinkResolution,
  ResolvedEvidenceTimelineLink,
  NoEvidenceLink,
  UnresolvedEvidenceLink,
} from "./evidence/types";

export { EvidenceTimelineLinker, linkEvidence } from "./evidence/linker";
