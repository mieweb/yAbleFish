# yAbelFish

DNS: yabelfish.com





# yAbelFish

A Language Server Protocol (LSP) server designed for medical documentation using the yAbel format. yAbel is a lightweight, human-readable text format that combines the best of **Markdown** and **YAML** - but without being strict about either. This flexible approach allows clinicians to write natural, flowing medical notes while still maintaining enough structure for software to parse and analyze.

## 📝 What is yAbel?

yAbel is designed to be:
- **Markdown-inspired** for natural text flow and readability
- **YAML-influenced** for structured data when needed  
- **Forgiving and flexible** - not strict about syntax rules
- **Clinician-friendly** - prioritizes ease of writing over rigid formatting
- **Machine-parseable** - structured enough for intelligent software processing

Think of it as "Markdown with hints of YAML" where you can write naturally but add structure when it helps.

See: [yCard](https://github.com/mieweb/yCard) for more details on the yAbel format.
There are several standards coming including:
- yVisit
- yMedication
- yAllergy
- yProblem
- yImmunization
- yOrder
- yCard can be used for other domains as well but also yPatient, yPractitioner, yOrganization, etc.

yAbelFish is a web-based editor that leverages the Monaco Editor (the core of VS Code) and runs entirely in the browser using a Web Worker to host the LSP server. This means no backend is required, and all processing happens locally in the user's browser.

## Examples

[EXAMPLE.md](EXAMPLE.md)


## 🚀 Features

### Core Architecture
- **Monaco Editor** (VS Code editor core) for rich text editing
- **LSP Server in Web Worker** - no backend required, everything runs in the browser
- **Notebook-like UI** where each visit section = a cell (Chief Complaint, HPI, Allergies, Medications, Assessment, Plan)
- **Real-time Language Intelligence** with completions, hover info, diagnostics, and code actions

### Medical Intelligence
- **Smart Completions** - Context-aware suggestions for medical terms based on current section
- **Code Normalization** - Right-click to normalize terms to standard codes (RxNorm, SNOMED-CT)
- **Inlay Hints** - Unobtrusive display of medical codes after recognized terms
- **Allergy Conflict Detection** - Real-time warnings for medication conflicts with patient allergies
- **Terminology Integration** - Built-in medical terminology with RxNorm and SNOMED-CT codes

### User Experience
- **Tabbed Interface** - Switch between different sections of the medical encounter
- **Live Metadata Panel** - Shows extracted codes and diagnostics in real-time
- **VS Code-like Theme** - Familiar dark theme optimized for medical documentation
- **Instant Feedback** - No page reloads, all processing happens in real-time

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Browser["🌐 Browser Window"]
        subgraph Tabs["📋 Navigation Tabs"]
            ChiefComplaint["Chief Complaint"]
            HPI["History of Present Illness"]
            Allergies["Allergies"]
            Medications["Medications"]
            Assessment["Assessment"]
            Plan["Plan"]
        end
        
        subgraph MainContainer["Main Container"]
            subgraph EditorArea["📝 Editor Area"]
                MonacoEditor["Monaco Editor<br/>💼 monaco-languageclient<br/>🏥 models: ehr://visit/..."]
                UIFeatures["🔧 LSP Features<br/>• Diagnostics<br/>• Hover info<br/>• Code actions<br/>• Inlay hints"]
            end
            
            subgraph WorkerThread["⚙️ Web Worker"]
                LSPServer["LSP Server<br/>🔌 vscode-languageserver/browser"]
                Terminology["📚 Medical Terminology<br/>• RxNorm codes<br/>• SNOMED-CT codes<br/>• Allergy database"]
            end
            
            subgraph MetadataPanel["📊 Live Metadata Panel"]
                ExtractedCodes["📋 Extracted Codes"]
                Diagnostics["⚠️ Diagnostics"]
                Conflicts["🚨 Allergy Conflicts"]
            end
        end
    end
    
    %% Communication flows
    MonacoEditor <-->|"🔄 JSON-RPC<br/>MessagePort"| LSPServer
    LSPServer --> Terminology
    MonacoEditor --> UIFeatures
    LSPServer -->|"📡 Real-time Updates"| ExtractedCodes
    LSPServer -->|"📡 Real-time Updates"| Diagnostics
    LSPServer -->|"📡 Real-time Updates"| Conflicts
    
    %% Tab interactions
    ChiefComplaint -.->|"Switch Context"| MonacoEditor
    HPI -.->|"Switch Context"| MonacoEditor
    Allergies -.->|"Switch Context"| MonacoEditor
    Medications -.->|"Switch Context"| MonacoEditor
    Assessment -.->|"Switch Context"| MonacoEditor
    Plan -.->|"Switch Context"| MonacoEditor
    
    %% Styling with VS Code theme colors
    classDef editor fill:#2d2d30,stroke:#0078d4,stroke-width:2px,color:#fff
    classDef worker fill:#252526,stroke:#0078d4,stroke-width:2px,color:#fff
    classDef terminology fill:#1e1e1e,stroke:#569cd6,stroke-width:2px,color:#fff
    classDef metadata fill:#2d2d30,stroke:#00ff00,stroke-width:2px,color:#fff
    classDef diagnostics fill:#2d2d30,stroke:#ff8c00,stroke-width:2px,color:#fff
    classDef conflicts fill:#2d2d30,stroke:#f14c4c,stroke-width:2px,color:#fff
    classDef tabs fill:#3c3c3c,stroke:#cccccc,stroke-width:1px,color:#fff
    
    class MonacoEditor,UIFeatures editor
    class LSPServer worker
    class Terminology terminology
    class ExtractedCodes metadata
    class Diagnostics diagnostics
    class Conflicts conflicts
    class ChiefComplaint,HPI,Allergies,Medications,Assessment,Plan tabs
```

## 📦 Technology Stack

- **Frontend**: TypeScript + Vite
- **Editor**: Monaco Editor (VS Code core)
- **LSP**: monaco-languageclient + vscode-languageserver/browser
- **Communication**: MessagePort/MessageChannel for worker communication
- **Styling**: CSS (VS Code-inspired dark theme)

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open browser** and navigate to `http://localhost:5173`

4. **Start documenting** - Click on different tabs to switch between sections and start typing medical terms

## 🔧 Project Structure

```
babelEditor/
├── src/
│   ├── main.ts           # Main application entry point
│   ├── lsp.worker.ts     # LSP server running in Web Worker
│   └── types.ts          # TypeScript type definitions (future)
├── index.html            # Main HTML page with UI
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite build configuration
└── README.md            # This file
```

## 🎯 Usage Examples

### Basic Medical Documentation

1. **Chief Complaint**: Type "ear pain" - the system recognizes it and offers SNOMED codes
2. **HPI**: Add "2 days, fever" - get completions for symptoms and timeline
3. **Allergies**: Enter "penicillin" - system tracks this for conflict detection
4. **Medications**: Start typing "amoxicillin" - get warning about penicillin allergy conflict
5. **Assessment**: Document findings with ICD-10/SNOMED suggestions
6. **Plan**: Add treatment plans with medication suggestions

### Advanced Features

- **Code Actions**: Right-click any recognized term → "Normalize to SNOMED..." to add standard codes
- **Hover Information**: Hover over medical terms to see codes and definitions
- **Inlay Hints**: Medical codes appear automatically after recognized terms
- **Real-time Validation**: Allergy conflicts and other issues show immediately

## 📋 Available Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

## 🔮 Medical Terminology

### Current Coverage
- **RxNorm**: Common medications with codes
- **SNOMED-CT**: Conditions, symptoms, and clinical findings
- **Allergy Terms**: Common allergens with conflict detection

### Examples
- `amoxicillin 500 mg capsule` → `RxNorm:308191`
- `acute otitis media` → `SNOMED:65363002`
- `ear pain` → `SNOMED:16001004`
- `penicillin` → `RxNorm:7980` (allergy)

## 🛠️ Development

### Adding New Terminology
Edit `src/lsp.worker.ts` and add terms to the appropriate arrays:
- `rxnormCodes` - Medications
- `snomedCodes` - Conditions and symptoms  
- `allergyTerms` - Known allergens

### Adding New Rules
Implement validation logic in the `validateTextDocument` function in `src/lsp.worker.ts`.

### Customizing UI
Modify styles in `index.html` or add new sections by updating the tab structure and model creation.

## 🚧 Roadmap

### Near Term
- [ ] Tree-sitter WASM for robust parsing
- [ ] LocalStorage persistence for extracted codes
- [ ] Export to standard medical formats (HL7 FHIR)
- [ ] More comprehensive medical terminology

### Future Enhancements
- [ ] Voice-to-text integration
- [ ] Template-based documentation
- [ ] Integration with external medical APIs
- [ ] Multi-provider encounter support
- [ ] PDF/print formatting

## 🐛 Known Issues

- TypeScript compilation warnings (non-blocking)
- Limited medical terminology (proof-of-concept scope)
- No persistence between sessions (localStorage planned)

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For questions or issues, please create an issue in the repository or contact the development team.

---

**Built with ❤️ for healthcare professionals**
