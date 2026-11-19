# myAI — E-commerce Requirements and SDLC Assistant

`myAI` is a local-first Mastra application. It uses Qwen 3.5 through an OpenAI-compatible LM Studio server, retrieves evidence from the verified e-commerce SDLC dataset, and runs two agents in sequence:

1. **E-commerce Requirements Agent** — turns a project brief into structured, traceable requirements and decision factors.
2. **E-commerce SDLC Recommendation Agent** — ranks lifecycle options and produces a project-specific workflow.

The workflow is registered as `ecommerce-requirements-then-sdlc` in Mastra Studio.

## Verified corpus

The corpus under `docs/ingested/ecommerce/` is the dataset generated for this task. It contains eight open-source e-commerce projects and official source URLs. The agent must treat it as comparative evidence only. It must not present an open-source project's public contributor workflow as a mandatory lifecycle for a new project, and it must not fill gaps with invented facts.

## Setup

Requirements: Node.js 22.13+, LM Studio, and a loaded Qwen 3.5 model.

```bash
cp .env.example .env
npm install
npm run check
npm run dev
```

Open Mastra Studio and run `ecommerce-requirements-then-sdlc` with a brief such as:

```text
Design a multi-vendor e-commerce platform with customer accounts, product search,
cart and checkout, payment-provider integration, inventory, order fulfilment,
admin operations, audit logging, and a high-availability deployment.
```

## Qwen 3.5 configuration

Set `LM_STUDIO_MODEL` to the exact identifier returned by:

```bash
curl http://127.0.0.1:1234/v1/models
```

The default is `qwen/qwen3.5-9b`; change it if your LM Studio model ID differs. The RAG processor collapses context into one first-position system message because Qwen 3.5 may reject a later system message.

## Guardrails

- Retrieved claims must cite corpus IDs and official URLs.
- Missing evidence is labeled `NEEDS-VALIDATION`.
- SDLC scores are heuristic decision-support scores, not measured probabilities.
- Legal, regulatory, payment, privacy, security, and production-readiness decisions require authorized human approval.
- The app does not use the dataset to invent vendor practices or guarantee compliance.
