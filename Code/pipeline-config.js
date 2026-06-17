// ─── Pipeline configuration ───

const LOCAL_PRESETS = ['deepseek-r1:7b','qwen2.5-coder:7b','gemma3:4b','qwen3:4b','llama3:8b','phi3:mini'];
const CLOUD_PRESETS = ['claude-sonnet-4-6','claude-opus-4-6','claude-haiku-4-5-20251001'];

const OPENAI_MODELS = ['gpt-4o','gpt-4o-mini','gpt-4-turbo','gpt-3.5-turbo'];
const GEMINI_MODELS = ['gemini-2.0-flash','gemini-2.0-pro','gemini-1.5-flash','gemini-1.5-pro'];
const AZURE_MODELS = ['gpt-4o','gpt-4o-mini','gpt-4-turbo'];

// ─── Pipeline definition ───
const PIPELINE = [
  {
    id: 1, name: "Product Requirements Document (PRD)", type: "Manual+LLM",
    models: ["deepseek-r1:7b", "gemma3:4b"], isGate: false,
    note: "Gemma3:4b is excellent for structuring. DeepSeek-R1 excels at reasoning over ambiguity.",
    hasPrdIntro: true,
    manualDeliverables: [
      { id: "d1", label: "D1 — List of functions / systems", badge: "manual", placeholder: "List each major function or system the product will have.\nE.g.\n- User authentication\n- Dashboard\n- API integrations\n- Notification system" },
      { id: "d2", label: "D2 — Generic description of each function", badge: "manual", placeholder: "Write a brief description of each function listed above. What does it do? Who uses it?" },
      { id: "d3", label: "D3 — External product/system linkages", badge: "manual", placeholder: "List any external systems this product integrates with: third-party APIs, databases, auth providers, payment gateways..." }
    ],
    aiDeliverables: [
      { id: "ai1", label: "D4 — C4 Context Diagram (text representation)" },
      { id: "ai2", label: "D5 — Open questions, assumptions & ambiguities" }
    ],
    reviewType: "questions"
  },
  {
    id: 2, name: "System Requirements Specification (SRS / FRS)", type: "Manual+LLM",
    models: ["qwen2.5-coder:7b", "gemma3:4b"], isGate: false,
    note: "State machines and flowcharts are well within Qwen2.5-Coder capability. Validate invariants manually — LLMs miss negative constraints.",
    manualDeliverables: [
      { id: "d1", label: "D1 — Detailed requirements: Frontend, Android, BFF, Backend", badge: "manual", placeholder: "Write structured requirements for each layer:\nFrontend: ...\nAndroid: ...\nBFF: ...\nBackend: ..." }
    ],
    aiDeliverables: [
      { id: "ai1", label: "D2 — High-level state machines" },
      { id: "ai2", label: "D3 — Flowcharts of functions" },
      { id: "ai3", label: "D4 — C4 Container Diagram" },
      { id: "ai4", label: "D5 — System invariants document" }
    ],
    reviewType: "questions"
  },
  {
    id: 3, name: "Requirements Validation Gate", type: "Gate",
    models: ["deepseek-r1:7b", "qwen2.5-coder:7b"], isGate: true,
    note: "DeepSeek-R1:7b is the right model here — strongest reasoning. Concurrency/offline review is the hardest; expect manual iteration.",
    manualDeliverables: [
      { id: "d1", label: "D1 — Contradiction review findings", badge: "manual", placeholder: "Document any contradictions found between requirements..." },
      { id: "d2", label: "D2 — Ambiguity review findings", badge: "manual", placeholder: "List any ambiguous requirements that need clarification." },
      { id: "d3", label: "D3 — Missing requirements review", badge: "manual", placeholder: "What's missing? Edge cases, error handling, performance specs not yet defined..." },
      { id: "d4", label: "D4 — Concurrency & offline-risk review", badge: "manual", placeholder: "Document concurrency issues, race conditions, and offline sync risks identified." }
    ],
    aiDeliverables: [{ id: "ai1", label: "D5 — Approved finalized requirements document" }],
    reviewType: "gate-review",
    gateReviews: [
      { id: "r1", question: "Are all functional requirements complete and unambiguous?" },
      { id: "r2", question: "Have all contradictions been resolved between PRD and SRS?" },
      { id: "r3", question: "Are concurrency and offline risks documented and mitigated?" },
      { id: "r4", question: "Are all external system linkages accounted for in requirements?" },
      { id: "r5", question: "Is the requirements document ready to drive architecture decisions?" }
    ]
  },
  {
    id: 4, name: "Software Requirements Document (Architecture + Contracts)", type: "LLM+Manual",
    models: ["qwen2.5-coder:7b"], isGate: false,
    note: "OpenAPI YAML generation is reliable with Qwen2.5-Coder. PlantUML stencils need manual review. Define a strict YAML template to constrain output.",
    manualDeliverables: [],
    aiDeliverables: [
      { id: "ai1", label: "D1 — Data schema of functions" },
      { id: "ai2", label: "D2 — UML diagrams of functions" },
      { id: "ai3", label: "D3 — OpenAPI YAML files" },
      { id: "ai4", label: "D4 — PlantUML screen stencils" },
      { id: "ai5", label: "D5 — C4 Component Diagram" }
    ],
    reviewType: "questions"
  },
  {
    id: 5, name: "Security & Architecture Validation Gate", type: "Gate",
    models: ["deepseek-r1:7b"], isGate: true,
    note: "R1:7b handles multi-step security reasoning well. Offline sync edge cases need explicit scenario prompts.",
    manualDeliverables: [],
    aiDeliverables: [
      { id: "ai1", label: "D1 — Security review" },
      { id: "ai2", label: "D2 — Offline sync / race-condition review" },
      { id: "ai3", label: "D3 — Architecture consistency review" },
      { id: "ai4", label: "D4 — Dependency validation review" }
    ],
    reviewType: "gate-review",
    gateReviews: [
      { id: "r1", question: "Are all security risks identified and mitigated in the architecture?" },
      { id: "r2", question: "Are offline sync and race conditions handled in the design?" },
      { id: "r3", question: "Is the architecture internally consistent across all components?" },
      { id: "r4", question: "Are all dependencies validated and accounted for?" },
      { id: "r5", question: "Is the architecture ready to freeze and proceed to task generation?" }
    ]
  },
  {
    id: 6, name: "SDD + Atomic Task Generation", type: "LLM+Manual",
    models: ["qwen2.5-coder:7b", "qwen3:4b"], isGate: false,
    note: "HARDEST STAGE. Context packet schema must be defined before LLM runs. Target ≤3k tokens per context packet.",
    manualDeliverables: [
      { id: "d1", label: "D3 — Folder structure & repository layout", badge: "manual", placeholder: "Define the repository structure. E.g.:\n/src\n  /routes\n  /models\n  /services\n/tests\n/docs" }
    ],
    aiDeliverables: [
      { id: "ai1", label: "D1 — Atomic task list (1:1 to implementation)" },
      { id: "ai2", label: "D2 — Deployment / configuration manual" },
      { id: "ai3", label: "D4 — Dev & curl-based verification document" },
      { id: "ai4", label: "D5 — Dependency graph JSON + context packets" }
    ],
    reviewType: "questions"
  },
  {
    id: 7, name: "Task Validation Gate", type: "Gate",
    models: ["qwen3:4b"], isGate: true,
    note: "Max task size = 1 file + 1 function. Flag any task whose packet + generated code would exceed 6k tokens for Qwen2.5-Coder:7b.",
    manualDeliverables: [],
    aiDeliverables: [
      { id: "ai1", label: "D1 — Oversized task detection" },
      { id: "ai2", label: "D2 — Hidden dependency review" },
      { id: "ai3", label: "D3 — Task ambiguity review" },
      { id: "ai4", label: "D4 — Context-window suitability review" }
    ],
    reviewType: "gate-review",
    gateReviews: [
      { id: "r1", question: "Are all tasks atomic (max 1 file + 1 function each)?" },
      { id: "r2", question: "Are hidden dependencies between tasks identified and ordered?" },
      { id: "r3", question: "Are all tasks unambiguous and implementation-ready?" },
      { id: "r4", question: "Do all context packets fit within the 6k token budget?" },
      { id: "r5", question: "Is the approved task graph ready for code generation?" }
    ]
  },
  {
    id: 8, name: "Local Task-by-Task Code Generation", type: "LLM+Manual",
    models: ["qwen2.5-coder:7b", "llama3:8b", "deepseek-r1:7b"], isGate: false,
    note: "Run one task at a time. Feed context packet + prior implementation notes into each prompt. DeepSeek-R1 for review catches logic errors Qwen misses.",
    manualDeliverables: [
      { id: "d1", label: "D4 — Implementation notes", badge: "manual", placeholder: "Add any implementation notes, decisions made, architectural choices for this task batch..." }
    ],
    aiDeliverables: [
      { id: "ai1", label: "D1 — Generated code" },
      { id: "ai2", label: "D2 — Unit tests" },
      { id: "ai3", label: "D3 — Updated DTOs / interfaces" },
      { id: "ai4", label: "D5 — Code review findings" }
    ],
    reviewType: "questions"
  },
  {
    id: 9, name: "Integration & Deployment Validation", type: "Mixed",
    models: ["phi3:mini", "qwen3:4b"], isGate: false,
    note: "Phi3:mini is sufficient for diff-based contract validation. Keep a running mismatch log from Stage 8 to feed into this stage automatically.",
    manualDeliverables: [
      { id: "d2", label: "D2 — Contract mismatch review", badge: "manual", placeholder: "Document any contract mismatches found during integration..." },
      { id: "d3", label: "D3 — Regression verification checklist", badge: "manual", placeholder: "List all regression checks performed and their results..." },
      { id: "d4", label: "D4 — Deployment readiness review", badge: "manual", placeholder: "Confirm environment, config, secrets, and infrastructure are production-ready..." }
    ],
    aiDeliverables: [
      { id: "ai1", label: "D1 — Integration validation report" },
      { id: "ai5", label: "D5 — Release approval document" }
    ],
    reviewType: "gate-review",
    gateReviews: [
      { id: "r1", question: "Do all deployed endpoints match the OpenAPI contracts?" },
      { id: "r2", question: "Have all regression tests passed?" },
      { id: "r3", question: "Is the deployment environment correctly configured?" },
      { id: "r4", question: "Are all contract mismatches resolved or documented?" },
      { id: "r5", question: "Is the system ready for production release?" }
    ]
  }
];