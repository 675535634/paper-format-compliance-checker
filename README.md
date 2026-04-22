# Paper Format Compliance Checker

[简体中文说明](./README.zh-CN.md)

Paper Format Compliance Checker is a monorepo for checking whether a thesis or graduation paper matches a school-specific Word template.

The current project focuses on `.docx` parsing, rule-based format inspection, readable issue reports, debug logs for parser verification, and one-click high-confidence fixes with download export.

## Vibe Coding First

This project embraces `vibe coding`.

That means we optimize for:

- fast iteration over perfect upfront design
- visible progress and working software in small steps
- human-in-the-loop review for high-stakes academic formatting decisions
- practical tooling that helps answer: "did we read the document correctly?" and "can we fix the obvious problems automatically?"

In short: ship useful feedback loops early, then tighten the rules and polish.

## What It Does

- Upload and inspect `.docx` thesis files
- Parse document structure, headers, abstract, keywords, headings, and references
- Compare the parsed result against configurable formatting templates
- Show categorized issues by severity and location
- Download parser/debug logs to verify whether the document was read correctly
- Apply one-click fixes for high-confidence issues and export a corrected `.docx`
- Manage multiple school or department rule templates
- Support LAN development access and custom dev domains such as `*.nnsmxx.com`

## Tech Stack

- Frontend: React 19, Vite, Ant Design, Zustand, React Router
- Backend: Node.js, Express, TypeScript, Zod
- Document parsing: JSZip, fast-xml-parser
- Testing: Vitest

## Repository Layout

```text
.
├─ backend/    Express API, document parsing, rules, fix/export services
├─ frontend/   React app for upload, template editing, checks, and results
├─ prompts/    Prompt and workflow notes used during development
└─ PROJECT_PLAN.md
```

## Current Highlights

- structured rule editor instead of opaque rule strings
- dynamic heading levels
- `no requirement` options for many rule fields
- debug-log download for parser validation
- one-click fix and download flow
- school-template-oriented checks for abstract, keywords, cover items, required sections, and captions

## Quick Start

Requirements:

- Node.js 20+
- npm 10+

Install dependencies:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

Start the full dev environment:

```bash
npm run dev
```

This starts:

- frontend: `http://localhost:16666`
- backend: `http://localhost:16667`

LAN / custom dev access:

- frontend listens on `0.0.0.0:16666`
- backend listens on `0.0.0.0:16667`
- Vite allows hosts under `*.nnsmxx.com`

Build:

```bash
npm run build
```

Backend only:

```bash
npm --prefix backend run dev
npm --prefix backend run build
npm --prefix backend run test
```

Frontend only:

```bash
npm --prefix frontend run dev
npm --prefix frontend run build
```

## Workflow

1. Create or edit a rule template.
2. Upload a `.docx` paper.
3. Run the compliance check.
4. Review categorized issues.
5. Download the debug log if you need to confirm parser output.
6. Export a one-click fixed `.docx` for high-confidence corrections.

## Status

This project is actively evolving. The current focus is improving:

- deeper Word/WPS compatibility
- more precise school-specific formatting checks
- richer one-click fix coverage
- more reliable sample fixtures and regression tests

## Contributing

Contributions are welcome, especially if you like practical `vibe coding` with short feedback loops.

Good contributions for this project usually look like:

- improving parsing accuracy
- adding safer rule checks
- expanding fix/export coverage
- tightening tests around real thesis samples
- improving UX for rule configuration without making it harder to use

## License

No license has been added yet.
