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
  const mathfieldRef = useRef(null);
  const keyboardContainerRef = useRef(null);

  // State for the math expression and preview
  const [mathExpression, setMathExpression] = useState("");
  const [mathPreview, setMathPreview] = useState("");
  // Stores the GrapesJS component being edited, or null for a new component
  const [editingComponent, setEditingComponent] = useState(null); 
  const [isMathFieldReady, setIsMathFieldReady] = useState(false);
  const mathFieldInitializedRef = useRef(false);
  // CRITICAL: Ref to hold the expression to be loaded into MathLive upon opening
  const pendingExpressionRef = useRef(""); 

  // Helper function to render KaTeX safely
  const renderKatexHtml = (expression) => {
    if (!expression || expression.trim() === '') return ' '; // Return space for empty math
    try {
      return katex.renderToString(expression, {
        throwOnError: false,
        displayMode: false 
      });
    } catch (e) {
      return `<div class="math-error" style="color: red;">Invalid Expression</div>`;
    }
  };

  // 1. Check if DOM elements are ready
  useEffect(() => {
    const checkDomReady = () => {
      const blocksEl = document.getElementById('blocks');
      const stylesPanelEl = document.getElementById('styles-panel');
    //   const traitsPanelEl = document.getElementById('traits-panel');
      const layersPanelEl = document.getElementById('layers-panel');
      const canvasEl = document.getElementById('gjs');
      
      if (blocksEl && stylesPanelEl && layersPanelEl && canvasEl) {
        setDomReady(true);
      }
    };

    checkDomReady();
    const observer = new MutationObserver(checkDomReady);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // FIX: Toggle the body class to prevent background scrolling when the modal is open
  useEffect(() => {
    if (showMathEditor) {
      document.body.classList.add('math-editor-open');
    } else {
      document.body.classList.remove('math-editor-open');
    }
  }, [showMathEditor]);

  // 2. Initialize GrapesJS editor
  useEffect(() => {
    if (!editorRef.current && domReady) {
      initializeEditor();
    }
  }, [domReady]);

  // 3. Global keyboard shortcut for 'Alt + M'
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Alt + M (case-insensitive)
      if (e.key === 'm' || e.key === 'M') {
        if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          const activeElement = document.activeElement;
          const isEditable = activeElement.tagName === 'INPUT' || 
                             activeElement.tagName === 'TEXTAREA' || 
                             activeElement.isContentEditable;
          
          if (!isEditable && !showMathEditor) { 
            e.preventDefault();
            handleOpenMathEditor(); // Open for new component
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showMathEditor]);

  // 4. Initialize MathLive mathfield when editor opens
  useEffect(() => {
    const mathFieldEl = mathfieldRef.current;
    
    if (!showMathEditor || !mathFieldEl) {
      setIsMathFieldReady(false);
      mathFieldInitializedRef.current = false;
      return;
    }
    
    // Tab Key Handler Function
    const handleMathFieldKeyDown = (e) => {
      if (e.key === 'Tab') {
        e.preventDefault(); 
        e.stopPropagation(); 
        mathFieldEl.insert('\\hspace{2.5em}'); 
      }
    };
    
    // Initialize math field
    const initializeMathfield = () => {
      try {
        // Set up keyboard target
        if (keyboardContainerRef.current) {
          mathFieldEl.virtualKeyboardTarget = keyboardContainerRef.current;
        }
        
        // CRITICAL: Set the value using the pending expression ref
        const initialExpression = pendingExpressionRef.current || '';
        mathFieldEl.value = initialExpression;
        setMathExpression(initialExpression); // Also update React state
        
        // Focus the field
        mathFieldEl.focus();
        
        // Show virtual keyboard and set ready state
        setTimeout(() => {
          if (mathFieldEl.executeCommand) {
            mathFieldEl.executeCommand('showVirtualKeyboard');
            mathFieldEl.virtualKeyboardMode = 'on';
          }
          setIsMathFieldReady(true);
          mathFieldInitializedRef.current = true;
        }, 100);
        
      } catch (error) {
        console.error("Error initializing math field:", error);
      }
    };
    
    // Initialize with a delay to ensure DOM is fully ready
    const initTimer = setTimeout(initializeMathfield, 150);
    
    // Attach keydown listener for MathLive specific functionality
    mathFieldEl.addEventListener('keydown', handleMathFieldKeyDown);
    
    // Listen for input changes
    const handleInput = (e) => {
      setMathExpression(e.target.value || '');
    };
    mathFieldEl.addEventListener('input', handleInput);
    
    // Cleanup
    return () => {
      clearTimeout(initTimer);
      mathFieldEl.removeEventListener('keydown', handleMathFieldKeyDown);
      mathFieldEl.removeEventListener('input', handleInput);
      
      // Hide virtual keyboard on close
      if (!showMathEditor && mathFieldEl.executeCommand) {
        mathFieldEl.executeCommand('hideVirtualKeyboard');
        mathFieldEl.virtualKeyboardMode = 'auto';
      }
      pendingExpressionRef.current = ""; // Clear ref
    };
  }, [showMathEditor]);

  // 5. Update preview when math expression changes
  useEffect(() => {
    const html = renderKatexHtml(mathExpression);
    setMathPreview(html);
  }, [mathExpression]);

  const initializeEditor = () => {
    const editorInstance = grapesjs.init({
      container: '#gjs',
      fromElement: false,
      height: '100%',
      width: '100%',
      storageManager: false,
      style: `background-color:white`,
      allowScripts: true,
      blockManager: {
        appendTo: "#blocks"
      },
      panels: {
        defaults: [
          { id: "panel-devices", el: ".panel_devices", buttons: [] },
          { id: "panel-traits", el: "#traits-panel", buttons: [] },
          { id: "panel-styles", el: "#styles-panel", buttons: [] },
          { id: "panel-layers", el: "#layers-panel", buttons: [] },
        ],
      },
      layerManager: { appendTo: "#layers-panel" },
      selectorManager: { appendTo: "#styles-panel" },
      styleManager: {
        appendTo: "#styles-panel",
        sectors: [
          { name: 'Dimension', buildProps: ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'margin', 'padding'] },
          { name: 'Typography', buildProps: ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'color', 'line-height', 'text-align', 'text-shadow'] },
          { name: 'Decorations', buildProps: ['background-color', 'background', 'border', 'border-radius', 'box-shadow', 'opacity'] },
        ],
      },
      canvas: {
        styles: [
            "./grapes.css",
            "https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" 
        ],
      }
    });

    // --- MATH COMPONENT TYPE (Opens editor on dblclick) ---
    editorInstance.DomComponents.addType("math", {
      model: {
        defaults: {
          tagName: "span",
          name: "Math Expression",
          draggable: true,
          droppable: false,
          editable: false,
          components: renderKatexHtml(" "), 
          style: { 
            fontSize: "18px", 
            color: "#000",
            padding: "1px",
            display: "inline-block",
            cursor: "pointer" 
          },
          traits: [
            'id', 
            'title',
            {
              type: 'text',
              label: 'Math Expression (LaTeX)',
              name: 'math-expression',
              changeProp: 1,
              value: ""
            },
            {
              type: 'select',
              label: 'Font Size',
              name: 'style-font-size',
              changeProp: 1,
              options: [
                { value: '14px', name: 'Small' },
                { value: '18px', name: 'Normal' },
                { value: '22px', name: 'Medium' },
                { value: '26px', name: 'Large' },
                { value: '32px', name: 'Extra Large' }
              ]
            }
          ]
        },
        init() {
          this.on('change:math-expression', this.updateMath);
          // Run once on load to render initial content
          this.updateMath(); 
        },
        updateMath() {
          const expression = this.get('math-expression');
          const html = renderKatexHtml(expression);
          this.components(html); 
        }
      },
      view: {
        events: {
          // Double-click opens the Math Editor
          dblclick: function() {
            const expression = this.model.get('math-expression') || "";
            
            // CRITICAL: Store the expression in the ref BEFORE opening the editor
            pendingExpressionRef.current = expression;
            setEditingComponent(this.model);
            
            // Open the editor
            setShowMathEditor(true);
          }
        }
      }
    });

    // --- TEXT COMPONENT TYPE (Allows default inline editing) ---
    editorInstance.DomComponents.addType("text", {
      model: {
        defaults: {
          tagName: "div", 
          draggable: true, 
          droppable: true, 
          editable: true,
          components: "Edit text",
          style: { fontSize: "16px", color: "#000" },
          traits: ['id', 'title', {
            type: 'select', 
            label: 'Font Size', 
            name: 'style-font-size',
            options: [{ value: '12px', name: 'Small' }, { value: '16px', name: 'Normal' }, { value: '20px', name: 'Medium' }, { value: '24px', name: 'Large' }, { value: '32px', name: 'Extra Large' }]
          }]
        }
      }
    });



    // --- BLOCKS ---
    editorInstance.BlockManager.add("text-block", { label: "Text", content: { type: "text" }, category: "Components" });
    // editorInstance.BlockManager.add("math-block", { label: "Math (LaTeX)", content: { type: "math" }, category: "Components" });

    // Load saved content
    const savedContent = JSON.parse(localStorage.getItem("MyPage"));
    if (savedContent && savedContent.components) {
      editorInstance.setComponents(savedContent.components);
    }

    editorRef.current = editorInstance;
    setEditor(editorInstance);
  };

  const handleSave = () => {
    const data = editor.getProjectData();
    localStorage.setItem("MyPage", JSON.stringify(data));
    alert("Saved Successfully!");
  };

  const handleExport = () => {
    const data = editorRef.current.getProjectData();
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "full-design.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    document.getElementById("jsonInput").click();
  };

  const handleImportFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        editorRef.current.loadProjectData(jsonData);
        alert("Full design loaded successfully!");
      } catch (error) {
        alert("Failed to load project: Invalid JSON format.");
        console.error("Import error:", error);
      }
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  const handleOpenMathEditor = () => {
    // Reset for NEW expression (called by Alt+M or 'MathType' button)
    setMathExpression("");
    setMathPreview("");
    setEditingComponent(null);
    pendingExpressionRef.current = ""; // Clear ref for a new expression
    
    // Open editor
    setShowMathEditor(true);
  };

  const handleCloseMathEditor = () => {
    setShowMathEditor(false);
    setEditingComponent(null);
    setMathExpression("");
    setMathPreview("");
    setIsMathFieldReady(false);
    mathFieldInitializedRef.current = false;
    pendingExpressionRef.current = "";
  };

  const handleMathInput = (evt) => {
    if (evt && evt.target) {
      const value = evt.target.value || '';
      setMathExpression(value);
    }
  };

  const handleKeyDown = (e) => {
    // Prevent keyboard events in mathfield from leaking to GrapesJS
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
      e.stopPropagation();
    }
    if (e.key === 'Escape') {
      handleCloseMathEditor();
    }
  };

  const handleAddMathExpression = () => {
    if (!editorRef.current) {
      handleCloseMathEditor();
      return;
    }
    
    const expression = mathExpression.trim();

    if (editingComponent) {
      // Update existing component
      if (editingComponent.get('type') === 'math') {
        // This triggers the model's 'change:math-expression' event, which calls updateMath()
        editingComponent.set('math-expression', expression);
      }
    } else {
      // Add new component
      if (!expression) {
        handleCloseMathEditor();
        return;
      }
      
      // Render KaTeX HTML to set as the inner content of the GrapesJS component
      const htmlContent = renderKatexHtml(expression);

      const mathComponent = editorRef.current.DomComponents.addComponent({
        type: 'math',
        // CRITICAL: Set the trait value so it can be edited later
        'math-expression': expression, 
        // Set the visible content
        components: htmlContent, 
        style: { 
          fontSize: "18px", 
          color: "#000",
          padding: "1px",
          display: "inline-block",
          cursor: "pointer" 
        }
      });

      // Append to selected container or wrapper
      const selected = editorRef.current.getSelected();
      if (selected && selected.get('droppable')) {
        selected.append(mathComponent);
      } else {
        editorRef.current.getWrapper().append(mathComponent);
      }
    }

    handleCloseMathEditor();
  };

  return (
    <div className="GrapesJsApp">
      <div className="top-bar">
        <button onClick={handleSave}>Save</button>
        <button onClick={handleExport}> Export JSON</button>
        <button onClick={handleImport}> Import JSON</button>
        <button onClick={handleOpenMathEditor}>MathType (Alt + M)</button>
      </div>

      <input type="file" id="jsonInput" accept="application/json" style={{ display: "none" }} onChange={handleImportFile} />

      <div className="Editor">
        <div className="left-panel">
          <div className="panel-section">
            <div id="blocks"><div className="panel-header">My Blocks</div></div>
          </div>
          <div className="panel-section">
            <div id="layers-panel"><div className="panel-header">Layers</div></div>
          </div>
        </div>

        <div className="canvas-container">
          <div
            id="gjs"
            className="gjs-canvas"
            style={{
              background: "white",
              width: "100%",
              height: "100%",
              maxHeight: "90vh"
            }}
          ></div>
          
          {showMathEditor && (
            <div className="math-editor-overlay">
              <div className="math-editor-container">
                <div className="math-editor-header">
                  <h3>Math Expression Editor (LaTeX) {editingComponent ? "(Editing)" : "(New)"}</h3>
                  <button className="close-button" onClick={handleCloseMathEditor}>×</button>
                </div>
                <div className="mathfield-container">
                  <math-field 
                    ref={mathfieldRef}
                    onInput={handleMathInput}
                    onKeyDown={handleKeyDown}
                    virtual-keyboard-mode="on" 
                    virtual-keyboard-layout="symbols"
                    style={{
                      width: '100%',
                      fontSize: '20px',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      background: '#fff'
                    }}
                  >
                    {/* The expression is set via JavaScript in the useEffect */}
                  </math-field>
                </div>
                <div className="math-preview">
                  <h4>KaTeX Preview:</h4>
                  <div 
                    id="math-preview" 
                    dangerouslySetInnerHTML={{ __html: mathPreview }}
                    style={{ minHeight: '50px', border: '1px dashed #ccc', padding: '10px' }}
                  />
                </div>
                {/* <div className="keyboard-container">
                  <div className="keyboard-header">
                    <h4>Math Keyboard</h4>
                  </div>
                  <div className="keyboard-content" ref={keyboardContainerRef} style={{ 
                    minHeight: '300px',
                    background: '#f5f5f5',
                    borderRadius: '4px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden'
                  }}>
                  </div>
                </div> */}
                <div className="math-editor-footer">
                  <button className="cancel-button" onClick={handleCloseMathEditor}>Cancel</button>
                  <button className="add-button" onClick={handleAddMathExpression}>
                    {editingComponent ? 'Update Expression' : 'Add to Canvas'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="right-panel">
          <div style={{textAlign:"left",padding:"5px"}} id="styles-panel"><div className="panel-header">Styles</div></div>
          {/* <div id="traits-panel"><div className="panel-header">Properties</div></div> */}
        </div>
      </div>
    </div>
  );
}