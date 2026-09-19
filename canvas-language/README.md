# Solution Canvas Language

This project is the repository-owned foundation for describing architecture solutions in a machine-readable canvas language. The goal is to make solution domains understandable for humans, AI assistants, and other delivery teams without depending on a single diagraming tool.

## Goals

- Describe solution domains as structured canvas code
- Allow a visual image to be interpreted into the canvas language
- Let a developer ask the repository for architecture explanations using the canvas model
- Generate a diagram from the canvas code when a human asks for one
- Use a standard MCP server to fetch the canvas standard instead of inventing a local custom format
- Keep the project in the shared repository as a dedicated solution project

## Use cases covered

### Use case 1: convert an image into canvas code
The repository includes a parser function in `src/index.ts` that turns a simple image description into a canvas structure. This is the first step toward a future OCR or LLM-based image-to-canvas pipeline.

### Use case 2: answer repository questions using canvas code
The exported `describeCanvas` and `generateMermaid` functions turn the code into natural-language summaries and diagram syntax.

### Use case 3: MCP server for standard retrieval
The project exposes a minimal MCP-tool interface with `getCanvasStandard`, so an MCP client can retrieve the canonical canvas definition without creating a new ad hoc format.

### Use case 4: visual editor in VS Code
The architecture is designed to live in a JSON-first editor workflow. This project is structured so it can be opened and edited directly in VS Code, with a browser or lightweight visualizer layered on top later.

### Use case 5: repo-owned project in the common repository
The entire project lives under this repository as a dedicated subproject in `canvas-language/`.

## Canonical standard

The canonical canvas definition is under `src/standards.ts` and mirrors the repository's CoDL-style schema with sections, fields, and required metadata.

## Example

See the example under `examples/solution-domain.example.json`.

## Next steps

1. Add real image-to-canvas ingestion via OCR or model-assisted extraction.
2. Add a simple web visualizer for editing JSON in the browser.
3. Connect the MCP server to the standard catalogue in the common repo.
4. Expand the standard with domain-specific sections for security, integration, data ownership, and platform operations.
