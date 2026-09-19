import { useEffect, useState } from 'preact/hooks';
import { Link } from 'wouter'
import { api } from '../api';
import { Layout2 } from '../components/Layout2';

export function Template2List() {
  const [templates, setTemplates] = useState(null)

  useEffect(() => { // hook on enter the screen
    const fetchTemplates = async () => {
      const response = await api.listTemplates()
      setTemplates(response.data || [])
    }
    fetchTemplates()
  }, [])

  const groupByFromEmail = (templates) => {
    const groups = new Map()
    for (const t of templates) {
      if (!groups.has(t.from_email)) {groups.set(t.from_email, [])}
      groups.get(t.from_email).push(t)
    }
    return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)))
  }

  return (
    <Layout2 title="Templates" breadcrumbs={[{label: 'Templates'}]}>
      <div class="size-full">
        {
        !templates ? (<div>...loading</div>) :
        (
          <div class='flex flex-col gap-4 h-full px-10 min-w-4xl max-w-8xl mx-auto'>
            {templates.length === 0 ? (<div>No templates yet</div>) : (
              [...groupByFromEmail(templates).entries()].map(([fromEmail, groupTemplates]) => (
                <div key={fromEmail} class='flex flex-col'>
                  <h2 class='text-base font-semibold'>{fromEmail}</h2>
                  {groupTemplates.map(t => (
                    <Link key={t.id} href={`/templates2/${t.id}`} class='p-2 border-b-1 border-neutral-300 hover:bg-neutral-200'>
                      <div class='flex place-content-between'>
                        <h1 class='text-md pl-3'>{t.subject ?? 'Any subject'}</h1>
                        <span class='text-sm text-neutral-500'>{t.priority ?? 'Auto'}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ))
            )}
          </div>
        )
      }
      </div>
    </Layout2>
  )
}
