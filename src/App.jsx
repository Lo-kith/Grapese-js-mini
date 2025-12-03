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
  const [mathExpression, setMathExpression] = useState("");
  const [mathPreview, setMathPreview] = useState("");
  const [editingComponent, setEditingComponent] = useState(null);
  const keyboardShownRef = useRef(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Helper function to render KaTeX safely
  const renderKatexHtml = (expression) => {
    if (!expression || expression.trim() === '') return '';
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
      const traitsPanelEl = document.getElementById('traits-panel');
      const layersPanelEl = document.getElementById('layers-panel');
      const canvasEl = document.getElementById('gjs');
      
      if (blocksEl && stylesPanelEl && traitsPanelEl && layersPanelEl && canvasEl) {
        setDomReady(true);
      }
    };

    checkDomReady();
    const observer = new MutationObserver(checkDomReady);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

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
            handleOpenMathEditor();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showMathEditor]);

  // 4. FIXED: Initialize MathLive with NO blinking keyboard
  useEffect(() => {
    const mathFieldEl = mathfieldRef.current;
    let timeoutId;

    // Tab Key Handler Function
    const handleMathFieldKeyDown = (e) => {
      if (e.key === 'Tab') {
        e.preventDefault(); 
        e.stopPropagation(); 
        // Insert \hspace{2.5em} for approximately 5 spaces
        mathFieldEl.insert('\\hspace{2.5em}'); 
      }
    };
    
    if (showMathEditor && mathFieldEl) {
      // IMPORTANT FIX: Set the math expression in the mathfield
      // Use setTimeout to ensure DOM is ready
      timeoutId = setTimeout(() => {
        try {
          // Reset the math field first
          mathFieldEl.reset();
          
          // Only set content if there's an expression
          if (mathExpression && mathExpression.trim() !== '') {
            // Use insert method instead of setting value directly
            mathFieldEl.insert(mathExpression);
          }
          
          mathFieldEl.focus();
          
          if (keyboardContainerRef.current) {
            mathFieldEl.virtualKeyboardTarget = keyboardContainerRef.current;
          }
          
          // FIX: Show keyboard only once when editor opens
          if (!keyboardShownRef.current) {
            mathFieldEl.executeCommand('showVirtualKeyboard');
            mathFieldEl.virtualKeyboardMode = 'on';
            keyboardShownRef.current = true;
          }
        } catch (error) {
          console.error("Error initializing math field:", error);
        }
      }, 150); // Increased delay to ensure DOM is ready

      // Attach the custom Tab key listener
      mathFieldEl.addEventListener('keydown', handleMathFieldKeyDown);
    } 

    // Cleanup Function
    return () => {
      clearTimeout(timeoutId); 
      if (mathFieldEl) {
        mathFieldEl.removeEventListener('keydown', handleMathFieldKeyDown);
        
        // Only hide keyboard when closing the editor completely
        if (!showMathEditor) {
          mathFieldEl.virtualKeyboardMode = 'auto';
          mathFieldEl.executeCommand('hideVirtualKeyboard');
          keyboardShownRef.current = false;
        }
      }
    };
  }, [showMathEditor, mathExpression]); 

  // 5. Update preview when math expression changes
  useEffect(() => {
    const html = renderKatexHtml(mathExpression);
    setMathPreview(html);
  }, [mathExpression]);

  // 6. Reset initial load flag when editor closes
  useEffect(() => {
    if (!showMathEditor) {
      setIsInitialLoad(true);
    }
  }, [showMathEditor]);

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
          tagName: "span", // Changed from div to span for inline display
          name: "Math Expression",
          draggable: true,
          droppable: false,
          editable: false, // Set to false so dblclick handles the edit flow
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
              value: " "
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
            console.log("Double-clicked math component with expression:", expression);
            setEditingComponent(this.model);
            setMathExpression(expression);
            setIsInitialLoad(false);
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
          editable: true, // Set to true to enable GrapesJS inline editing
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
      // Removed 'view' definition, allowing GrapesJS to handle the default text editing
    });

    // --- OTHER COMPONENT TYPES (unchanged) ---
    editorInstance.DomComponents.addType('box', {
      model: {
        defaults: {
          tagName: 'div', draggable: true, droppable: true,
          components: "Drop elements here",
          style: { display: 'flex', flexDirection: 'row', padding: '35px', height: "35px", border: '1px solid black' },
          traits: ['id', 'title', {
            type: 'select', label: 'Display', name: 'style-display',
            options: [{ value: 'block', name: 'Block' }, { value: 'inline', name: 'Inline' }, { value: 'flex', name: 'Flex' }, { value: 'grid', name: 'Grid' }, { value: 'none', name: 'None' }]
          }]
        }
      }
    });

    editorInstance.DomComponents.addType('two-column', {
      model: {
        defaults: {
          tagName: 'div', attributes: { class: 'two-col' }, draggable: true, droppable: true, resizable: true,
          components: `<div class="col-left">Drop here</div><div class="col-right">Drop here</div>`,
          styles: `.two-col{display:flex;width:100%;gap:20px;align-items:stretch;}.col-left,.col-right{flex:1;min-height:50px;background:#f9f9f9;border:1px dashed #bbb;padding:20px;}`,
          traits: ['id', 'title', {
            type: 'select', label: 'Gap', name: 'style-gap',
            options: [{ value: '10px', name: 'Small' }, { value: '20px', name: 'Medium' }, { value: '30px', name: 'Large' }]
          }]
        }
      }
    });

    editorInstance.DomComponents.addType('one-column', {
      model: {
        defaults: {
          tagName: 'div', attributes: { class: 'one-col' }, draggable: true, droppable: true,
          components: `<div class="col-item">Drop elements here</div>`,
          styles: `.one-col{width:100%;padding:20px;border:1px dashed #bbb}.col-item{min-height:50px;height:auto;display:block;border:1px dashed #bbb}`,
          traits: ['id', 'title']
        }
      }
    });

    editorInstance.DomComponents.addType("my-image", {
      model: {
        defaults: {
          tagName: "img", draggable: true, attributes: { src: "https://picsum.photos/300", alt: "image" }, width: "100", height: "50px", droppable: false, resizable: true,
          traits: ['id', 'title', {
            type: "file", label: "Upload Image", name: "image-file", changeProp: 1, accept: "image/*",
          }, { type: "text", name: "alt", label: "Alt Text" }, { type: "text", name: "width", label: "Width" }, { type: "text", name: "height", label: "Height" }, {
            type: 'select', label: 'Object Fit', name: 'style-object-fit',
            options: [{ value: 'cover', name: 'Cover' }, { value: 'contain', name: 'Contain' }, { value: 'fill', name: 'Fill' }, { value: 'none', name: 'None' }]
          }]
        },
        init() { this.on("change:image-file", this.handleUpload); },
        handleUpload() {
          const file = this.get("image-file");
          if (file && file instanceof File) {
            const url = URL.createObjectURL(file);
            this.addAttributes({ src: url });
          }
        },
      },
    });

    // --- BLOCKS ---
    editorInstance.BlockManager.add("box-block", { label: "Box", content: { type: "box" }, category: "Components" });
    editorInstance.BlockManager.add("text-block", { label: "Text", content: { type: "text" }, category: "Components" });
    editorInstance.BlockManager.add("math-block", { label: "Math (LaTeX)", content: { type: "math" }, category: "Components" });
    editorInstance.BlockManager.add("two-column-block", { label: `<div style="display:flex;flex-direction:column;align-items:center"><span>2 Column</span></div>`, content: { type: "two-column" }, category: "Layout" });
    editorInstance.BlockManager.add("one-column-block", { label: `<div style="display:flex;flex-direction:column;align-items:center"><span>1 Column</span></div>`, content: { type: "one-column" }, category: "Layout" });
    editorInstance.BlockManager.add("image-block", { label: "Image", content: { type: "my-image" }, category: "Components" });

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
    // Only reset if we're not editing an existing component
    if (!editingComponent) {
      setMathExpression("");
      setMathPreview("");
    }
    setShowMathEditor(true);
  };

  const handleCloseMathEditor = () => {
    setShowMathEditor(false);
    setEditingComponent(null);
    setMathExpression("");
    setMathPreview("");
  };

  const handleMathInput = (evt) => {
    // Check if event and event target exist
    if (evt && evt.target) {
      // Get the value from the event target
      const value = evt.target.value || '';
      setMathExpression(value);
    }
  };

  const handleKeyDown = (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
      e.stopPropagation();
    }
    if (e.key === 'Escape') {
      handleCloseMathEditor();
    }
  };

  const handleAddMathExpression = () => {
    if (!editorRef.current || !mathExpression.trim()) {
      handleCloseMathEditor();
      return;
    }
    
    const expression = mathExpression.trim();

    if (editingComponent) {
      if (editingComponent.get('type') === 'math') {
        editingComponent.set('math-expression', expression);
      }
    } else {
      const mathComponent = editorRef.current.DomComponents.addComponent({
        type: 'math',
        attributes: {
          'math-expression': expression
        },
        components: renderKatexHtml(expression)
      });

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
              minHeight: "500px"
            }}
          ></div>
          
          {showMathEditor && (
            <div className="math-editor-overlay">
              <div className="math-editor-container">
                <div className="math-editor-header">
                  <h3>Math Expression Editor (LaTeX)</h3>
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
                    {/* This is where the equation text will appear */}
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
                <div className="keyboard-container">
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
                </div>
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
          <div id="styles-panel"><div className="panel-header">Styles</div></div>
          <div id="traits-panel"><div className="panel-header">Properties</div></div>
        </div>
      </div>
    </div>
  );
}