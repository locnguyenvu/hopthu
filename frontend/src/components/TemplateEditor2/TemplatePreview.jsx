import { useEffect, useRef, useState } from 'preact/hooks';

const SELECTABLE_TAG_NAME = ['TD', 'SPAN', 'B', 'STRONG', 'I']

export function TemplatePreview({ srcDoc, iframeRef, onElementClick, className, style }) {

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
        onElementClick({
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
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      className={className}
      style={style}
      onLoad={() => {handleLoaded()}}
    ></iframe>
  )
}
