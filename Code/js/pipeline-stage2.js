// ─── pipeline-stage2.js ───
// Stage 2: System Requirements Specification (SRS / FRS)
//
// This stage currently uses generic rendering from pipeline-stage-common.js
// To add custom UI/render logic, define:
//   function renderStageCustom(stage, sd, content) { ... return true; }
// Return true to prevent generic rendering, false to fall through.
//
// Initial stage data is in the PIPELINE array in pipeline-config.js