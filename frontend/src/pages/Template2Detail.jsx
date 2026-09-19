import { useEffect, useState, useRef, useContext } from 'preact/hooks';
import { useParams, useLocation } from 'wouter'
import { api } from '../api';
import { ToastContext } from '../app';
import { Header2 } from '../components/Header2';

export function Template2Detail() {
  const params = useParams()
  const [, setLocation] = useLocation()
  const [pageTitle, setPageTitle] = useState('')
  const [template, setTemplate] = useState({id: null})

  const toast = useContext(ToastContext)
  const attributeForm = useRef(null)

  useEffect(() => { // hook on enter the screen
    const fetchTemplate = async () => {
      const response = await api.getTemplate(params.id)
      setTemplate(response.data)
    }
    fetchTemplate()
  }, [])

  useEffect(() => {
    if (!template.id) {return}
    setPageTitle(`${template.id}: ${template.from_email} - ${template.subject}`)
  }, [template])

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
      toast.success('Template updated')
    } catch (e) {
      toast.error('Failed to update: ' + e.message)
    }
  }

  return (
    <Header2 title={pageTitle}>
      <div class="size-full">
        {
        !template.id ? (<div>...loading</div>) :
        (
          <div class='flex flex-col gap-2 h-full px-10 min-w-4xl max-w-8xl mx-auto'>
            <div class='flex justify-end gap-2'>
              <button class='p-1 rounded-sm bg-neutral-200 text-black text-xs' onClick={() => setLocation(`/templates2/${template.id}/editor`)}>
                Edit template
              </button>
              <button class='p-1 rounded-sm bg-blue-500 hover:bg-blue-400 text-white text-xs' onClick={handleUpdate}>
                Save
              </button>
            </div>
            <div class='p-2 border-1 border-neutral-100 shadow-sm rounded-sm'>
              <h1 class='text-lg font-semibold'>Template attributes</h1>
              <form ref={attributeForm} class='flex flex-col gap-3 px-1 mt-2 '>
                <div class='flex flex-col gap-1'>
                  <label for="fromEmail" class='text-sm'>From email</label>
                  <input type="text" id="fromEmail" name="from_email" class='border-1 bg-neutral-200 border-neutral-300 p-1' disabled autocomplete='off' value={template.from_email} />
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
                {(template.fields || []).map(v => (
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
        )
      }
      </div>
    </Header2>
  )
}
