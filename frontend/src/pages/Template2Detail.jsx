import { useEffect, useState, useRef, useContext } from 'preact/hooks';
import { useParams } from 'wouter'
import { api } from '../api';
import { ToastContext } from '../app';
import { TemplateEditor2 } from '../components/TemplateEditor2/TemplateEditor2';

export function Template2Detail() {
  const params = useParams()
  const [template, setTemplate] = useState({id: null})
  const [previewContent, setPreviewContent] = useState(null)
  const [previewType, setPreviewType] = useState('html')
  const [variables, setVariables] = useState([])

  const toast = useContext(ToastContext)
  const attributeForm = useRef(null)
  const previewRef = useRef(null)
  const previewHeaderRef = useRef(null)

  useEffect(() => { // hook on enter the screen
    const fetchTemplate = async () => {
      const response = await api.getTemplate(params.id)
      setTemplate(response.data)
      setPreviewContent(response.data.template)
      try {
        await extractVariables(response.data.template)
      } catch (e) {
        toast.error('Failed to extract variables: ' + e.message)
      }
    }
    fetchTemplate()
  }, [])

  useEffect(() => {
    if (!template.id) {return}
    checkTemplate()
  }, [template])

  const extractVariables = async (templateText) => {
    const result = await api.extractTemplateFields({template: templateText})
    setVariables(result.data)
  }

  const handlePreviewTypeChange = (e) => {
    setPreviewType(e.target.value)
  }

  const handleTemplateChange = (e) => {
    setTemplate({...template, template: e.target.value})
  }

  const checkTemplate = async () => {
    try {
      await extractVariables(template.template)
    } catch (e) {
      toast.error('Failed to extract variables: ' + e.message)
    }
  }

  const setVariable = (variableName, popOverForm) => {
    const iframe = previewRef.current
    if (!iframe) {return;}

    const docs = iframe.contentDocument || iframe.contentWindow.document;
    const targetElement = docs.querySelector(`[data-element-id=${popOverForm.targetId}]`)
    if (!targetElement) {return;}

    if (!targetElement.hasAttribute('data-original-content')) {
      targetElement.setAttribute('data-original-content', targetElement.innerText)
    }
    const originalText = targetElement.getAttribute('data-original-content')
    targetElement.innerText = variableName
    setTemplate({...template, template: template.template.replace(originalText, variableName)})
  }

  const clearVariable = (popOverForm) => {
    const iframe = previewRef.current
    if (!iframe) {return;}

    const docs = iframe.contentDocument || iframe.contentWindow.document;
    const targetElement = docs.querySelector(`[data-element-id=${popOverForm.targetId}]`)
    if (!targetElement || !targetElement.hasAttribute('data-original-content')) {return;}

    const originalText = targetElement.getAttribute('data-original-content')
    const assignedText = targetElement.innerText
    targetElement.innerText = originalText
    targetElement.removeAttribute('data-original-content')
    setTemplate({...template, template: template.template.replace(assignedText, originalText)})
  }

  const handleUpdate = async () => {
    const formData = new FormData(attributeForm.current)
    try {
      const result = await api.updateTemplate(template.id, {
        from_email: formData.get('from_email'),
        subject: formData.get('subject'),
        content_type: formData.get('content_type'),
        template: template.template,
      })
      setTemplate(result.data)
      setPreviewContent(result.data.template)
      toast.success('Template updated')
    } catch (e) {
      toast.error('Failed to update: ' + e.message)
    }
  }

  return (
    <div class="size-full">
      {
      !template.id ? (<div>...loading</div>) :
      (
        <div class='flex gap-3 h-full px-10 min-w-4xl max-w-8xl mx-auto mt-10'>
          <div class='grow w-2/3'>
            <div ref={previewHeaderRef} class='py-2 flex place-content-between border-b-2'>
              <div class='flex gap-3'>
                <span class='flex gap-1'>
                  <input type="radio" id="previewTypeHtml" value="html" name="previewType" onChange={handlePreviewTypeChange} checked={previewType === "html"} />
                  <label for="previewTypeHtml">HTML</label>
                </span>
                <span class='flex gap-1'>
                  <input type="radio" id="previewTypeRaw" value="raw" name="previewType" onChange={handlePreviewTypeChange} checked={previewType === "raw"} />
                  <label for="previewTypeRaw">Raw</label>
                </span>
              </div>
              {previewType === "raw" && (<button class='p-1 rounded-sm bg-blue-500 hover:bg-blue-400 text-white text-sm' onClick={checkTemplate}>
                Check template
              </button>)}
            </div>
            <div class='relative h-svh scrollbar-none'>
              <TemplateEditor2
                iframeRef={previewRef}
                srcDoc={previewContent}
                className="w-full h-full"
                offsetElementRef={previewHeaderRef}
                onSet={setVariable}
                onClear={clearVariable}
                style={{display: previewType === "html" ? 'block': 'none'}}
              ></TemplateEditor2>
              <textarea
                class='w-full font-mono text-sm text-pretty overflow-scroll'
                style={{display: previewType === "raw" ? 'block': 'none', height: '100%'}}
                value={template.template}
                onChange={handleTemplateChange}
              ></textarea>
            </div>
          </div>
          <div class="w-1/3 flex flex-col gap-3">
            <div class='p-2 border-1 border-neutral-100 shadow-sm rounded-sm'>
              <h1 class='text-lg font-semibold'>Template attributes</h1>
              <form ref={attributeForm} class='flex flex-col gap-3 px-1 mt-2 '>
                <div class='flex flex-col gap-1'>
                  <label for="fromEmail" class='text-sm'>From email</label>
                  <input type="text" id="fromEmail" name="from_email" class='border-1 border-neutral-300 p-1' autocomplete='off' value={template.from_email} />
                </div>
                <div class='flex flex-col gap-1'>
                  <label for="name" class='text-sm'>Name</label>
                  <input type="text" id="name" name="subject" class='border-1 border-neutral-300 p-1' autocomplete='off' value={template.subject} />
                </div>
                <div class='flex flex-col gap-1'>
                  <label for="contentType" class='text-sm'>Content type</label>
                  <select id="contentType" name="content_type" class='border-1 border-neutral-300 p-1' value={template.content_type}>
                    <option value="text/html">text/html</option>
                    <option value="text/plain">text/plain</option>
                  </select>
                </div>
              </form>
            </div>
            <div class='p-2 border-1 border-neutral-100 shadow-sm rounded-sm'>
              <h1 class='text-lg font-semibold'>Variables</h1>
              <div class='flex flex-col gap-1'>
                {variables.map(v => (
                  <div
                    class={[
                      'p-1', 'border-dashed', 'border-1',
                      ...(v.kind === 'extract' ? ['border-orange-300', 'bg-orange-100'] : []),
                      ...(v.kind === 'static_assign' ? ['border-sky-300', 'bg-sky-100'] : []),
                    ].join(' ')}
                  >
                    <span class='font-mono'>{v.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div class='flex gap-2'>
              <button class='p-1 rounded-sm bg-blue-500 hover:bg-blue-400 text-white text-sm w-full' onClick={handleUpdate}>
                Update
              </button>
            </div>
          </div>
        </div>
      )
    }
    </div>
  )
}
