import { useEffect, useState, useRef, useContext } from 'preact/hooks';
import { useSearchParams, useLocation } from 'wouter'
import { api } from '../api';
import { ToastContext } from '../app';
import { TemplatePreview } from '../components/TemplateEditor2/TemplatePreview';

export function TemplateEditor2() {
  const [email, setEmail] = useState({
    id: null
  })
  const [emailPreviewContent, setEmailPreviewContent] = useState(null)
  const [templateReplacements, setTemplateReplacements] = useState({})
  const [templateOutput, setTemplateOutput] = useState('')
  const [searchParams, _] = useSearchParams()
  const [, setLocation] = useLocation()
  const [variables, setVariables] = useState([])
  const [staticVariables, setStaticVariables] = useState('')
  const [previewType, setPreviewType] = useState('html')
  const [dryRunResult, setDryRunResult] = useState(null)

  const toast = useContext(ToastContext)

  const emailPreview = useRef(null)
  const staticVariablesInput = useRef(null)
  const templateAttributeForm = useRef(null)


  useEffect(() => { // hook on enter the screen
    const emailId = searchParams.get('email_id')
    const fetchEmail = async () => {
      const response = await api.getEmail(emailId)
      setEmail(response.data)
      setEmailPreviewContent(response.data.body)
    }
    fetchEmail()
  }, [])

  const handlePreviewTypeChange = async (e) => {
    setPreviewType(e.target.value)
  }

  const setVariable = async (variableName, popOverForm) => {
    const iframe = emailPreview.current
    if (!iframe) {return;}

    const docs = iframe.contentDocument || iframe.contentWindow.document;
    const targetElement = docs.querySelector(`[data-element-id=${popOverForm.targetId}]`)

    const replacedHtml = popOverForm.htmlContent.replace(popOverForm.textContent.trim(), variableName)
    const updatedReplacements = { ...templateReplacements }
    if (!(popOverForm.targetId in updatedReplacements)) {
      updatedReplacements[popOverForm.targetId] = [
        popOverForm.htmlContent,
        replacedHtml
      ]
    } else {
      updatedReplacements[popOverForm.targetId] = [
        updatedReplacements[popOverForm.targetId][0],
        replacedHtml
      ]
    }
    setTemplateReplacements(updatedReplacements)
    if (!targetElement.hasAttribute('data-original-content')) {
      targetElement.setAttribute('data-original-content', targetElement.innerText)
    }
    targetElement.innerText = variableName

    await parseTemplate(updatedReplacements)
  }

  const handleConstantsChange = (e) => {
    setStaticVariables(e.target.value)
  }

  const clearVariable = async (popOverForm) => {
    const iframe = emailPreview.current
    if (!iframe) {return;}

    const docs = iframe.contentDocument || iframe.contentWindow.document;
    const targetElement = docs.querySelector(`[data-element-id=${popOverForm.targetId}]`)
    if (!targetElement.hasAttribute('data-original-content')) {
      return
    }
    targetElement.innerText = targetElement.getAttribute('data-original-content')
    targetElement.removeAttribute('data-original-content')
    const updatedReplacements = { ...templateReplacements }
    delete updatedReplacements[popOverForm.targetId]
    setTemplateReplacements(updatedReplacements)

    await parseTemplate(updatedReplacements)
  }

  const parseTemplate = async (replacements) => {
    let templateStr = email.body
    for (const [_, replacement] of Object.entries(replacements)) {
      if (templateStr.includes(replacement[0])) {
        templateStr = templateStr.replace(...replacement)
      } else {
        const domParser = new DOMParser()
        const elementSearch = domParser.parseFromString(replacement[0], 'text/html')
        const elementReplace = domParser.parseFromString(replacement[1], 'text/html')
        templateStr = templateStr.replace(
          elementSearch.body.firstChild.textContent,
          elementReplace.body.firstChild.textContent
        )
      }
    }
    setTemplateOutput(staticVariables + "\n" + templateStr)
    const result = await api.extractTemplateFields({template: staticVariables + "\n" + templateStr})
    setVariables(result.data)
  }

  const checkTemplate = async () => {
    const result = await api.extractTemplateFields({template: templateOutput})
    setVariables(result.data)
  }

  const handleDryRun = async () => {
    try {
      const result = await api.dryRunTemplate({
        email_id: email.id,
        template: templateOutput,
      })
      setDryRunResult({data: result.data})
    } catch (e) {
      setDryRunResult({error: e.message})
    }
  }

  const handleCreate = async () => {
    if (!templateOutput.trim()) {
      toast.error('Template is empty')
      return
    }
    try {
      const parseResult = await api.extractTemplateFields({template: templateOutput})
      setVariables(parseResult.data)
      if (parseResult.data.length === 0) {
        toast.error('No variables found in the template')
        return
      }
    } catch (e) {
      toast.error('Failed to parse template: ' + e.message)
      return
    }
    const formData = new FormData(templateAttributeForm.current)
    try {
      const result = await api.createTemplate({
        from_email: formData.get('from_email'),
        subject: formData.get('subject'),
        content_type: formData.get('content_type'),
        template: templateOutput,
      })
      toast.success('Template created')
      setLocation(`/templates/${result.data.id}`)
    } catch (e) {
      toast.error('Failed to create: ' + e.message)
    }
  }

  return (
    <div class="size-screen">
      {
      !email.id ? (<div>...loading</div>) :
      (
        <div class="flex gap-3 h-full px-10 min-w-4xl max-w-6xl mx-auto mt-10">
          <div class='grow w-2/3'>
            <div class='py-2 flex place-content-between border-b-2'>
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
              {previewType === "html" && (<button class='p-1 rounded-sm bg-blue-500 hover:bg-blue-400 text-white text-sm' onClick={() => parseTemplate(templateReplacements)}>
                Parse template
              </button>)}
              {previewType === "raw" && (<button class='p-1 rounded-sm bg-blue-500 hover:bg-blue-400 text-white text-sm' onClick={() => checkTemplate()}>
                Check template
              </button>)}
            </div>
            <div class='relative h-svh scrollbar-none'>
              <textarea
                ref={staticVariablesInput}
                class='w-full h-[50px] text-sm rounded-md border-1 font-mono pt-1 pl-1'
                style={{display: previewType === 'html' ? 'block' : 'none'}}
                value={staticVariables} onChange={handleConstantsChange}
              ></textarea>
              <TemplatePreview
                iframeRef={emailPreview}
                srcDoc={emailPreviewContent}
                className="w-full h-full"
                offsetElementRef={staticVariablesInput}
                onSet={setVariable}
                onClear={clearVariable}
                style={{display: previewType === "html" ? 'block': 'none'}}
              ></TemplatePreview>
              <textarea
                class='w-full font-mono text-sm text-pretty overflow-scroll'
                style={{display: previewType === "raw" ? 'block': 'none', height: '100%'}}
                value={templateOutput}
                onChange={(e) => setTemplateOutput(e.target.value)}
              ></textarea>
            </div>
          </div>
          <div class="w-1/3 flex flex-col gap-3">
            <div class='p-2 border-1 border-neutral-100 shadow-sm rounded-sm'>
              <h1 class='text-lg font-semibold'>Template attributes</h1>
              <form ref={templateAttributeForm} id='templateAttribute' class='flex flex-col gap-3 px-1 mt-2 '>
                <div class='flex flex-col gap-1'>
                  <label for="fromEmail" class='text-sm'>From email</label>
                  <input type="text" id="fromEmail" name="from_email" class='border-1 border-neutral-300 p-1' autocomplete='off' value={email.from_email} />
                </div>
                <div class='flex flex-col gap-1'>
                  <label for="name" class='text-sm'>Name</label>
                  <input type="text" id="name" name="subject" class='border-1 border-neutral-300 p-1' autocomplete='off' value={email.subject} />
                </div>
                <div class='flex flex-col gap-1'>
                  <label for="contentType" class='text-sm'>Content type</label>
                  <select id="contentType" name="content_type" class='border-1 border-neutral-300 p-1' value='text/html'>
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
              <button class='p-1 rounded-sm bg-gray-200 hover:bg-grey-100 text-black text-sm w-full' onClick={handleDryRun}>
                Dry run
              </button>
              <button class='p-1 rounded-sm bg-blue-500 hover:bg-blue-400 text-white text-sm w-full' onClick={handleCreate}>
                Create
              </button>
            </div>
            {dryRunResult && (
              <div class='p-2 border-1 border-neutral-100 shadow-sm rounded-sm'>
                <h1 class='text-lg font-semibold'>Dry run output</h1>
                {dryRunResult.error ? (
                  <div class='p-1 border-dashed border-1 border-red-300 bg-red-100 text-sm mt-2'>
                    {dryRunResult.error}
                  </div>
                ) : (
                  <pre class='p-2 border-1 border-neutral-200 rounded-sm text-sm bg-neutral-50 overflow-auto mt-2'>
                    {JSON.stringify(dryRunResult.data, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }
    </div>
  )
}
