import { useEffect, useRef, useState } from 'preact/hooks';

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
