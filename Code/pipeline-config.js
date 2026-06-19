// ─── Model presets ───
const LOCAL_PRESETS = ['deepseek-r1:7b','qwen2.5-coder:7b','gemma3:4b','qwen3:4b','llama3:8b','phi3:mini'];
const CLOUD_PRESETS = ['claude-sonnet-4-6','claude-opus-4-6','claude-haiku-4-5-20251001'];

const OPENAI_MODELS = ['gpt-4o','gpt-4o-mini','gpt-4-turbo','gpt-3.5-turbo'];
const GEMINI_MODELS = ['gemini-2.0-flash','gemini-2.0-pro','gemini-1.5-flash','gemini-1.5-pro'];
const AZURE_MODELS = ['gpt-4o','gpt-4o-mini','gpt-4-turbo'];

// ─── Tag Legend ───
const TAG_CODES = {
  MGFP: 'Manually_Generated_firstpass',
  AGFP: 'AI_Generated_firstpass',
  AGRM: 'AI_Generated_Review_Manualentry',
  MAAP: 'Manually_Accepted_AI_Proposal',
  MEAP: 'Manually_Edited_AI_Proposal',
  MRAP: 'Manually_Rejected_AI_Proposal'
};
const TAG_LABELS = {
  MGFP: 'Manually entered',
  AGFP: 'AI generated',
  AGRM: 'AI reviewed',
  MAAP: 'Accepted AI proposal',
  MEAP: 'Edited AI proposal',
  MRAP: 'Rejected AI proposal'
};
const TAG_COLORS = {
  MGFP: '#6366f1',
  AGFP: '#10b981',
  AGRM: '#f59e0b',
  MAAP: '#3b82f6',
  MEAP: '#8b5cf6',
  MRAP: '#ef4444'
};

// ─── Stage 1 PRD Deliverables (from Traceability_sheet) ───
// Sections: basics, users, github, functions_base, functions_names, functions_summaries, infrastructure, infrastructure_detail,
//            external_linkages, function_scoping, d5_checks, d4_diagram

const STAGE1_PRD_DELIVERABLES = [
  {
    id: 'section_basics',
    title: '📦 Product Basics',
    items: [
      { id: 'D1.1', type: 'manual', desc: 'Product name', hint: 'A new folder with this name will be created at the default location (configurable in settings).', reason_llm: 'Check if name is appropriate and makes sense.', manual: true, llm: true, skipD5: false },
      { id: 'D1.2', type: 'statement', desc: 'Lets proceed with product description.', hint: '', reason_llm: '', manual: false, llm: false, skipD5: false },
      { id: 'D1.2.1', type: 'manual', desc: 'Business Purpose of Product', hint: 'What is the core business reason for building this product?', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
      { id: 'D1.2.2', type: 'manual', desc: 'Explain for a new user what will happen on first click?', hint: 'Describe the onboarding workflow for a first-time user.', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
      { id: 'D1.2.3', type: 'statement', desc: 'Describe the types of users.', hint: '', reason_llm: '', manual: false, llm: false, skipD5: false },
      { id: 'D1.2.3.1', type: 'yesno', desc: 'Will you have a normal user who only looks at reading data from your product?', hint: 'Check if read-only normal users are needed.', reason_llm: 'D5', manual: true, llm: true, skipD5: true, followUpYes: [
        { id: 'D1.2.3.1a', type: 'manual', desc: 'Describe what read-only users will see and do.', hint: 'What pages/screens will they access?', reason_llm: 'D5', manual: true, llm: true, skipD5: true }
      ]},
      { id: 'D1.2.3.2', type: 'yesno', desc: 'Will you have a normal user who only looks at writing data to your product?', hint: 'Check if write-only normal users are needed.', reason_llm: 'D5', manual: true, llm: true, skipD5: true, followUpYes: [
        { id: 'D1.2.3.2a', type: 'manual', desc: 'Describe what write-only users will be able to create/edit.', hint: 'What data can they submit/modify?', reason_llm: 'D5', manual: true, llm: true, skipD5: true }
      ]},
      { id: 'D1.2.3.3', type: 'yesno', desc: 'Will you have a paid/premium user who accesses premium features?', hint: 'Check if paid/premium tier users are needed.', reason_llm: 'D5', manual: true, llm: true, skipD5: true, followUpYes: [
        { id: 'D1.2.3.3a', type: 'manual', desc: 'List the premium features they will access.', hint: 'What features justify the premium tier?', reason_llm: 'D5', manual: true, llm: true, skipD5: true }
      ]},
      { id: 'D1.2.3.4', type: 'manual', desc: 'How many different sub-types of paid/premium users will you need?', hint: 'Will you have paid-lite, premium-heavy, or other categories? Enter a number (0 if none).', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
      { id: 'D1.2.3.5', type: 'yesno', desc: 'Do you need an admin page for colleagues working on your product?', hint: 'Check if admin login is needed for internal team.', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
      { id: 'D1.2.3.6', type: 'yesno', desc: 'Do you need a super-admin page for your product?', hint: 'Check if super-admin login is needed.', reason_llm: 'D5', manual: true, llm: true, skipD5: true }
    ]
  },
  {
    id: 'section_github',
    title: '📁 Repository Setup',
    items: [
      { id: 'D1.3', type: 'yesno', desc: 'Do you need files to be stored on Github or only locally? A github repo with same name will be started.', hint: 'Check if Github is needed.', reason_llm: 'Setting up Github folder only', manual: true, llm: false, skipD5: false }
    ]
  },
  {
    id: 'section_functions',
    title: '⚙️ Functions',
    items: [
      { id: 'D1.4', type: 'statement', desc: 'Lets proceed with a list of functions for your product.', hint: '', reason_llm: '', manual: false, llm: false, skipD5: false },
      { id: 'D1.4.1', type: 'manual', desc: 'How many functions? Enter Integer. Imagine we are cutting the product horizontally. How many different slices can be made?', hint: 'Enter a number between 1 and 10.', reason_llm: 'D5', manual: true, llm: true, skipD5: true, isFunctionCount: true, maxCount: 10 }
    ]
  }
];

// Dynamic items that get generated based on function count
// These are templates - instances are created at runtime
const STAGE1_DYNAMIC_TEMPLATES = [
  // Function names
  { template: 'D1.4.2.{n}', type: 'manual', desc: 'Name of function {n}', hint: 'Enter a short, descriptive name.', reason_llm: 'Check if the names are proper and make sense.', manual: true, llm: true, skipD5: true, countSource: 'D1.4.1' },
  // Function summaries
  { template: 'D2.1.{n}', type: 'manual', desc: 'Function {n} summary', hint: 'Describe what this function does, its inputs, outputs, and who uses it.', reason_llm: 'D5', manual: true, llm: true, skipD5: true, countSource: 'D1.4.1' },
  // Function scoping checkboxes
  { template: 'D2.2.{n}', type: 'scoping', desc: 'For function {n}, scope its impact', hint: 'Tick all infrastructure components this function touches.', reason_llm: 'D5', manual: true, llm: true, skipD5: true, countSource: 'D1.4.1' }
];

// Infrastructure section - detailed sub-items organized by category
const STAGE1_INFRASTRUCTURE_SECTION = {
  id: 'section_infrastructure',
  title: '🖥️ Infrastructure',
  items: [
    { id: 'D1.6', type: 'statement', desc: 'What type of infrastructure will your product need? Split the infrastructure as per use cases.', hint: '', reason_llm: '', manual: false, llm: false, skipD5: false },
    // Public Webapp
    { id: 'D1.6.1.1', type: 'yesno', desc: 'Webapp for normal read-only and paid/premium users?', hint: 'Is a public-facing webapp required?', reason_llm: 'D5', manual: true, llm: true, skipD5: true, infraFollowUps: [
      { id: 'D1.6.1.2', type: 'manual', desc: 'Where will it be hosted?', hint: 'e.g. CF Pages', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
      { id: 'D1.6.1.3', type: 'manual', desc: 'What language is expected to be used?', hint: 'e.g. Hono TS', reason_llm: 'D5', manual: true, llm: true, skipD5: true }
    ]},
    // Private Webapp
    { id: 'D1.6.2.1', type: 'yesno', desc: 'Webapp for admin users and super-admins?', hint: 'Is a private/admin webapp required?', reason_llm: 'D5', manual: true, llm: true, skipD5: true, infraFollowUps: [
      { id: 'D1.6.2.2', type: 'manual', desc: 'Where will it be hosted?', hint: 'e.g. CF Pages', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
      { id: 'D1.6.2.3', type: 'manual', desc: 'What language is expected to be used?', hint: 'e.g. Hono TS', reason_llm: 'D5', manual: true, llm: true, skipD5: true }
    ]},
    // Public Android app
    { id: 'D1.6.3.1', type: 'yesno', desc: 'Android app for normal and paid/premium users?', hint: 'Is a public-facing Android app required?', reason_llm: 'D5', manual: true, llm: true, skipD5: true, infraFollowUps: [
      { id: 'D1.6.3.2', type: 'manual', desc: 'Where will it be built? Local / Github actions?', hint: 'e.g. github.yml required?', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
      { id: 'D1.6.3.3', type: 'manual', desc: 'What language is expected to be used?', hint: 'e.g. Kotlin/KMM', reason_llm: 'D5', manual: true, llm: true, skipD5: true }
    ]},
    // Private Android app
    { id: 'D1.6.4.1', type: 'yesno', desc: 'Android app for admin users and super-admins?', hint: 'Is a private/admin Android app required?', reason_llm: 'D5', manual: true, llm: true, skipD5: true, infraFollowUps: [
      { id: 'D1.6.4.2', type: 'manual', desc: 'Where will it be built? Local / Github actions?', hint: 'e.g. github.yml required?', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
      { id: 'D1.6.4.3', type: 'manual', desc: 'What language is expected to be used?', hint: 'e.g. Kotlin/KMM', reason_llm: 'D5', manual: true, llm: true, skipD5: true }
    ]},
    // Public BFF
    { id: 'D1.6.5.1', type: 'yesno', desc: 'BFF with public URL for normal and paid/premium users?', hint: 'Is a public-facing BFF required?', reason_llm: 'D5', manual: true, llm: true, skipD5: true, infraFollowUps: [
      { id: 'D1.6.5.2', type: 'manual', desc: 'Where will it be hosted?', hint: 'e.g. CF Worker', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
      { id: 'D1.6.5.3', type: 'manual', desc: 'What language is expected to be used?', hint: 'e.g. Hono TS', reason_llm: 'D5', manual: true, llm: true, skipD5: true }
    ]},
    // Private BFF
    { id: 'D1.6.6.1', type: 'yesno', desc: 'BFF with private URL? For login, external endpoints and admins/super-admins.', hint: 'Is a private BFF required?', reason_llm: 'D5', manual: true, llm: true, skipD5: true, infraFollowUps: [
      { id: 'D1.6.6.2', type: 'manual', desc: 'Where will it be hosted?', hint: 'e.g. CF Worker', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
      { id: 'D1.6.6.3', type: 'manual', desc: 'What language is expected to be used?', hint: 'e.g. Hono TS', reason_llm: 'D5', manual: true, llm: true, skipD5: true }
    ]},
    // Permanent Database
    { id: 'D1.6.7.1', type: 'yesno', desc: 'Permanent database?', hint: 'Is a permanent/persistent database required?', reason_llm: 'D5', manual: true, llm: true, skipD5: true, infraFollowUps: [
      { id: 'D1.6.7.2', type: 'manual', desc: 'Where will it be hosted?', hint: 'e.g. Supabase Cloud', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
      { id: 'D1.6.7.3', type: 'manual', desc: 'What database?', hint: 'e.g. Postgres', reason_llm: 'D5', manual: true, llm: true, skipD5: true }
    ]},
    // Permanent DB Functions
    { id: 'D1.6.8.1', type: 'yesno', desc: 'Permanent Database functions?', hint: 'Are backend functions tied to the permanent database required?', reason_llm: 'D5', manual: true, llm: true, skipD5: true, infraFollowUps: [
      { id: 'D1.6.8.2', type: 'manual', desc: 'Where will it be hosted?', hint: 'e.g. Supabase Cloud Edge Functions', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
      { id: 'D1.6.8.3', type: 'manual', desc: 'What language is expected to be used?', hint: 'e.g. Hono TS', reason_llm: 'D5', manual: true, llm: true, skipD5: true }
    ]},
    // In-memory Database
    { id: 'D1.6.9.1', type: 'yesno', desc: 'In-memory / cache database?', hint: 'Is an in-memory database like Redis/Dragonfly required?', reason_llm: 'D5', manual: true, llm: true, skipD5: true, infraFollowUps: [
      { id: 'D1.6.9.2', type: 'manual', desc: 'Where will it be hosted?', hint: 'e.g. Hetzner Coolify', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
      { id: 'D1.6.9.3', type: 'manual', desc: 'What database?', hint: 'e.g. Dragonfly / Redis', reason_llm: 'D5', manual: true, llm: true, skipD5: true }
    ]},
    // In-memory DB Functions
    { id: 'D1.6.10.1', type: 'yesno', desc: 'In-memory database functions?', hint: 'Are backend functions for in-memory database required?', reason_llm: 'D5', manual: true, llm: true, skipD5: true, infraFollowUps: [
      { id: 'D1.6.10.2', type: 'manual', desc: 'Where will it be hosted?', hint: 'e.g. Hetzner Coolify', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
      { id: 'D1.6.10.3', type: 'manual', desc: 'What language is expected to be used?', hint: 'e.g. Python/Cpp/Rust/Go', reason_llm: 'D5', manual: true, llm: true, skipD5: true }
    ]}
  ]
};

// External Linkages section
const STAGE1_EXTERNAL_SECTION = {
  id: 'section_external',
  title: '🔗 External Linkages',
  items: [
    { id: 'D3', type: 'statement', desc: 'Lets start with External linkages for external products', hint: '', reason_llm: '', manual: false, llm: false, skipD5: false },
    { id: 'D3.1', type: 'yesno', desc: 'Will the external products interface with the product?', hint: 'e.g. External SMS receiver, payment gateway like Razorpay, etc.', reason_llm: 'D5', manual: true, llm: true, skipD5: true },
    { id: 'D3.2', type: 'checkboxes', desc: 'Will it interface with BFF or Permanent Database Backend function or In-memory database backend function?', hint: 'Check all that apply.', reason_llm: 'D5', manual: true, llm: true, skipD5: true, options: ['BFF', 'Permanent Database Backend', 'In-memory Database Backend'] }
  ]
};

// External dynamic items (template-based, like functions)
const STAGE1_EXTERNAL_DYNAMIC = [
  { template: 'D3.3.{n}', type: 'manual', desc: 'External product {n} that interfaces with BFF', hint: 'Name the external product. Keep asking until all are listed.', reason_llm: 'D5', manual: true, llm: true, skipD5: true, countSource: 'D3.3.count' },
  { template: 'D3.4.{n}', type: 'manual', desc: 'External product {n} that interfaces with permanent database backend', hint: 'Name the external product.', reason_llm: 'D5', manual: true, llm: true, skipD5: true, countSource: 'D3.4.count' },
  { template: 'D3.5.{n}', type: 'manual', desc: 'External product {n} that interfaces with in-memory database backend', hint: 'Name the external product.', reason_llm: 'D5', manual: true, llm: true, skipD5: true, countSource: 'D3.5.count' }
];

// Scoping options for D2.2.x
const SCOPING_OPTIONS = [
  'Public Webapp', 'Private Webapp', 'Public BFF', 'Private BFF',
  'Permanent Database', 'In-memory Database', 'External Links'
];

// D5 Auto-Check configuration
const STAGE1_D5_CONFIG = {
  id: 'section_d5',
  title: '🔍 Auto-Generated Checks',
  items: [
    { id: 'D5', type: 'statement', desc: 'Autogenerated checks start. These will be generated by the LLM once all manual inputs are completed.', hint: '', reason_llm: '', manual: false, llm: false, skipD5: false }
  ]
};

// ─── Pipeline definition (unchanged for stages 2-9) ───
const PIPELINE = [
  {
    id: 1, name: "Product Requirements Document (PRD)", type: "Manual+LLM",
    models: ["deepseek-r1:7b", "gemma3:4b"], isGate: false,
    note: "Gemma3:4b is excellent for structuring. DeepSeek-R1 excels at reasoning over ambiguity.",
    hasPrdIntro: false,  // replaced by STAGE1_PRD_DELIVERABLES
    isStage1PRD: true,   // flag to use the new Stage 1 UI
    manualDeliverables: [],
    aiDeliverables: [],
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