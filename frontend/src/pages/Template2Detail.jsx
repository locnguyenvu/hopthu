import { useEffect, useState, useRef, useContext } from 'preact/hooks';
import { useParams, useLocation, Link } from 'wouter'
import { api } from '../api';
import { ToastContext } from '../app';
import { Layout2 } from '../components/Layout2';

export function Template2Detail() {
  const params = useParams()
  const [, setLocation] = useLocation()
  const [template, setTemplate] = useState({ id: null })
  const [triggers, setTriggers] = useState([])

  const toast = useContext(ToastContext)
  const attributeForm = useRef(null)

  useEffect(() => { // hook on enter the screen
    const fetchTemplate = async () => {
      const response = await api.getTemplate(params.id)
      setTemplate(response.data)
    }
    const fetchTriggers = async () => {
      const response = await api.listTriggers({ template_id: params.id })
      setTriggers(response.data || [])
    }
    fetchTemplate()
    fetchTriggers()
  }, [])

  useEffect(() => {
    if (!template.id) { return }
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
    <Layout2
      title='Templates'
      breadcrumbs={[
        { label: 'Templates', href: '/templates2' },
        { label: `id: ${template.id}` },
      ]}
    >
      <div class="size-full">
        {
          !template.id ? (<div>...loading</div>) :
            (
              <div class='flex flex-col gap-2 h-full px-10 min-w-4xl max-w-8xl mx-auto'>
                <div class='flex justify-end gap-2'>
                  <button class='p-1 px-2 rounded-sm bg-neutral-200 text-black text-xs' onClick={() => setLocation(`/templates2/${template.id}/editor`)}>
                    Edit template
                  </button>
                  <button class='p-1 px-2 rounded-sm bg-blue-500 hover:bg-blue-400 text-white text-xs' onClick={handleUpdate}>
                    Save
                  </button>
                </div>
                <div class='p-3 border-1 border-neutral-100 shadow-sm rounded-sm'>
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
                      <select id="contentType" name="content_type" class='border-1 bg-neutral-200 border-neutral-300 p-1' value={template.content_type} disabled>
                        <option value="text/html">text/html</option>
                        <option value="text/plain">text/plain</option>
                      </select>
                    </div>
                  </form>
                </div>
                <div class='p-3 border-1 border-neutral-100 shadow-sm rounded-sm'>
                  <h1 class='text-lg font-semibold'>Triggers</h1>
                  {
                    triggers.length === 0 ? (
                      <p class='text-sm text-neutral-500 mt-2'>No triggers attached to this template.</p>
                    ) : (
                      <div class='flex gap-2 mt-2'>
                        {triggers.map((trigger) => (
                          <div
                            key={trigger.id}
                            class='cursor-default shadow-sm p-2'
                            onClick={() => { setLocation(`/triggers/${trigger.id}`) }}
                          >
                            <div class='flex items-center justify-between gap-2' >
                              <span class='text-black'>{trigger.connection_name || `Connection #${trigger.connection_id}`}</span>
                              <span class={`p-1 px-2 rounded-sm text-xs ${trigger.is_active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'}`}>
                                {trigger.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              </div>
            )
        }
      </div>
    </Layout2>
  )
}
