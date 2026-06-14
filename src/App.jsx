import React, { useState, useRef, useEffect } from "react";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import "./App.scss";
import { MathfieldElement } from 'mathlive';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Register MathfieldElement for React to recognize it
if (typeof customElements !== 'undefined' && !customElements.get('math-field')) {
  customElements.define('math-field', MathfieldElement);
}

export default function App() {
  const [editor, setEditor] = useState(null);
  const editorRef = useRef(null);
  const [domReady, setDomReady] = useState(false);
  const [showMathEditor, setShowMathEditor] = useState(false);
  const mathfieldRef    = useRef(null);
  // The keyboard-dock div lives INSIDE the modal — keyboard renders here
  const keyboardDockRef = useRef(null);

  const [mathExpression, setMathExpression] = useState("");
  const [mathPreview, setMathPreview]       = useState("");
  const [editingComponent, setEditingComponent] = useState(null);
  const [isMathFieldReady, setIsMathFieldReady] = useState(false);
  const mathFieldInitializedRef = useRef(false);
  const pendingExpressionRef    = useRef("");

  // ── KaTeX helper ────────────────────────────────────────────────────────────
  const renderKatexHtml = (expression) => {
    if (!expression || expression.trim() === '') return ' ';
    try {
      return katex.renderToString(expression, { throwOnError: false, displayMode: false });
    } catch (e) {
      return `<div class="math-error" style="color:#ff5a5f">Invalid Expression</div>`;
    }
  };

  // 1. Wait for DOM elements
  useEffect(() => {
    const checkDomReady = () => {
      const blocksEl      = document.getElementById('blocks');
      const stylesPanelEl = document.getElementById('styles-panel');
      const layersPanelEl = document.getElementById('layers-panel');
      const canvasEl      = document.getElementById('gjs');
      if (blocksEl && stylesPanelEl && layersPanelEl && canvasEl) setDomReady(true);
    };
    checkDomReady();
    const observer = new MutationObserver(checkDomReady);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // 2. Body scroll lock when math editor is open
  useEffect(() => {
    document.body.classList.toggle('math-editor-open', showMathEditor);
  }, [showMathEditor]);

  // 3. Initialize GrapesJS
  useEffect(() => {
    if (!editorRef.current && domReady) initializeEditor();
  }, [domReady]);

  // 4. Global Alt+M shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'm' || e.key === 'M') && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const active = document.activeElement;
        const isEditable = active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable;
        if (!isEditable && !showMathEditor) {
          e.preventDefault();
          handleOpenMathEditor();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showMathEditor]);

  // 5. Initialize MathLive when modal opens — keyboard docked INSIDE modal
  useEffect(() => {
    const mathFieldEl  = mathfieldRef.current;
    const keyboardDock = keyboardDockRef.current;

    if (!showMathEditor || !mathFieldEl) {
      setIsMathFieldReady(false);
      mathFieldInitializedRef.current = false;
      return;
    }

    const initializeMathfield = () => {
      try {
        // ── KEY FIX: redirect MathLive's virtual keyboard into our dock div
        // This keeps the keyboard INSIDE the modal, underneath the blur overlay.
        if (keyboardDock) {
          mathFieldEl.virtualKeyboardTarget = keyboardDock;
        }

        // Prevent MathLive from appending keyboard to document.body
        window.mathVirtualKeyboard && (window.mathVirtualKeyboard.container = keyboardDock || undefined);

        const initialExpression = pendingExpressionRef.current || '';
        mathFieldEl.value = initialExpression;
        setMathExpression(initialExpression);
        mathFieldEl.focus();

        setTimeout(() => {
          if (mathFieldEl.executeCommand) {
            mathFieldEl.executeCommand('showVirtualKeyboard');
          }
          if (typeof mathFieldEl.virtualKeyboardMode !== 'undefined') {
            mathFieldEl.virtualKeyboardMode = 'manual';
          }
          setIsMathFieldReady(true);
          mathFieldInitializedRef.current = true;
        }, 120);
      } catch (error) {
        console.error("Error initializing math field:", error);
      }
    };

    const initTimer = setTimeout(initializeMathfield, 160);

    const handleInput = (e) => setMathExpression(e.target.value || '');
    mathFieldEl.addEventListener('input', handleInput);

    return () => {
      clearTimeout(initTimer);
      mathFieldEl.removeEventListener('input', handleInput);
      if (mathFieldEl.executeCommand) {
        mathFieldEl.executeCommand('hideVirtualKeyboard');
      }
      if (typeof mathFieldEl.virtualKeyboardMode !== 'undefined') {
        mathFieldEl.virtualKeyboardMode = 'auto';
      }
      // Reset keyboard target back to default
      mathFieldEl.virtualKeyboardTarget = undefined;
      pendingExpressionRef.current = "";
    };
  }, [showMathEditor]);

  // 6. Update KaTeX preview
  useEffect(() => {
    setMathPreview(renderKatexHtml(mathExpression));
  }, [mathExpression]);

  // ── GrapesJS init ───────────────────────────────────────────────────────────
  const initializeEditor = () => {
    const editorInstance = grapesjs.init({
      container: '#gjs',
      fromElement: false,
      height: '100%',
      width: '100%',
      storageManager: false,
      allowScripts: true,
      blockManager: { appendTo: "#blocks" },
      panels: {
        defaults: [
          { id: "panel-devices", el: ".panel_devices", buttons: [] },
          { id: "panel-traits",  el: "#traits-panel",  buttons: [] },
          { id: "panel-styles",  el: "#styles-panel",  buttons: [] },
          { id: "panel-layers",  el: "#layers-panel",  buttons: [] },
        ],
      },
      layerManager:    { appendTo: "#layers-panel" },
      selectorManager: { appendTo: "#styles-panel" },
      styleManager: {
        appendTo: "#styles-panel",
        sectors: [
          { name: 'Dimension',   buildProps: ['width','height','min-width','min-height','max-width','max-height','margin','padding'] },
          { name: 'Typography',  buildProps: ['font-family','font-size','font-weight','letter-spacing','color','line-height','text-align','text-shadow'] },
          { name: 'Decorations', buildProps: ['background-color','background','border','border-radius','box-shadow','opacity'] },
        ],
      },
      canvas: {
        styles: [
          "./grapes.css",
          "https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css",
        ],
      },
    });

    // ── ENTER-KEY BUG FIX ─────────────────────────────────────────────────────
    // Intercept Enter in the RTE iframe and insert <br> instead of splitting
    editorInstance.on('rte:enable', (view, rte) => {
      const doc = rte && rte.doc ? rte.doc : null;
      if (!doc) return;

      const handleRteKeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          const sel = doc.getSelection();
          if (sel && sel.rangeCount) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const br = doc.createElement('br');
            range.insertNode(br);
            range.setStartAfter(br);
            range.setEndAfter(br);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      };
      doc.addEventListener('keydown', handleRteKeydown, true);
      rte.__canvex_keydown = handleRteKeydown;
    });

    editorInstance.on('rte:disable', (view, rte) => {
      if (!rte) return;
      const doc = rte.doc;
      if (doc && rte.__canvex_keydown) {
        doc.removeEventListener('keydown', rte.__canvex_keydown, true);
        delete rte.__canvex_keydown;
      }
    });

    // ── MATH COMPONENT TYPE ────────────────────────────────────────────────────
    editorInstance.DomComponents.addType("math", {
      model: {
        defaults: {
          tagName: "span",
          name: "Math Expression",
          draggable: true, droppable: false, editable: false,
          components: renderKatexHtml(" "),
          style: { fontSize: "18px", color: "#000", padding: "1px", display: "inline-block", cursor: "pointer" },
          traits: [
            'id', 'title',
            { type: 'text',   label: 'Math Expression (LaTeX)', name: 'math-expression', changeProp: 1, value: "" },
            { type: 'select', label: 'Font Size', name: 'style-font-size', changeProp: 1,
              options: [
                { value: '14px', name: 'Small' },
                { value: '18px', name: 'Normal' },
                { value: '22px', name: 'Medium' },
                { value: '26px', name: 'Large' },
                { value: '32px', name: 'Extra Large' },
              ],
            },
          ],
        },
        init() { this.on('change:math-expression', this.updateMath); this.updateMath(); },
        updateMath() { this.components(renderKatexHtml(this.get('math-expression'))); },
      },
      view: {
        events: {
          dblclick: function () {
            const expression = this.model.get('math-expression') || "";
            pendingExpressionRef.current = expression;
            setEditingComponent(this.model);
            setShowMathEditor(true);
          },
        },
      },
    });

    // ── TEXT COMPONENT TYPE ────────────────────────────────────────────────────
    editorInstance.DomComponents.addType("text", {
      model: {
        defaults: {
          tagName: "div", draggable: true, droppable: true, editable: true,
          components: "Edit text here",
          style: { fontSize: "16px", color: "#333", minHeight: "24px", whiteSpace: "pre-wrap" },
          traits: [
            'id', 'title',
            { type: 'select', label: 'Font Size', name: 'style-font-size',
              options: [
                { value: '12px', name: 'Small' },
                { value: '16px', name: 'Normal' },
                { value: '20px', name: 'Medium' },
                { value: '24px', name: 'Large' },
                { value: '32px', name: 'Extra Large' },
              ],
            },
          ],
        },
      },
    });

    // ── BLOCKS ──────────────────────────────────────────────────────────────────
    editorInstance.BlockManager.add("text-block", {
      label: "Text", content: { type: "text" }, category: "Components",
    });
    // editorInstance.BlockManager.add("math-block", { label: "Math (LaTeX)", content: { type: "math" }, category: "Components" });

    // Load saved content
    const savedContent = JSON.parse(localStorage.getItem("canvex_page"));
    if (savedContent && savedContent.components) {
      editorInstance.setComponents(savedContent.components);
    }

    editorRef.current = editorInstance;
    setEditor(editorInstance);
  };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSave = () => {
    const data = editor.getProjectData();
    localStorage.setItem("canvex_page", JSON.stringify(data));
    alert("Saved to Canvex Studio!");
  };

  const handleExport = () => {
    const data = editorRef.current.getProjectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "canvex-design.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => document.getElementById("jsonInput").click();

  const handleImportFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        editorRef.current.loadProjectData(JSON.parse(e.target.result));
        alert("Design loaded successfully!");
      } catch (err) {
        alert("Failed to load: Invalid JSON format.");
        console.error("Import error:", err);
      }
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  const handleOpenMathEditor = () => {
    setMathExpression(""); setMathPreview(""); setEditingComponent(null);
    pendingExpressionRef.current = "";
    setShowMathEditor(true);
  };

  const handleCloseMathEditor = () => {
    setShowMathEditor(false); setEditingComponent(null);
    setMathExpression(""); setMathPreview("");
    setIsMathFieldReady(false);
    mathFieldInitializedRef.current = false;
    pendingExpressionRef.current = "";
  };

  const handleMathInput = (evt) => {
    if (evt && evt.target) setMathExpression(evt.target.value || '');
  };

  const handleKeyDown = (e) => {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(e.key)) e.stopPropagation();
    if (e.key === 'Escape') handleCloseMathEditor();
  };

  const handleAddMathExpression = () => {
    if (!editorRef.current) { handleCloseMathEditor(); return; }
    const expression = mathExpression.trim();

    if (editingComponent) {
      if (editingComponent.get('type') === 'math') editingComponent.set('math-expression', expression);
    } else {
      if (!expression) { handleCloseMathEditor(); return; }
      const htmlContent   = renderKatexHtml(expression);
      const mathComponent = editorRef.current.DomComponents.addComponent({
        type: 'math', 'math-expression': expression, components: htmlContent,
        style: { fontSize: "18px", color: "#000", padding: "1px", display: "inline-block", cursor: "pointer" },
      });
      const selected = editorRef.current.getSelected();
      if (selected && selected.get('droppable')) selected.append(mathComponent);
      else editorRef.current.getWrapper().append(mathComponent);
    }
    handleCloseMathEditor();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="canvex-studio">
      {/* ── Top Bar ── */}
      <div className="top-bar">
        <span className="brand-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.9"/>
            <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
          </svg>
          Canvex Studio
        </span>
        <div className="top-bar-actions">
          <button id="btn-save"   onClick={handleSave}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Save
          </button>
          <button id="btn-export" onClick={handleExport}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
          <button id="btn-import" onClick={handleImport}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import
          </button>
          <button id="btn-mathtype" className="btn-accent" onClick={handleOpenMathEditor}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h16"/></svg>
            ∑ MathType
            <kbd>Alt+M</kbd>
          </button>
        </div>
      </div>

      <input type="file" id="jsonInput" accept="application/json" style={{ display: "none" }} onChange={handleImportFile} />

      {/* ── Editor Layout ── */}
      <div className="editor-layout">
        {/* Left panel */}
        <div className="left-panel">
          <div className="panel-section">
            <div id="blocks"><div className="panel-header">Components</div></div>
          </div>
          <div className="panel-section">
            <div id="layers-panel"><div className="panel-header">Layers</div></div>
          </div>
        </div>

        {/* Canvas */}
        <div className="canvas-container">
          <div id="gjs" className="gjs-canvas" style={{ width: "100%", height: "100%", maxHeight: "90vh" }} />

          {/* ── Math Editor Modal ── */}
          {showMathEditor && (
            <div className="math-editor-overlay" onClick={(e) => e.target === e.currentTarget && handleCloseMathEditor()}>
              <div className="math-editor-container">

                {/* Header */}
                <div className="math-editor-header">
                  <h3>{editingComponent ? "Edit Expression" : "New Math Expression"}</h3>
                  <button className="close-button" id="btn-close-math" onClick={handleCloseMathEditor} aria-label="Close">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                {/* MathLive field */}
                <div className="mathfield-container">
                  <label className="field-label">LaTeX Input</label>
                  <math-field
                    ref={mathfieldRef}
                    onInput={handleMathInput}
                    onKeyDown={handleKeyDown}
                    style={{
                      width: '100%',
                      fontSize: '20px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: '#1e2335',
                      color: '#e8eaf0',
                      border: '1px solid #2a3050',
                      display: 'block',
                    }}
                  />
                </div>

                {/* KaTeX preview */}
                <div className="math-preview">
                  <label className="field-label">Preview</label>
                  <div
                    id="math-preview"
                    dangerouslySetInnerHTML={{ __html: mathPreview }}
                    style={{ minHeight: '52px' }}
                  />
                </div>

                {/* ── Keyboard dock — MathLive renders its virtual keyboard here ──
                    Position: inside the modal, below the content, above the footer.
                    z-index of the dock is higher than the overlay so it is always
                    visible and never escapes behind the blur backdrop.              */}
                <div
                  id="keyboard-dock"
                  ref={keyboardDockRef}
                  className="keyboard-dock"
                />

                {/* Footer */}
                <div className="math-editor-footer">
                  <button className="cancel-button" id="btn-cancel-math" onClick={handleCloseMathEditor}>Cancel</button>
                  <button className="add-button"    id="btn-add-math"    onClick={handleAddMathExpression}>
                    {editingComponent ? 'Update Expression' : 'Add to Canvas'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="right-panel">
          <div id="styles-panel" style={{ textAlign: "left", padding: "5px" }}>
            <div className="panel-header">Styles</div>
          </div>
        </div>
      </div>
    </div>
  );
}