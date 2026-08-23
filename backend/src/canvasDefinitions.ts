import fs from "node:fs";
import path from "node:path";

// Read relative to the backend's working directory (not this compiled file's location)
// so this works identically under `tsx watch` (dev) and compiled `node dist/index.js` (prod).
const dir = path.join(process.cwd(), "canvases");

const files: Record<string, string> = {
  "business-case": "business-case.json",
  "architecture-decision-record": "architecture-decision-record.json",
  "architecturally-significant-requirement": "architecturally-significant-requirement.json",
};

export interface CanvasField {
  fieldKey: string;
  label: string;
  type: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  format?: string;
  enumValues?: string[];
  referencedCanvas?: string;
  referencedCanvasName?: string;
}

export interface CanvasSection {
  sectionKey: string;
  name: string;
  description?: string;
  cardinality: "one" | "many";
  fields: CanvasField[];
}

export interface CanvasDefinition {
  codlVersion: string;
  typeIri: string;
  name: string;
  provenance?: unknown;
  sections: CanvasSection[];
}

export const canvasDefinitions: Record<string, CanvasDefinition> = Object.fromEntries(
  Object.entries(files).map(([key, filename]) => [key, JSON.parse(fs.readFileSync(path.join(dir, filename), "utf-8"))]),
);
