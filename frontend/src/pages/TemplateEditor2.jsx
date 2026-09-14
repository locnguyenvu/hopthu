import { useEffect, useState, useRef } from 'preact/hooks';
import { useSearchParams } from 'wouter'
import { api } from '../api';
import { TemplatePreview } from '../components/TemplateEditor2/TemplatePreview';
import { VariableAssignPopover } from '../components/TemplateEditor2/VariableAssignPopover';

export function TemplateEditor2() {
  const [email, setEmail] = useState({
    id: null
  })
  const [emailPreviewContent, setEmailPreviewContent] = useState(null)
  const [isPopoverVisible, setIsPopoverVisible] = useState(false)
  const [popOverForm, setPopoverForm] = useState({})
  const [templateReplacements, setTemplateReplacements] = useState({})
  const [templateOutput, setTemplateOutput] = useState('')
  const [searchParams, _] = useSearchParams()
  const [variables, setVariables] = useState([])
  const [targetRect, setTargetRect] = useState(null)
  const [staticVariables, setStaticVariables] = useState('')
  const [previewType, setPreviewType] = useState('html')

  const emailPreview = useRef(null)
  const staticVariablesInput = useRef(null)


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

  const openVariableAssignmentPopover = (data) => {
    const {targetId, targetRect, textContent, htmlContent, originalTextContent} = data
    setTargetRect(targetRect)
    setPopoverForm({
      htmlContent,
      textContent,
      targetId,
      originalTextContent,
    })
    setIsPopoverVisible(true)
  }

  const setVariable = async (variableName) => {
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

    setIsPopoverVisible(false)
    await parseTemplate(updatedReplacements)
  }

  const handleConstantsChange = (e) => {
    setStaticVariables(e.target.value)
  }

  const clearVariable = async () => {
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

    setIsPopoverVisible(false)
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
              <button class='p-1 rounded-sm bg-blue-500 hover:bg-blue-400 text-white text-sm' onClick={() => parseTemplate(templateReplacements)}>
                Parse template
              </button>
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
                onElementClick={openVariableAssignmentPopover}
                style={{display: previewType === "html" ? 'block': 'none'}}
              ></TemplatePreview>
              <pre
                class="w-full font-mono text-pretty overflow-scroll"
                style={{display: previewType === "raw" ? 'block': 'none'}}
              >
                <code>{templateOutput || email.body}</code>
              </pre>
              { isPopoverVisible &&
                <VariableAssignPopover
                  form={popOverForm}
                  targetRect={targetRect}
                  offsetElementRef={staticVariablesInput}
                  onSet={setVariable}
                  onClear={clearVariable}
                  onClose={() => setIsPopoverVisible(false)}
                />
              }
            </div>
          </div>
          <div class="w-1/3 flex flex-col gap-3">
            <div class='p-2 border-1 border-neutral-100 shadow-sm rounded-sm'>
              <h1 class='text-lg font-semibold'>Attributes</h1>
              <div class='flex flex-col gap-3 px-1 mt-2 '>
                <div class='flex flex-col gap-1'>
                  <label for="fromEmail" class='text-sm'>From email</label>
                  <input type="text" id="fromEmail" class='border-1 border-neutral-300 p-1' autocomplete='off' value={email.from_email} />
                </div>
                <div class='flex flex-col gap-1'>
                  <label for="fromEmail" class='text-sm'>Name</label>
                  <input type="text" id="fromEmail" class='border-1 border-neutral-300 p-1' autocomplete='off' value={email.subject} />
                </div>
              </div>
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
          </div>
        </div>
      )
    }
    </div>
  )
}
