import { useEffect, useState, useRef } from 'preact/hooks';
import { useSearchParams } from 'wouter'
import { api } from '../api';

const SELECTABLE_TAG_NAME = ['TD', 'SPAN', 'B', 'STRONG', 'I']

let templateReplacements = {}

export function TemplateEditor2() {
  const [email, setEmail] = useState({
    id: null
  })
  const [emailPreviewContent, setEmailPreviewContent] = useState(null)
  const [isPopoverVisible, setIsPopoverVisible] = useState(false)
  const [popOverStyle, setPopoverStyle] = useState({
    display: 'block',
    position: 'absolute',
    backgroundColor: '#ffffff',
    maxWidth: '450px',
  })
  const [popOverForm, setPopoverForm] = useState({})
  const [templateOutput, setTemplateOutput] = useState('')
  const [searchParams, _] = useSearchParams()
  const [variables, setVariables] = useState([])
  const [targetRect, setTargetRect] = useState(null)

  const emailPreview = useRef(null)
  const popoverModal = useRef(null)
  const assignInput = useRef(null)


  useEffect(() => { // hook on enter the screen
    const emailId = searchParams.get('email_id')
    const fetchEmail = async () => {
      const response = await api.getEmail(emailId)
      setEmail(response.data)
      setEmailPreviewContent(response.data.body)
    }
    fetchEmail()
  }, [])


  useEffect(() => { // hook on the iframe element to trigger variable assign popover
    if (!isPopoverVisible || !targetRect || !popoverModal.current) {return;}
    const modalHeight = popoverModal.current.offsetHeight
    setPopoverStyle((prev) => ({
      ...prev,
      top: targetRect.top - (modalHeight),
      left: targetRect.left,
    }))
    if (popOverForm.originalTextContent) {
      assignInput.current.value = popOverForm.textContent
    }
    assignInput.current.focus()
  }, [popOverForm, isPopoverVisible, targetRect])

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

  const setVariable = async (e) => {
    const iframe = emailPreview.current
    if (!iframe) {return;}

    const docs = iframe.contentDocument || iframe.contentWindow.document;
    const targetElement = docs.querySelector(`[data-element-id=${popOverForm.targetId}]`)

    const replacedHtml = popOverForm.htmlContent.replace(popOverForm.textContent.trim(), assignInput.current.value)
    if (!(popOverForm.targetId in templateReplacements)) {
      templateReplacements[popOverForm.targetId] = [
        popOverForm.htmlContent,
        replacedHtml
      ]
    } else {
      templateReplacements[popOverForm.targetId][1] = replacedHtml
    }
    if (!targetElement.hasAttribute('data-original-content')) {
      targetElement.setAttribute('data-original-content', targetElement.innerText)
    }
    targetElement.innerText = assignInput.current.value

    assignInput.current.value = ''
    setIsPopoverVisible(false)
    await submit()
  }

  const clearVariable = async (e) => {
    const iframe = emailPreview.current
    if (!iframe) {return;}

    const docs = iframe.contentDocument || iframe.contentWindow.document;
    const targetElement = docs.querySelector(`[data-element-id=${popOverForm.targetId}]`)
    if (!targetElement.hasAttribute('data-original-content')) {
      return
    }
    targetElement.innerText = targetElement.getAttribute('data-original-content')
    targetElement.removeAttribute('data-original-content')
    delete templateReplacements[popOverForm.targetId]

    assignInput.current.value = ''
    setIsPopoverVisible(false)
    await submit()
  }

  const submit = async () => {
    let templateStr = email.body
    for (const [_, replacement] of Object.entries(templateReplacements)) {
      templateStr = templateStr.replace(...replacement)
    }
    setTemplateOutput(templateStr)
    const result = await api.extractTemplateFields({template: templateStr})
    setVariables(result.data)
  }

  const handleLoaded = () => {
    const iframe = emailPreview.current
    if (!iframe) {return;}

    const docs = iframe.contentDocument || iframe.contentWindow.document;
    const body = docs.querySelector('body') || docs.querySelector('[role=article]')
    docs.addEventListener('mousemove', (e) => {
      if (
        !SELECTABLE_TAG_NAME.includes(e.target.tagName) ||
        e.target.className.indexOf('overlay-current-inspect-element') >= 0 ||
        e.target.textContent.length > 1000
      ) {
        return
      }
      const targetRect = e.target.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();

      if (!e.target.hasAttribute('data-element-id')) {
        const targetId = Math.random().toString(36).slice(4,10)
        e.target.setAttribute('data-element-id', `${e.target.tagName}-${targetId}`)
      }

      let overlay = docs.createElement('div')
      overlay.setAttribute('data-target-id', e.target.getAttribute('data-element-id'))
      overlay.className = 'overlay-current-inspect-element'
      overlay.style.cssText = Object.entries({
        position: 'absolute',
        pointerEvents: 'none',
        zIndex: 10,
        border: '1px dashed rgba(37,99,235,0.35)',
        background: 'rgba(37,99,235,0.06)',
        borderRadius: '2px',
        transition: 'opacity 80ms ease',
        top: `${targetRect.top + Math.abs(bodyRect.top)}px`,
        left: `${targetRect.left}px`,
        width: `${targetRect.width}px`,
        height: `${targetRect.height}px`,
      }).map((v, _) => {return `${v[0]}:${v[1]}`}).join(";");
      docs.body.appendChild(overlay);
    })
    docs.addEventListener('mouseout', (e) => {
      if (e.target.className.indexOf('overlay-current-inspect-element') >= 0) {
        e.target.remove()
      }
    })
    docs.addEventListener('click', (e) => {
      if (e.target.className.indexOf('overlay-current-inspect-element') >= 0) {
        const targetBlock = docs.querySelector(`[data-element-id=${e.target.getAttribute('data-target-id')}]`)
        const originalBlock = targetBlock.cloneNode(true)
        originalBlock.removeAttribute('data-element-id')
        originalBlock.removeAttribute('data-original-content')
        openVariableAssignmentPopover({
          targetId: e.target.getAttribute('data-target-id'),
          targetRect: targetBlock.getBoundingClientRect(),
          htmlContent: originalBlock.outerHTML,
          textContent: targetBlock.textContent,
          originalTextContent: targetBlock.getAttribute('data-original-content')
        })
        e.target.remove()
      }
    })
  }

  return (
    <div class="size-screen">
      <div class='flex justify-between p-3'>
        <h1 class='grow text-ellipsis'>{email.subject}</h1>
      </div>
      <div class="flex gap-3 px-16 h-full">
        <div class='container mx-auto'>
            { email.id &&
              (
                <div class='relative h-dvh overflow-scroll'>
                  <iframe
                    ref={emailPreview}
                    srcDoc={emailPreviewContent}
                    class="w-full h-full"
                    onLoad={handleLoaded}
                  >
                  </iframe>
                  { isPopoverVisible &&
                    <div ref={popoverModal} style={popOverStyle} className="shadow-lg p-3">
                      <div class='content p-3'>
                        <div class='inspected-content text-sm'>
                          {popOverForm.originalTextContent || popOverForm.textContent}
                        </div>
                        <div class='assign-block mt-2'>
                          <input
                            ref={assignInput}
                            type='text'
                            placeholder='Variable name'
                            class='w-full p-1 text-sm border border-neutral-200 rounded-sm'
                          />
                        </div>
                      </div>
                      <div class='footer flex justify-between border-t border-solid border-t-neutral-100 pt-2 gap-1'>
                        <div class='flex flex-1 gap-1'>
                          <button
                            onClick={e => setVariable(e)}
                            className="p-1 rounded-sm bg-blue-500 hover:bg-blue-400 text-white text-sm">
                              Set
                          </button>
                          {popOverForm.originalTextContent && <button
                            onClick={e => clearVariable(e)}
                            className="p-1 rounded-sm bg-neutral-500 text-white text-sm">
                              Clear
                          </button>}
                        </div>
                        <button
                          onClick={e => setIsPopoverVisible(false)}
                          className="p-1 rounded-sm bg-neutral-200 text-black text-sm">
                            Close
                        </button>
                      </div>
                    </div>
                  }
                </div>
              )
            }
        </div>
        <div class="w-1/3 flex flex-col gap-3">
          <button class='p-1 rounded-sm bg-blue-500 hover:bg-blue-400 text-white text-sm' onClick={submit}>
            Submit
          </button>
          <div class='p-2 border-1 border-neutral-100 shadow-sm'>
            <h1 class='text-lg font-semibold'>Variables</h1>
            <div class='flex flex-col gap-1'>
              {variables.map(v => (
                <div class='p-1 border-dashed border-1 border-sky-300 bg-sky-100'>
                  <span class='font-mono'>{v.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
