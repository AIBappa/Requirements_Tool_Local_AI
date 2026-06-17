# Pipeline Author — LLM-Assisted Software Development

A local desktop tool for authoring software requirements using LLMs. Supports local models via Ollama and cloud APIs (Anthropic, OpenAI, Gemini, Azure).

## Getting Started

1. **Open PowerShell** in the `Code\` directory:
   ```
   cd Code
   ```

2. **Start a local HTTP server**:
   ```
   python -m http.server 8080
   ```
   > If you don't have Python, install it from [python.org](https://python.org).  
   > On macOS/Linux, use `python3` instead of `python`.

3. **Open the app** in your browser:
   ```
   http://localhost:8080/
   ```

4. **Configure your AI provider**:  
   Click **"Connection Setup"** in the sidebar and choose one of:
   - **Local (Ollama)** — for running LLMs on your machine
   - **Anthropic** — Claude models via API key
   - **OpenAI** — GPT models via API key
   - **Gemini** — Google Gemini models via API key
   - **Azure** — Azure OpenAI via API key and endpoint

## Files

| File | Purpose |
|---|---|
| `index.html` | Main application page |
| `app.js` | Application logic |
| `pipeline-config.js` | Pipeline stages and model configuration |
| `styles.css` | Styling |

## Requirements

- **Python 3.x** — for the local HTTP server
- **Ollama** — required only for local mode ([ollama.com](https://ollama.com))
- **API keys** — required only for cloud providers (Anthropic / OpenAI / Gemini / Azure)

## Pipeline Stages

The tool guides you through 9 stages of software requirements authoring:

1. Product Requirements Document (PRD)
2. System Requirements Specification (SRS / FRS)
3. Requirements Validation Gate
4. Software Requirements Document (Architecture + Contracts)
5. Security & Architecture Validation Gate
6. SDD + Atomic Task Generation
7. Task Validation Gate
8. Local Task-by-Task Code Generation
9. Integration & Deployment Validation