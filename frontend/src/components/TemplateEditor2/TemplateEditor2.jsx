import { useEffect, useRef, useState } from 'preact/hooks';

const SELECTABLE_TAG_NAME = ['TD', 'SPAN', 'B', 'STRONG', 'I']

export function TemplateEditor2({ srcDoc, iframeRef, offsetElementRef, onSet, onClear, className, style }) {
  const [isPopoverVisible, setIsPopoverVisible] = useState(false)
  const [popOverForm, setPopoverForm] = useState({})
  const [targetRect, setTargetRect] = useState(null)

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

  const closePopover = () => {setIsPopoverVisible(false)}

  const handleLoaded = () => {
    const iframe = iframeRef.current
    if (!iframe) {return;}

    const docs = iframe.contentDocument || iframe.contentWindow.document;
    const body = docs.querySelector('body') || docs.querySelector('[role=article]')
    if (!body) { return; }
    docs.addEventListener('mousemove', (e) => {
      if (
        !SELECTABLE_TAG_NAME.includes(e.target.tagName) ||
        e.target.className.indexOf('overlay-current-inspect-element') >= 0 ||
        e.target.textContent.trim().length === 0 ||
        e.target.textContent.trim().length > 100
      ) {
        return
      }
      const targetRect = e.target.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();

      if (!e.target.hasAttribute('data-element-id')) {
        const targetId = Math.random().toString(36).slice(4,10)
        e.target.setAttribute('data-element-id', `${e.target.tagName}-${targetId}`)
      }

      if (docs.querySelector(`div[data-target-id=${e.target.getAttribute('data-element-id')}`)) { return }
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

  useEffect(() => {handleLoaded()}, [iframeRef])

  return (
    <>
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        className={className}
        style={style}
        onLoad={() => {handleLoaded()}}
      ></iframe>
      { isPopoverVisible &&
        <VariableAssignPopover
          form={popOverForm}
          targetRect={targetRect}
          offsetElementRef={offsetElementRef}
          onSet={(variableName) => {
            closePopover()
            onSet(variableName, popOverForm)
          }}
          onClear={() => {
            closePopover()
            onClear(popOverForm)
          }}
          onClose={closePopover}
        />
      }
    </>
  )
}

export function VariableAssignPopover({ form, targetRect, offsetElementRef, onSet, onClear, onClose }) {
  const popoverModal = useRef(null)
  const assignInput = useRef(null)
  const [popOverStyle, setPopoverStyle] = useState({
    display: 'block',
    position: 'absolute',
    backgroundColor: '#ffffff',
    maxWidth: '450px',
  })

  useEffect(() => { // position below the static variables input, then prefill + focus
    if (!targetRect || !popoverModal.current) {return;}
    const modalHeight = popoverModal.current.offsetHeight
    const offsetElementRect = offsetElementRef.current.getBoundingClientRect()
    setPopoverStyle((prev) => ({
      ...prev,
      top: targetRect.top - (modalHeight) + offsetElementRect.height,
      left: targetRect.left,
    }))
    if (form.originalTextContent) {
      assignInput.current.value = form.textContent
    }
    assignInput.current.focus()
  }, [form, targetRect])

  return (
    <div ref={popoverModal} style={popOverStyle} className="shadow-lg p-3">
      <div class='content p-3'>
        <div class='inspected-content text-sm'>
          {form.originalTextContent || form.textContent}
        </div>
        <div class='assign-block mt-2'>
          <form onSubmit={(e) => {e.preventDefault(); onSet(assignInput.current.value)}}>
            <input
              ref={assignInput}
              type='text'
              placeholder='Variable name'
              class='w-full p-1 text-sm border border-neutral-200 rounded-sm'
              autoFocus
            />
          </form>
        </div>
      </div>
      <div class='footer flex justify-between border-t border-solid border-t-neutral-100 pt-2 gap-1'>
        <div class='flex flex-1 gap-1'>
          <button
            onClick={() => onSet(assignInput.current.value)}
            className="p-1 rounded-sm bg-blue-500 hover:bg-blue-400 text-white text-sm">
              Set
          </button>
          {form.originalTextContent && <button
            onClick={onClear}
            className="p-1 rounded-sm bg-neutral-500 text-white text-sm">
              Clear
          </button>}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-sm bg-neutral-200 text-black text-sm">
            Close
        </button>
      </div>
    </div>
  )
}
