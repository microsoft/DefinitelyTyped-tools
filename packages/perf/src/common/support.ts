import { Document, PackageBenchmarkSummary } from './types';

export function supportsMemoryUsage(doc: Document<PackageBenchmarkSummary>) {
  return doc.version >= 4;
}
