# kc-orchestrator - Nutzungsanleitung

## Übersicht

`kc-orchestrator` ist ein CLI-Tool zur Automatisierung von Task-Ausführung in Multi-Projekt-Repositories mit verschiedenen AI-Providern.

## Verfügbare Befehle

### 1. `init` - Projekt initialisieren

Initialisiert kc-orchestrator im aktuellen Verzeichnis.

```bash
# Basis-Initialisierung
kc-orchestrator init

# Mit ausführlicher Ausgabe
kc-orchestrator init --verbose

# Minimales Setup (ohne Beispiel-Dateien)
kc-orchestrator init --minimal

# Erzwinge Neu-Initialisierung
kc-orchestrator init --force
```

**Was wird erstellt:**
- `.kc-orchestrator/` Verzeichnisstruktur
- `IMPLEMENTATION_GUIDE.json` - Task-Definitionen
- `NEXTSESSION_PROMPT.md` - Session-Dokumentation
- Konfigurationsdateien

### 2. `status` - Task-Status anzeigen

Zeigt den aktuellen Status aller Tasks aus `IMPLEMENTATION_GUIDE.json`.

```bash
# Status aller Tasks anzeigen
kc-orchestrator status

# Als JSON ausgeben
kc-orchestrator status --json

# Nach Phase filtern
kc-orchestrator status --phase "Phase 1"

# Nach Status filtern
kc-orchestrator status --status completed

# Kombinierte Filter
kc-orchestrator status --phase "Phase 1" --status todo
```

**Ausgabe zeigt:**
- Gesamtstatistik (Total, Completed, In Progress, Failed, Todo)
- Liste der Tasks gruppiert nach Status
- Fortschrittsbalken

### 3. `execute` - Tasks ausführen

Führt Tasks aus `IMPLEMENTATION_GUIDE.json` aus.

```bash
# Alle Tasks ausführen
kc-orchestrator execute

# Spezifischen Task ausführen
kc-orchestrator execute --task T1.1

# Alle Tasks einer Phase ausführen
kc-orchestrator execute --phase "Phase 1"

# Mit spezifischem Provider
kc-orchestrator execute --provider codex

# Mit Anpassungen
kc-orchestrator execute --max-retries 5 --timeout 600000 --verbose
```

**Optionen:**
- `--task <id>` - Führt nur einen spezifischen Task aus
- `--phase <name>` - Führt alle Tasks einer Phase aus
- `--provider <name>` - Bevorzugter AI-Provider
- `--max-retries <number>` - Maximale Wiederholungen (Standard: 3)
- `--timeout <ms>` - Timeout pro Task (Standard: 300000ms = 5min)
- `--non-interactive` - Keine interaktiven Prompts

### 4. `continue` / `resume` - Ausführung fortsetzen

Setzt eine unterbrochene Task-Ausführung vom letzten Checkpoint fort.

```bash
# Vom letzten Checkpoint fortsetzen
kc-orchestrator continue

# Von spezifischem Checkpoint fortsetzen
kc-orchestrator continue --checkpoint .kc-orchestrator/checkpoints/checkpoint-123.json

# Mit Anpassungen
kc-orchestrator continue --max-retries 5 --verbose
```

**Funktionalität:**
- Findet automatisch den neuesten Checkpoint
- Setzt die Ausführung genau dort fort, wo sie unterbrochen wurde
- Unterstützt alle Optionen von `execute`

### 5. `improve` - Continuous Improvement Analyse

Analysiert vergangene Ausführungen und generiert Verbesserungsvorschläge.

```bash
# Letzte 5 Runs analysieren
kc-orchestrator improve

# Spezifische Anzahl analysieren
kc-orchestrator improve --last 10

# Für bestimmtes Projekt
kc-orchestrator improve --project my-project

# Dry-Run (ohne Dateien zu ändern)
kc-orchestrator improve --dry-run

# Ohne Agent Lightning (nur Zusammenfassung)
kc-orchestrator improve --skip-agent-lightning

# Mit ausführlicher Ausgabe
kc-orchestrator improve --verbose
```

**Was passiert:**
1. Liest Telemetrie-Daten aus `.kc-orchestrator/runs/`
2. Generiert Zusammenfassungsbericht
3. Analysiert mit Agent Lightning (native Implementierung)
4. Generiert Verbesserungsaufgaben
5. Aktualisiert `IMPLEMENTATION_GUIDE.json` mit neuen Tasks

### 3. Globale Optionen

Diese Optionen können mit jedem Befehl verwendet werden:

```bash
--verbose              # Ausführliche Ausgabe
--non-interactive      # Keine interaktiven Prompts
--auto-answer <answers> # Automatische Antworten für Interview-Modus
--dry-run              # Dry-Run ohne Änderungen
--config <path>        # Custom Config-Datei
--project <name>       # Projekt spezifizieren
--provider <name>      # AI-Provider spezifizieren
```

## Workflow

### Schritt 1: Projekt initialisieren

```bash
cd /srv/koelschcrew/bookingportal
kc-orchestrator init --verbose
```

### Schritt 2: Tasks in IMPLEMENTATION_GUIDE.json definieren

Die `IMPLEMENTATION_GUIDE.json` enthält alle Tasks, die ausgeführt werden sollen:

```json
{
  "version": "1.0",
  "project": "bookingportal",
  "phases": [
    {
      "name": "Feature Development",
      "tasks": [
        {
          "id": "T1",
          "title": "Implementiere Feature X",
          "description": "...",
          "status": "todo",
          "effort": "medium"
        }
      ]
    }
  ]
}
```

### Schritt 3: Status prüfen

```bash
# Aktuellen Status anzeigen
kc-orchestrator status

# Nur Todo-Tasks anzeigen
kc-orchestrator status --status todo
```

### Schritt 4: Tasks ausführen

```bash
# Alle Tasks ausführen
kc-orchestrator execute --verbose

# Oder nur einen Task
kc-orchestrator execute --task T1

# Oder eine ganze Phase
kc-orchestrator execute --phase "Feature Development"
```

### Schritt 5: Bei Unterbrechung fortsetzen

```bash
# Wenn die Ausführung unterbrochen wurde, einfach fortsetzen
kc-orchestrator continue
```

### Schritt 6: Continuous Improvement nutzen

```bash
# Nach einigen Ausführungen analysieren
kc-orchestrator improve --last 10
```

## Verfügbare Befehle (Aktualisiert)

Das Tool hat jetzt **alle wichtigen Befehle**:
- ✅ `status` - Task-Status anzeigen
- ✅ `continue` / `resume` - Ausführung fortsetzen
- ✅ `execute` - Tasks ausführen

## Programmatische Nutzung (Optional)

Die Engine kann auch programmatisch verwendet werden:

```javascript
const { TaskExecutionEngine } = require('kc-orchestrator/src/engine');

const engine = new TaskExecutionEngine({
  projectPath: process.cwd(),
  guidePath: './IMPLEMENTATION_GUIDE.json',
  verbose: true
});

// Alle Tasks ausführen
const result = await engine.executeAllTasks();
console.log(result);
```

## Hilfe bekommen

```bash
# Allgemeine Hilfe
kc-orchestrator --help

# Hilfe für spezifischen Befehl
kc-orchestrator improve --help
kc-orchestrator init --help

# Version anzeigen
kc-orchestrator --version
```

## Beispiel-Workflow

```bash
# 1. Projekt initialisieren
cd /srv/koelschcrew/bookingportal
kc-orchestrator init --verbose

# 2. IMPLEMENTATION_GUIDE.json bearbeiten (Tasks hinzufügen)
# ... manuell oder mit Editor ...

# 3. Nach einiger Zeit: Verbesserungen analysieren
kc-orchestrator improve --last 5 --project bookingportal

# 4. Neue Tasks werden automatisch zu IMPLEMENTATION_GUIDE.json hinzugefügt
```

## Troubleshooting

### "IMPLEMENTATION_GUIDE.json not found"
```bash
# Projekt initialisieren
kc-orchestrator init
```

### "No checkpoints found" (bei continue)
```bash
# Zuerst execute ausführen, um Checkpoints zu erstellen
kc-orchestrator execute
```

### Tasks werden nicht ausgeführt
- Prüfen Sie den Status: `kc-orchestrator status`
- Stellen Sie sicher, dass Tasks den Status `todo` oder `in_progress` haben
- Prüfen Sie die Logs mit `--verbose`

### Provider-Fehler
- Prüfen Sie, ob die Provider-CLIs installiert sind
- Verwenden Sie `--provider` um einen spezifischen Provider zu wählen
- Die Engine verwendet automatisch Fallback-Mechanismen
