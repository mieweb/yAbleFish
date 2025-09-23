# yAbelFish Browser Client

Browser-based Monaco Editor with embedded LSP for yAbel medical documentation.

## ✅ Phase 2: Monaco Editor Integration - COMPLETE

Full-featured medical documentation editor running entirely in the browser with no backend dependencies.

## Features

### 🖥️ Monaco Editor Integration
- **VS Code-like Editor**: Full Monaco Editor with medical intelligence
- **Custom Theme**: Dark theme optimized for medical documentation
- **Language Support**: Custom yAbel language with syntax highlighting
- **Auto-completion**: Context-aware medical term suggestions

### ⚙️ Web Worker LSP
- **Browser LSP Server**: Full LSP implementation running in Web Worker
- **Real-time Processing**: Document analysis without blocking UI
- **Offline Capability**: No internet connection required after initial load
- **MessagePort Communication**: Efficient worker-to-main thread messaging

### 🏥 Medical UI Components
- **Tabbed Interface**: Switch between visit sections (Patient, Chief Complaint, HPI, etc.)
- **Live Metadata Panel**: Real-time display of extracted medical codes
- **Diagnostics Panel**: Show validation warnings and allergy conflicts
- **Section Summary**: Quick overview of codes and issues per section

### 🔍 Medical Intelligence
- **Context Awareness**: Different completions based on current section
- **Allergy Conflict Detection**: Real-time warnings for medication conflicts
- **Code Extraction**: Automatic recognition of medical terms and codes
- **Validation**: Real-time feedback on documentation quality

## Usage

1. **Start Development Server**:
   ```bash
   npm run dev
   ```

2. **Open Browser**: Navigate to `http://localhost:5173`

3. **Start Documenting**: 
   - Click tabs to switch sections
   - Type medical terms for auto-completion
   - Watch real-time code extraction in metadata panel

## Key Components

### Main Application (`src/main.ts`)
- Monaco Editor setup and configuration
- Section management and tab switching
- LSP worker communication
- Metadata panel updates

### LSP Worker (`src/worker/lsp-worker.ts`)
- Medical terminology processing
- Document validation
- Completion generation
- Allergy conflict detection

### Medical Intelligence (`src/lsp/`)
- **Terminology Database**: Medical codes and terms
- **Parser**: yAbel document structure analysis
- **Validation**: Medical logic and conflict detection

## Architecture

```
Browser Window
├── Monaco Editor (VS Code core)
│   ├── yAbel Language Support
│   ├── Dark Medical Theme
│   └── Auto-completion UI
├── Tabbed Interface
│   ├── Patient Info
│   ├── Chief Complaint
│   ├── HPI
│   ├── Allergies
│   ├── Medications
│   ├── Assessment
│   └── Plan
├── Web Worker (LSP Server)
│   ├── Medical Terminology
│   ├── Document Parser
│   ├── Completion Provider
│   └── Diagnostics Provider
└── Metadata Panel
    ├── Extracted Codes
    ├── Diagnostics
    └── Section Summary
```

## Development

- **Technology**: TypeScript + Vite + Monaco Editor
- **LSP**: Custom browser implementation
- **Styling**: CSS with VS Code-inspired theme
- **Communication**: MessagePort for worker messaging
- **Build**: Vite with Web Worker support

## Demo Content

The editor comes pre-loaded with a realistic medical encounter:
- **Patient**: William Heart, 02-14-1964
- **Chief Complaint**: Chest pain and shortness of breath
- **Conditions**: Hypertension, CHF, Atrial Fibrillation
- **Medications**: Aspirin, Lisinopril, Warfarin, Lasix
- **Allergies**: Penicillins, Sulfonamides

Perfect for testing medical intelligence features!