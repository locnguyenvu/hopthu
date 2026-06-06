import { useRef, useState, useEffect } from 'preact/hooks';
import { useLocation, useParams } from 'wouter';
import { Layout } from '../components/Layout';
import { api } from '../api';

// --- Block Tagging: Color Palette ---
const TAG_COLORS = [
  { border: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
  { border: '#D97706', bg: 'rgba(217,119,6,0.08)' },
  { border: '#16A34A', bg: 'rgba(22,163,74,0.08)' },
  { border: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
  { border: '#DB2777', bg: 'rgba(219,39,119,0.08)' },
];
let _elCounter = 0;
const _genElId = () => `el-${++_elCounter}`;

export function TemplateEditor() {
  const [location, setLocation] = useLocation();
  const params = useParams();
  const id = params.id;
  const emailId = params.emailId;

  const variableNameInput = useRef(null)
  const emailViewerRef = useRef(null);

  const [template, setTemplate] = useState({
    from_email: '',
    subject: '',
    content_type: 'text/plain',
    template: '',
    priority: '',
  });
  const [originalBody, setOriginalBody] = useState('');
  const [referenceEmail, setReferenceEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [emails, setEmails] = useState([]);
  const [testEmailId, setTestEmailId] = useState('');
  const [activeTab, setActiveTab] = useState('reference');

  // Filter state for fetching test emails
  const [testSubjectFilter, setTestSubjectFilter] = useState('');
  const [testStatusFilter, setTestStatusFilter] = useState('new');
  const [loadingEmails, setLoadingEmails] = useState(false);

  // Separate state for extracted fields and variable assignments
  const [extractedFields, setExtractedFields] = useState([]);
  const [variableAssignments, setVariableAssignments] = useState([]);

  // Modal state for text selection
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [variableName, setVariableName] = useState('');
  const [dataType, setDataType] = useState('str');

  // Modal state for variable assignment
  const [isVarModalOpen, setIsVarModalOpen] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [newVarType, setNewVarType] = useState('str');

  // State for trigger existence check
  const [hasTrigger, setHasTrigger] = useState(false);
  const [triggerId, setTriggerId] = useState(null);
  const [checkingTrigger, setCheckingTrigger] = useState(false);

  // Build full template text with variable assignments prepended
  const [fullTemplateText, setFullTemplateText] = useState('');

  // ================================================================
  // NEW: Block-based tagging state for HTML content
  // ================================================================
  const [selectionMode, setSelectionMode] = useState('block'); // 'text' | 'block'
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [blockTagName, setBlockTagName] = useState('');
  const [blockTaggedElements, setBlockTaggedElements] = useState({});
  // blockTaggedElements: { [elementId]: { fieldName: string, colorIndex: number } }

  // Cleanup overlays on unmount
  useEffect(() => {
    return () => cleanupOverlays();
  }, []);

  const cleanupOverlays = () => {
    const container = emailViewerRef.current;
    if (!container) return;
    container.querySelectorAll('.block-tag-overlay, .block-tag-border, .block-tag-badge').forEach(el => el.remove());
  };

  useEffect(() => {
    loadData();
  }, [id, emailId]);

  useEffect(() => {
    variableNameInput.current?.focus()
  }, [isModalOpen, isVarModalOpen]);

  // Re-render block overlays whenever tagged elements change
  useEffect(() => {
    if (template.content_type === 'text/html' && selectionMode === 'block') {
      renderBlockOverlays();
    }
  }, [blockTaggedElements, selectionMode, template.content_type, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (id) {
        // Load existing template
        const response = await api.getTemplate(id);
        const t = response.data;

        // Use fields from server if available (contains both extract and static_assign)
        if (t.fields && Array.isArray(t.fields)) {
          const extracted = t.fields.filter(f => f.kind === 'extract');
          const assignments = t.fields.filter(f => f.kind === 'static_assign');
          setExtractedFields(extracted);
          setVariableAssignments(assignments);
        }

        // Don't include fields in template state, we use extractedFields instead
        const { fields: _, ...templateData } = t;
        setTemplate({
          ...templateData,
          priority: t.priority?.toString() || '',
          template: t.template,
        });
        setOriginalBody(t.template);
        setFullTemplateText(t.template)

        // Check if a trigger exists for this template
        await checkForExistingTrigger(id);
      } else if (emailId) {
        // Create from email
        const response = await api.getEmail(emailId);
        const email = response.data;
        setReferenceEmail(email);
        setTemplate({
          from_email: email.from_email,
          subject: email.subject,
          content_type: email.content_type,
          template: email.body,
          priority: '',
        });
        setOriginalBody(email.body);
        setFullTemplateText(email.body)
        setExtractedFields([]);
        setVariableAssignments([]);
      }

      // Initialize subject filter from template
      setTestSubjectFilter(template.subject || '');

      // Load emails for testing - filter by from_email, status=new, order by created_at desc
      await fetchTestEmails(template.from_email, template.subject || '', 'new');

      if (emailId) {
        setTestEmailId(emailId);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTestEmails = async (fromEmail, subject, status) => {
    try {
      setLoadingEmails(true);
      const params = {
        per_page: 100,
        status: status
      };

      if (fromEmail) {
        params.from_email = fromEmail;
      }

      if (subject) {
        params.subject = subject;
      }

      const emailsRes = await api.listEmails(params);
      setEmails(emailsRes.data || []);
    } catch (e) {
      setError('Failed to load emails: ' + e.message);
    } finally {
      setLoadingEmails(false);
    }
  };

  const checkForExistingTrigger = async (templateId) => {
    try {
      setCheckingTrigger(true);
      const response = await api.listTriggers({ template_id: templateId });
      const triggers = response.data || [];

      if (triggers.length > 0) {
        // Take the first trigger if multiple exist
        setHasTrigger(true);
        setTriggerId(triggers[0].id);
      } else {
        setHasTrigger(false);
        setTriggerId(null);
      }
    } catch (e) {
      console.error('Error checking for existing trigger:', e.message);
      setHasTrigger(false);
      setTriggerId(null);
    } finally {
      setCheckingTrigger(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTemplate(prev => ({ ...prev, [name]: value }));
  };

  const handleTemplateChange = async (e) => {
    const fullText = e.target.value;

    // Update full template text immediately
    setFullTemplateText(fullText);

    // Send request to server to extract fields
    try {
      const response = await api.extractTemplateFields({ template: fullText });
      const fields = response.data;
      const extracted = fields.filter(f => f.kind === 'extract');
      const assignments = fields.filter(f => f.kind === 'static_assign');
      setExtractedFields(extracted);
      setVariableAssignments(assignments);
    } catch (e) {
      console.error('Failed to extract fields:', e.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Build variable assignments section from static_assign fields
      // Use single newline to separate assignments from template content
      // Note: docthu doesn't support type annotations in assignments, only in variables
      const data = {
        ...template,
        priority: template.priority ? parseInt(template.priority) : null,
        // Prepend variable assignments to template
        template: fullTemplateText,
      };

      if (id) {
        await api.updateTemplate(id, data);
      } else {
        const res = await api.createTemplate(data);
        setLocation(`/templates/${res.data.id}`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.deleteTemplate(id);
      setLocation('/templates');
    } catch (e) {
      setError('Failed to delete: ' + e.message);
    }
  };

  const handleTest = async () => {
    if (!testEmailId) {
      setError('Please select an email to test');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testTemplate(id, testEmailId);
      setTestResult({ success: true, data: res.data });
    } catch (e) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const removeField = (fieldName) => {
    // Remove from extractedFields
    setExtractedFields(prev => prev.filter(f => f.name !== fieldName));
    // Also remove from template
    setTemplate(prev => ({
      ...prev,
      template: prev.template.replace(new RegExp(`\\{\\{${fieldName}(?::\\w+)?\\}\\}`, 'g'), ''),
    }));
  };

  const addVariableAssignment = async () => {
    const name = newVarName.trim();
    const value = newVarValue.trim();
    if (!name || !value) return;

    if (variableAssignments.some(v => v.name === name)) {
      alert('Variable name already exists');
      return;
    }

    setIsVarModalOpen(false);

    // Update fullTemplateText with the new assignment
    const updatedAssignments = [{ name, value, type: newVarType }];
    const assignmentsText = updatedAssignments.map(v =>
        `{% ${v.name} = '${v.value}' %}`
    ).join('\n') + (updatedAssignments.length > 0 ? '\n' : '');
    const newFullText = assignmentsText + template.template;
    setFullTemplateText(newFullText);

    // Extract fields from the server using docthu
    try {
      const response = await api.extractTemplateFields({ template: newFullText });
      const fields = response.data;
      const extracted = fields.filter(f => f.kind === 'extract');
      const assignments = fields.filter(f => f.kind === 'static_assign');
      setExtractedFields(extracted);
      setVariableAssignments(assignments);
    } catch (e) {
      console.error('Failed to extract fields:', e.message);
    }

    setNewVarName('');
    setNewVarValue('');
    setNewVarType('str');
  };

  const handleVarModalClose = () => {
    setIsVarModalOpen(false);
    setNewVarName('');
    setNewVarValue('');
    setNewVarType('str');
  };

  const removeVariableAssignment = (index) => {
    setVariableAssignments(prev => prev.filter((_, i) => i !== index));
  };

  const handleTextSelection = () => {
    // Only use text selection in text mode or for non-HTML content
    if (selectionMode === 'block' && template.content_type === 'text/html') return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text && text.length > 0) {
      setSelectedText(text);
      setVariableName('');
      setDataType('str');
      setIsModalOpen(true);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedText('');
    setVariableName('');
    setDataType('str');
    // Clear the selection
    window.getSelection().removeAllRanges();
  };

  const handleAddVariableFromSelection = async () => {
    const fieldName = variableName.trim();
    if (!fieldName) return;
    if (extractedFields.some(f => f.name === fieldName)) {
      alert('Field already exists');
      return;
    }

    // Build marker with type if not str (default)
    const marker = dataType === 'str' ? `{{${fieldName}}}` : `{{${fieldName}:${dataType}}}`;

    const newTemplateText = template.template.replace(selectedText, marker);
    setTemplate(prev => ({
      ...prev,
      template: newTemplateText,
    }));

    // Also update referenceEmail body to show the variable
    if (referenceEmail) {
      setReferenceEmail(prev => ({
        ...prev,
        body: prev.body.replace(selectedText, marker),
      }));
    }

    // Also update originalBody if it exists
    if (originalBody) {
      setOriginalBody(prev => prev.replace(selectedText, marker));
    }

    setFullTemplateText(newTemplateText);

    // Extract fields from the server using docthu
    try {
      const response = await api.extractTemplateFields({ template: newTemplateText });
      const fields = response.data;
      const extracted = fields.filter(f => f.kind === 'extract');
      const assignments = fields.filter(f => f.kind === 'static_assign');
      setExtractedFields(extracted);
      setVariableAssignments(assignments);
    } catch (e) {
      console.error('Failed to extract fields:', e.message);
    }

    handleModalClose();
  };

  // ================================================================
  // NEW: Block-based tagging functions
  // ================================================================

  const getTaggableElement = (target) => {
    if (!target || !emailViewerRef.current) return null;
    const taggable = ['P', 'DIV', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'A', 'STRONG', 'EM', 'B', 'I', 'TD', 'TH', 'LI', 'BLOCKQUOTE'];
    let el = target;
    while (el && el !== emailViewerRef.current) {
      if (taggable.includes(el.tagName)) return el;
      el = el.parentElement;
    }
    return null;
  };

  const handleBlockElementClick = (e) => {
    if (selectionMode !== 'block') return;
    // Don't trigger if clicking the inline editor
    if (e.target.closest('.block-tag-editor')) return;

    const el = getTaggableElement(e.target);
    if (!el) {
      setSelectedElementId(null);
      cleanupSelectionOverlay();
      return;
    }

    // Assign a unique ID to the element if it doesn't have one
    let elId = el.getAttribute('data-element-id');
    if (!elId) {
      elId = _genElId();
      el.setAttribute('data-element-id', elId);
    }
    const existing = blockTaggedElements[elId];
    setSelectedElementId(elId);
    setBlockTagName(existing ? existing.fieldName : '');

    // Show selection overlay
    showSelectionOverlay(el);
    // Hide hover overlay
    hideHoverOverlay();
  };

  const handleBlockElementMouseMove = (e) => {
    if (selectionMode !== 'block' || selectedElementId) return;
    const el = getTaggableElement(e.target);
    if (el) {
      showHoverOverlay(el);
    } else {
      hideHoverOverlay();
    }
  };

  const handleBlockElementMouseLeave = () => {
    hideHoverOverlay();
  };

  // Overlay helpers
  const showHoverOverlay = (targetEl) => {
    const container = emailViewerRef.current;
    if (!container) return;
    let overlay = container.querySelector('.block-tag-hover-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'block-tag-hover-overlay';
      overlay.style.cssText = 'position:absolute;pointer-events:none;z-index:10;border:1px dashed rgba(37,99,235,0.35);background:rgba(37,99,235,0.06);border-radius:2px;transition:opacity 80ms ease;opacity:0;';
      container.appendChild(overlay);
    }
    positionOverlay(overlay, targetEl);
    overlay.style.opacity = '1';
  };

  const hideHoverOverlay = () => {
    const overlay = emailViewerRef.current?.querySelector('.block-tag-hover-overlay');
    if (overlay) overlay.style.opacity = '0';
  };

  const showSelectionOverlay = (targetEl) => {
    const container = emailViewerRef.current;
    if (!container) return;
    let overlay = container.querySelector('.block-tag-selection-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'block-tag-selection-overlay';
      overlay.style.cssText = 'position:absolute;pointer-events:none;z-index:10;border:2px solid #2563EB;background:rgba(239,246,255,0.4);border-radius:2px;';
      container.appendChild(overlay);
    }
    positionOverlay(overlay, targetEl);
  };

  const cleanupSelectionOverlay = () => {
    emailViewerRef.current?.querySelector('.block-tag-selection-overlay')?.remove();
  };

  const positionOverlay = (overlay, targetEl) => {
    const container = emailViewerRef.current;
    if (!container) return;
    const rect = targetEl.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    overlay.style.top = `${rect.top - cRect.top + container.scrollTop}px`;
    overlay.style.left = `${rect.left - cRect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  };

  // Helper: clone the email viewer container, apply marker replacement to
  // the element matching data-element-id, clean up highlight spans and
  // overlay elements, then return the cleaned innerHTML as the new template.
  const buildTemplateFromDOM = (targetElementId, newContent) => {
    const container = emailViewerRef.current;
    if (!container) return null;

    const clone = container.cloneNode(true);

    // Apply content replacement in the clone
    const cloneEl = clone.querySelector(`[data-element-id="${targetElementId}"]`);
    if (cloneEl) {
      cloneEl.textContent = newContent;
    }

    // Remove var-highlight spans (unwrap their content)
    clone.querySelectorAll('.var-highlight').forEach(span => {
      const parent = span.parentNode;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    });

    // Remove data-element-id attributes
    clone.querySelectorAll('[data-element-id]').forEach(el => {
      el.removeAttribute('data-element-id');
    });

    // Remove overlay elements
    clone.querySelectorAll('.block-tag-hover-overlay, .block-tag-selection-overlay, .block-tag-border, .block-tag-badge').forEach(el => el.remove());

    return clone.innerHTML;
  };

  const confirmBlockTag = async () => {
    const name = blockTagName.trim().toLowerCase();
    if (!name || !selectedElementId) {
      setSelectedElementId(null);
      cleanupSelectionOverlay();
      return;
    }

    // Check for duplicate field name
    if (extractedFields.some(f => f.name === name) && !blockTaggedElements[selectedElementId]) {
      // Field exists but we're not editing an existing tag on this element
      const existingEl = Object.entries(blockTaggedElements).find(([, v]) => v.fieldName === name);
      if (!existingEl || existingEl[0] !== selectedElementId) {
        // Use existing color
      }
    }

    // Get element content
    const el = emailViewerRef.current?.querySelector(`[data-element-id="${selectedElementId}"]`);
    if (!el) return;
    const originalContent = el.textContent;

    // Determine color
    let colorIndex;
    const existingEntry = Object.entries(blockTaggedElements).find(([, v]) => v.fieldName === name);
    if (existingEntry) {
      colorIndex = existingEntry[1].colorIndex;
    } else {
      const usedIndices = Object.values(blockTaggedElements).map(v => v.colorIndex);
      colorIndex = 0;
      while (usedIndices.includes(colorIndex) && colorIndex < TAG_COLORS.length) colorIndex++;
      if (colorIndex >= TAG_COLORS.length) colorIndex = Object.keys(blockTaggedElements).length % TAG_COLORS.length;
    }

    // Update blockTaggedElements state
    setBlockTaggedElements(prev => ({
      ...prev,
      [selectedElementId]: { fieldName: name, colorIndex, originalContent },
    }));

    // Replace content in template with marker using DOM-based approach.
    // This avoids substring replacement bugs where the same text appears
    // in multiple elements.
    const marker = `{{${name}}}`;
    const newTemplateText = buildTemplateFromDOM(selectedElementId, marker);

    if (newTemplateText === null) return;

    setTemplate(prev => ({ ...prev, template: newTemplateText }));
    setFullTemplateText(newTemplateText);
    if (originalBody) setOriginalBody(newTemplateText);
    if (referenceEmail) {
      setReferenceEmail(prev => prev ? ({ ...prev, body: newTemplateText }) : null);
    }

    // Extract fields from server
    try {
      const response = await api.extractTemplateFields({ template: newTemplateText });
      const fields = response.data;
      setExtractedFields(fields.filter(f => f.kind === 'extract'));
      setVariableAssignments(fields.filter(f => f.kind === 'static_assign'));
    } catch (e) {
      console.error('Failed to extract fields:', e.message);
    }

    // Reset selection
    setSelectedElementId(null);
    setBlockTagName('');
    cleanupSelectionOverlay();
  };

  const cancelBlockTag = () => {
    setSelectedElementId(null);
    setBlockTagName('');
    cleanupSelectionOverlay();
  };

  const removeBlockTagByElementId = (elementId) => {
    const tagInfo = blockTaggedElements[elementId];
    if (!tagInfo) return;

    // Restore original content using DOM-based approach to avoid substring
    // replacement bugs.
    const newTemplateText = buildTemplateFromDOM(elementId, tagInfo.originalContent);

    if (newTemplateText === null) return;

    setTemplate(prev => ({ ...prev, template: newTemplateText }));
    setFullTemplateText(newTemplateText);
    if (originalBody) setOriginalBody(newTemplateText);

    // Remove from blockTaggedElements
    setBlockTaggedElements(prev => {
      const next = { ...prev };
      delete next[elementId];
      return next;
    });

    // Remove from extractedFields
    setExtractedFields(prev => prev.filter(f => f.name !== tagInfo.fieldName));
  };

  const removeBlockTagByFieldName = (fieldName) => {
    // Find all elements tagged with this field name
    const entries = Object.entries(blockTaggedElements).filter(([, v]) => v.fieldName === fieldName);
    if (entries.length === 0) return;

    // Restore original content for each element sequentially using the
    // DOM-based approach.
    let newTemplateText = template.template;

    entries.forEach(([elementId, tagInfo]) => {
      const tempResult = buildTemplateFromDOM(elementId, tagInfo.originalContent);
      if (tempResult !== null) {
        newTemplateText = tempResult;
      }
    });

    setTemplate(prev => ({ ...prev, template: newTemplateText }));
    setFullTemplateText(newTemplateText);
    if (originalBody) setOriginalBody(newTemplateText);

    // Remove all entries with this field name
    setBlockTaggedElements(prev => {
      const next = { ...prev };
      Object.entries(next).forEach(([k, v]) => {
        if (v.fieldName === fieldName) delete next[k];
      });
      return next;
    });

    // Remove from extractedFields
    setExtractedFields(prev => prev.filter(f => f.name !== fieldName));
  };

  const renderBlockOverlays = () => {
    const container = emailViewerRef.current;
    if (!container) return;

    // Clean old
    container.querySelectorAll('.block-tag-border, .block-tag-badge').forEach(el => el.remove());

    Object.entries(blockTaggedElements).forEach(([elementId, tagInfo]) => {
      const el = container.querySelector(`[data-element-id="${elementId}"]`);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();
      const color = TAG_COLORS[tagInfo.colorIndex % TAG_COLORS.length];

      // Border overlay
      const border = document.createElement('div');
      border.className = 'block-tag-border';
      border.style.cssText = `position:absolute;pointer-events:none;z-index:5;border:2px solid ${color.border};border-radius:2px;`;
      border.style.top = `${rect.top - cRect.top + container.scrollTop}px`;
      border.style.left = `${rect.left - cRect.left}px`;
      border.style.width = `${rect.width}px`;
      border.style.height = `${rect.height}px`;
      container.appendChild(border);

      // Badge overlay
      const badge = document.createElement('div');
      badge.className = 'block-tag-badge';
      badge.style.cssText = `position:absolute;z-index:6;pointer-events:none;animation:tagBadgeIn 150ms ease-out;`;
      badge.style.top = `${rect.top - cRect.top + container.scrollTop - 8}px`;
      badge.style.left = `${rect.right - cRect.left - 8}px`;
      badge.innerHTML = `<span style="display:inline-block;padding:1px 6px;font-size:11px;font-weight:500;border-radius:3px;background-color:${color.border}18;color:${color.border};border:1px solid ${color.border}40;white-space:nowrap;">${tagInfo.fieldName}</span>`;
      container.appendChild(badge);
    });
  };

  const getInlineEditorPosition = () => {
    if (!selectedElementId || !emailViewerRef.current) return null;
    const el = emailViewerRef.current.querySelector(`[data-element-id="${selectedElementId}"]`);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cRect = emailViewerRef.current.getBoundingClientRect();
    return {
      top: rect.top - cRect.top + emailViewerRef.current.scrollTop - 6,
      left: Math.max(rect.right - cRect.left - 200, 0),
    };
  };

  const highlightVariables = (text) => {
    const extractFieldNames = extractedFields.map(f => f.name);
    if (!extractFieldNames.length) return text;

    // Create a regex pattern to match all variable markers (with or without type)
    const pattern = extractFieldNames.map(f => `\\{\\{${f}(?::\\w+)?\\}\\}`).join('|');
    const regex = new RegExp(`(${pattern})`, 'g');

    return text.split(regex).map((part, index) => {
      // Check if this part is a variable marker
      const isVariable = extractFieldNames.some(f =>
        part === `{{${f}}}` || part.startsWith(`{{${f}:`)
      );
      if (isVariable) {
        return (
          <span key={index} className="bg-yellow-200 px-1 rounded font-medium text-blue-700">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const renderReference = () => {
    if (!referenceEmail && !originalBody) return null;

    const body = fullTemplateText;
    const extractFieldNames = extractedFields.map(f => f.name);

    // Build variable assignments text
    const varAssignmentsText = variableAssignments.length > 0
      ? variableAssignments.map(v => `{% ${v.name} = ${v.value} %}`).join('\n') + '\n'
      : '';

    // Full text with assignments for highlighting
    const fullText = varAssignmentsText + body;

    if (template.content_type === 'text/html') {
      // For HTML content, highlight variables by modifying the HTML
      let highlightedBody = body;
      extractedFields.forEach(field => {
        const marker = `{{${field.name}}}`;
        const markerWithType = `{{${field.name}:${field.type}}}`;
        // Escape special regex characters in the marker
        const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedMarkerWithType = markerWithType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const combinedPattern = `(${escapedMarker}|${escapedMarkerWithType})`;
        highlightedBody = highlightedBody.replace(
          new RegExp(combinedPattern, 'g'),
          '<span class="var-highlight" style="background-color: #fef08a; padding: 0 2px; border-radius: 2px; color: #1d4ed8; font-weight: 500;">$1</span>'
        );
      });

      // When in block selection mode, set up element IDs and click handlers
      const isBlockMode = selectionMode === 'block';

      return (
        <div className="relative">
          {isBlockMode && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs text-gray-500 font-medium">Selection mode:</span>
              <div className="inline-flex bg-gray-100 rounded p-0.5">
                <button
                  onClick={() => { setSelectionMode('block'); setSelectedElementId(null); cleanupSelectionOverlay(); }}
                  className={`px-3 py-1 text-xs font-medium rounded transition-all ${selectionMode === 'block' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Block Select
                </button>
                <button
                  onClick={() => { setSelectionMode('text'); setSelectedElementId(null); cleanupSelectionOverlay(); cleanupOverlays(); }}
                  className={`px-3 py-1 text-xs font-medium rounded transition-all ${selectionMode === 'text' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Text Select
                </button>
              </div>
              {selectionMode === 'block' && (
                <span className="text-xs text-blue-600">Click any element to tag it</span>
              )}
            </div>
          )}
          {!isBlockMode && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs text-gray-500 font-medium">Selection mode:</span>
              <div className="inline-flex bg-gray-100 rounded p-0.5">
                <button
                  onClick={() => { setSelectionMode('block'); }}
                  className={`px-3 py-1 text-xs font-medium rounded transition-all ${selectionMode === 'block' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Block Select
                </button>
                <button
                  onClick={() => { setSelectionMode('text'); }}
                  className={`px-3 py-1 text-xs font-medium rounded transition-all ${selectionMode === 'text' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Text Select
                </button>
              </div>
              {selectionMode === 'text' && (
                <span className="text-xs text-gray-500">Select text to create variables</span>
              )}
            </div>
          )}
          <div
            ref={emailViewerRef}
            className={`relative w-full h-full border border-gray-200 rounded-md overflow-auto p-3 bg-white ${isBlockMode ? 'cursor-crosshair' : ''}`}
            style={isBlockMode ? { cursor: 'crosshair', userSelect: 'none' } : {}}
            onMouseUp={handleTextSelection}
            onClick={isBlockMode ? handleBlockElementClick : undefined}
            onMouseMove={isBlockMode ? handleBlockElementMouseMove : undefined}
            onMouseLeave={isBlockMode ? handleBlockElementMouseLeave : undefined}
            dangerouslySetInnerHTML={{
              __html: highlightedBody,
            }}
          />
          {/* Inline tag editor for block selection */}
          {isBlockMode && selectedElementId && (() => {
            const pos = getInlineEditorPosition();
            if (!pos) return null;
            const selectedEl = emailViewerRef.current?.querySelector(`[data-element-id="${selectedElementId}"]`);
            const selectedContent = selectedEl ? selectedEl.textContent : '';
            return (
              <div
                className="block-tag-editor absolute z-20 bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-64"
                style={{ top: pos.top, left: pos.left }}
              >
                <div className="mb-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Selected Content</label>
                  <div className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 max-h-20 overflow-auto break-all">
                    {selectedContent}
                  </div>
                </div>
                <input
                  type="text"
                  value={blockTagName}
                  onInput={(e) => setBlockTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); confirmBlockTag(); }
                    else if (e.key === 'Escape') cancelBlockTag();
                  }}
                  placeholder="Variable name..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                  autoFocus
                />
                {/* Suggestions */}
                {blockTagName.trim() && extractedFields.length > 0 && (
                  <div className="mt-1 bg-white border border-gray-200 rounded shadow-sm max-h-28 overflow-auto">
                    {extractedFields
                      .filter(f => f.name.toLowerCase().includes(blockTagName.toLowerCase()) && f.name !== blockTagName)
                      .map(f => (
                        <button
                          key={f.name}
                          onClick={() => setBlockTagName(f.name)}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          <span className="text-gray-700">{f.name}</span>
                        </button>
                      ))}
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    onClick={cancelBlockTag}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                    title="Cancel"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                  <button
                    onClick={confirmBlockTag}
                    className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white"
                    title="Confirm"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      );
    }

    // For text content, show assignments then variables
    const lines = fullText.split('\n');
    return (
      <pre
        className="bg-gray-50 p-3 rounded-md overflow-auto text-sm h-full whitespace-pre-wrap cursor-text select-text"
        onMouseUp={handleTextSelection}
      >
        {lines.map((line, index) => {
          // Check if line is a variable assignment
          if (line.match(/^\{%\s*[\w.]+(?::\w+)?\s*=\s*.+?\s*%\}$/)) {
            return line + '\n';
          }
          // Otherwise highlight variables normally
          return highlightVariables(line + (index < lines.length - 1 ? '\n' : ''));
        })}
      </pre>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Add keyframe animation for badge */}
      <style>{`
        @keyframes tagBadgeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {id ? 'Edit Template' : 'New Template'}
          </h1>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {id && (
              checkingTrigger ? (
                <button
                  disabled
                  className="px-4 py-2 bg-gray-400 text-white rounded-md text-sm font-medium"
                >
                  Checking...
                </button>
              ) : hasTrigger ? (
                <button
                  onClick={() => setLocation(`/triggers/${triggerId}`)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                >
                  View Trigger
                </button>
              ) : (
                <button
                  onClick={() => setLocation(`/triggers/new?template_id=${id}`)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                >
                  Create Trigger
                </button>
              )
            )}
            {id && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-10 gap-6">
          {/* Left side - Reference and Template Input */}
          <div className="col-span-6 bg-white rounded-lg border border-gray-200">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('reference')}
                className={`px-4 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'reference'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Reference Email
              </button>
              <button
                onClick={() => setActiveTab('template')}
                className={`px-4 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'template'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Template
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4 h-[calc(100%-49px)]">
              {activeTab === 'reference' && (
                <div className="h-full flex flex-col">
                  <div className="flex-1 relative">
                    {renderReference()}
                  </div>
                </div>
              )}
              {activeTab === 'template' && (
                <div className="h-full flex flex-col">
                  <textarea
                    name="template"
                    value={fullTemplateText}
                    onChange={handleTemplateChange}
                    className="w-full flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                    placeholder="Email template with {{variables}}"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right side - Settings and Fields */}
          <div className="col-span-4 space-y-4">
            {/* Settings */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Settings</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                  <input
                    type="email"
                    name="from_email"
                    value={template.from_email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject (optional)</label>
                  <input
                    type="text"
                    name="subject"
                    value={template.subject || ''}
                    onChange={handleChange}
                    placeholder="Match any subject"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority (optional)</label>
                  <input
                    type="number"
                    name="priority"
                    value={template.priority}
                    onChange={handleChange}
                    placeholder="Auto"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                  <select
                    name="content_type"
                    value={template.content_type}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="text/plain">Plain Text</option>
                    <option value="text/html">HTML</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Fields */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Fields</h3>
                <button
                  onClick={() => { setIsVarModalOpen(true) }}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                >
                  + Add
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                Define variables using Docthu syntax
              </p>
              <div className="space-y-2">
                {[...variableAssignments.map((v, i) => ({...v, kind: 'static_assign', index: i})),
                  ...extractedFields.map(f => ({...f, kind: 'extract'}))
                ].map((field, index) => (
                  <div key={index} className={`flex items-center justify-between p-2 rounded ${field.kind === 'static_assign' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      {/* Show color dot for block-tagged fields */}
                      {(() => {
                        const blockEntry = Object.entries(blockTaggedElements).find(([, v]) => v.fieldName === field.name);
                        if (blockEntry) {
                          const color = TAG_COLORS[blockEntry[1].colorIndex % TAG_COLORS.length];
                          return <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color.border }} />;
                        }
                        return null;
                      })()}
                      <code className="text-sm">{field.name}</code>
                      <span className={`text-xs px-2 py-0.5 rounded ${field.kind === 'static_assign' ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'}`}>{field.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${field.kind === 'static_assign' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{field.kind}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (field.kind === 'static_assign') {
                          removeVariableAssignment(field.index);
                        } else {
                          // Check if this field was created via block tagging
                          const blockEntry = Object.entries(blockTaggedElements).find(([, v]) => v.fieldName === field.name);
                          if (blockEntry) {
                            removeBlockTagByFieldName(field.name);
                          } else {
                            removeField(field.name);
                          }
                        }
                      }}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {variableAssignments.length === 0 && extractedFields.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No fields defined</p>
                )}
              </div>
            </div>

            {/* Test Section */}
            {id && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-medium text-gray-900 mb-3">Test Template</h3>

                {/* Filter Controls */}
                <div className="space-y-2 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Subject (optional)</label>
                    <input
                      type="text"
                      value={testSubjectFilter}
                      onChange={(e) => setTestSubjectFilter(e.target.value)}
                      placeholder="Filter by subject"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                    <select
                      value={testStatusFilter}
                      onChange={(e) => setTestStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="new">new</option>
                      <option value="extracted">extracted</option>
                      <option value="ignored">ignored</option>
                      <option value="pushed">pushed</option>
                    </select>
                  </div>
                  <button
                    onClick={() => fetchTestEmails(template.from_email, testSubjectFilter, testStatusFilter)}
                    disabled={loadingEmails}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loadingEmails ? 'Loading...' : 'Apply Filters'}
                  </button>
                </div>

                <select
                  value={testEmailId}
                  onChange={(e) => setTestEmailId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
                >
                  <option value="">Select an email...</option>
                  {emails
                    .map(email => (
                      <option key={email.id} value={email.id}>
                        {email.subject?.substring(0, 50) || 'No subject'}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                >
                  {testing ? 'Testing...' : 'Test'}
                </button>
                {testResult && (
                  <div className={`mt-3 p-3 rounded text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {testResult.success ? (
                      <pre className="overflow-auto">
                        {JSON.stringify(testResult.data, null, 2)}
                      </pre>
                    ) : (
                      testResult.error
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Modal for creating variable from selected text */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Create Variable
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selected Text
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600 break-all">
                  {selectedText}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Variable Name
                </label>
                <input
                  type="text"
                  value={variableName}
                  ref={variableNameInput}
                  onChange={(e) => setVariableName(e.target.value)}
                  placeholder="Enter variable name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="off"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Type
                </label>
                <select
                  value={dataType}
                  onChange={(e) => setDataType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="str">String</option>
                  <option value="int">Integer</option>
                  <option value="float">Float</option>
                  <option value="date">Date</option>
                  <option value="datetime">DateTime</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleModalClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddVariableFromSelection}
                  disabled={!variableName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Add Variable
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for variable assignment */}
      {isVarModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Add Variable Assignment
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Variable Name
                </label>
                <input
                  type="text"
                  value={newVarName}
                  ref={variableNameInput}
                  onChange={(e) => setNewVarName(e.target.value)}
                  placeholder="var_name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && addVariableAssignment()}
                  autoComplete="off"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Value
                </label>
                <input
                  type="text"
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  placeholder="'value'"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && addVariableAssignment()}
                  autoComplete="off"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={newVarType}
                  onChange={(e) => setNewVarType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="str">String</option>
                  <option value="int">Integer</option>
                  <option value="float">Float</option>
                  <option value="date">Date</option>
                  <option value="datetime">DateTime</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleVarModalClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={addVariableAssignment}
                  disabled={!newVarName.trim() || !newVarValue.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
