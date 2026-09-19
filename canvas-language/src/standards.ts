export interface CanvasField {
  fieldKey: string;
  label: string;
  type: "string" | "longtext" | "enum" | "number" | "boolean";
  required?: boolean;
  enumValues?: string[];
}

export interface CanvasSection {
  sectionKey: string;
  name: string;
  description: string;
  cardinality: "one" | "many";
  fields: CanvasField[];
}

export interface CanvasStandard {
  codlVersion: string;
  typeIri: string;
  name: string;
  description: string;
  sections: CanvasSection[];
}

export const SOLUTION_DOMAIN_CANVAS: CanvasStandard = {
  codlVersion: "2.0",
  typeIri: "solution.domain.canvas",
  name: "Solution Domain Canvas",
  description:
    "A repository-owned canvas language for describing solution domains, architecture intent, dependencies, and team responsibilities.",
  sections: [
    {
      sectionKey: "overview",
      name: "Overview",
      description: "High-level description of the domain and its purpose.",
      cardinality: "one",
      fields: [
        { fieldKey: "name", label: "Domain name", type: "string", required: true },
        { fieldKey: "purpose", label: "Purpose", type: "longtext", required: true },
        { fieldKey: "owner", label: "Owner", type: "string", required: true },
      ],
    },
    {
      sectionKey: "business",
      name: "Business",
      description: "Business drivers, outcomes, and stakeholders.",
      cardinality: "one",
      fields: [
        { fieldKey: "outcomes", label: "Outcomes", type: "longtext", required: true },
        { fieldKey: "stakeholders", label: "Stakeholders", type: "string" },
        { fieldKey: "constraints", label: "Constraints", type: "longtext" },
      ],
    },
    {
      sectionKey: "data",
      name: "Data",
      description: "Information and data ownership responsibilities.",
      cardinality: "one",
      fields: [
        { fieldKey: "domainModel", label: "Domain model", type: "longtext", required: true },
        { fieldKey: "dataOwners", label: "Data owners", type: "string" },
        { fieldKey: "dataClasses", label: "Data classes", type: "string" },
      ],
    },
    {
      sectionKey: "applications",
      name: "Applications",
      description: "Application responsibilities and integration boundaries.",
      cardinality: "many",
      fields: [
        { fieldKey: "name", label: "Application name", type: "string", required: true },
        { fieldKey: "responsibility", label: "Responsibility", type: "longtext", required: true },
      ],
    },
    {
      sectionKey: "technology",
      name: "Technology",
      description: "Runtime platform and deployment characteristics.",
      cardinality: "one",
      fields: [
        { fieldKey: "platform", label: "Platform", type: "string", required: true },
        { fieldKey: "deploymentModel", label: "Deployment model", type: "string" },
        { fieldKey: "securityModel", label: "Security model", type: "string" },
      ],
    },
    {
      sectionKey: "decisions",
      name: "Decisions",
      description: "Architectural decisions and rationale.",
      cardinality: "many",
      fields: [
        { fieldKey: "decision", label: "Decision", type: "string", required: true },
        { fieldKey: "rationale", label: "Rationale", type: "longtext", required: true },
      ],
    },
  ],
};

export type SolutionDomainCanvas = {
  canvasType: "solution.domain.canvas";
  name: string;
  purpose: string;
  owner: string;
  business: {
    outcomes: string;
    stakeholders: string;
    constraints: string;
  };
  data: {
    domainModel: string;
    dataOwners: string;
    dataClasses: string;
  };
  applications: Array<{
    name: string;
    responsibility: string;
  }>;
  technology: {
    platform: string;
    deploymentModel: string;
    securityModel: string;
  };
  decisions: Array<{
    decision: string;
    rationale: string;
  }>;
};
