import { useEffect, useState } from 'react'
import { api } from './api'

interface CanvasField {
  fieldKey: string
  label: string
  type: string
  required?: boolean
  min?: number
  max?: number
  step?: number
  format?: string
  enumValues?: string[]
  referencedCanvas?: string
  referencedCanvasName?: string
}

interface CanvasSection {
  sectionKey: string
  name: string
  description?: string
  cardinality: 'one' | 'many'
  fields: CanvasField[]
}

interface CanvasDefinition {
  codlVersion: string
  typeIri: string
  name: string
  sections: CanvasSection[]
}

interface CanvasType {
  key: string
  name: string
  sectionCount: number
}

interface CanvasInstance {
  id: string
  typeKey: string
  name: string
  values: Record<string, Record<string, unknown> | Record<string, unknown>[]>
  createdAt: string
}

type Values = CanvasInstance['values']

function FieldInput({ field, value, onChange }: { field: CanvasField; value: unknown; onChange: (v: unknown) => void }) {
  const common = { style: { width: '100%', padding: '0.3rem', fontSize: '0.85rem' } }

  if (field.type === 'longtext') {
    return <textarea {...common} rows={3} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
  }
  if (field.type === 'number') {
    return (
      <input
        {...common}
        type="number"
        min={field.min}
        max={field.max}
        value={(value as number) ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    )
  }
  if (field.type === 'slider') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="range"
          min={field.min ?? 0}
          max={field.max ?? 10}
          step={field.step ?? 1}
          value={(value as number) ?? field.min ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: '0.8rem', minWidth: 20 }}>{(value as number) ?? field.min ?? 0}</span>
      </div>
    )
  }
  if (field.type === 'enum') {
    return (
      <select {...common} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {field.enumValues?.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    )
  }
  return <input {...common} type="text" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
}

function SectionEditor({ section, values, onChange }: { section: CanvasSection; values: Values; onChange: (values: Values) => void }) {
  if (section.cardinality === 'one') {
    const row = (values[section.sectionKey] as Record<string, unknown>) ?? {}
    return (
      <div style={{ marginBottom: '0.8rem' }}>
        <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{section.name}</div>
        {section.description && <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.2rem' }}>{section.description}</div>}
        {section.fields.map((f) => (
          <div key={f.fieldKey} style={{ marginBottom: '0.3rem' }}>
            {section.fields.length > 1 && <label style={{ fontSize: '0.75rem', color: '#444' }}>{f.label}</label>}
            <FieldInput
              field={f}
              value={row[f.fieldKey]}
              onChange={(v) => onChange({ ...values, [section.sectionKey]: { ...row, [f.fieldKey]: v } })}
            />
            {f.referencedCanvas && (
              <div style={{ fontSize: '0.65rem', color: '#888' }}>refererar till: {f.referencedCanvasName}</div>
            )}
          </div>
        ))}
      </div>
    )
  }

  const rows = (values[section.sectionKey] as Record<string, unknown>[]) ?? []
  return (
    <div style={{ marginBottom: '0.8rem' }}>
      <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{section.name}</div>
      {section.description && <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.2rem' }}>{section.description}</div>}
      {rows.map((row, i) => (
        <div key={i} style={{ border: '1px solid #ddd', borderRadius: 4, padding: '0.3rem', marginBottom: '0.3rem' }}>
          {section.fields.map((f) => (
            <div key={f.fieldKey} style={{ marginBottom: '0.2rem' }}>
              {section.fields.length > 1 && <label style={{ fontSize: '0.75rem', color: '#444' }}>{f.label}</label>}
              <FieldInput
                field={f}
                value={row[f.fieldKey]}
                onChange={(v) => {
                  const next = [...rows]
                  next[i] = { ...row, [f.fieldKey]: v }
                  onChange({ ...values, [section.sectionKey]: next })
                }}
              />
            </div>
          ))}
          <button
            onClick={() => onChange({ ...values, [section.sectionKey]: rows.filter((_, idx) => idx !== i) })}
            style={{ fontSize: '0.7rem' }}
          >
            ta bort rad
          </button>
        </div>
      ))}
      <button onClick={() => onChange({ ...values, [section.sectionKey]: [...rows, {}] })} style={{ fontSize: '0.75rem' }}>
        + Lägg till {section.fields[0]?.label ?? 'rad'}
      </button>
    </div>
  )
}

export default function Canvases() {
  const [types, setTypes] = useState<CanvasType[]>([])
  const [selectedTypeKey, setSelectedTypeKey] = useState<string | null>(null)
  const [definition, setDefinition] = useState<CanvasDefinition | null>(null)
  const [instances, setInstances] = useState<CanvasInstance[]>([])
  const [editing, setEditing] = useState<{ id: string | null; name: string; values: Values } | null>(null)

  useEffect(() => {
    api<CanvasType[]>('/api/canvas-types').then(setTypes)
  }, [])

  useEffect(() => {
    if (!selectedTypeKey) return
    api<CanvasDefinition>(`/api/canvas-types/${selectedTypeKey}`).then(setDefinition)
    api<CanvasInstance[]>(`/api/canvas-instances?typeKey=${selectedTypeKey}`).then(setInstances)
    setEditing(null)
  }, [selectedTypeKey])

  async function refreshInstances() {
    if (!selectedTypeKey) return
    setInstances(await api<CanvasInstance[]>(`/api/canvas-instances?typeKey=${selectedTypeKey}`))
  }

  async function save() {
    if (!editing || !selectedTypeKey) return
    if (editing.id) {
      await api(`/api/canvas-instances/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editing.name, values: editing.values }),
      })
    } else {
      await api('/api/canvas-instances', {
        method: 'POST',
        body: JSON.stringify({ typeKey: selectedTypeKey, name: editing.name, values: editing.values }),
      })
    }
    setEditing(null)
    await refreshInstances()
  }

  async function remove(id: string) {
    await api(`/api/canvas-instances/${id}`, { method: 'DELETE' })
    await refreshInstances()
    if (editing?.id === id) setEditing(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {types.map((t) => (
          <button
            key={t.key}
            onClick={() => setSelectedTypeKey(t.key)}
            style={{ fontWeight: t.key === selectedTypeKey ? 'bold' : 'normal' }}
          >
            {t.name} ({t.sectionCount} sektioner)
          </button>
        ))}
      </div>

      {definition && (
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div style={{ minWidth: 220 }}>
            <h3>{definition.name}</h3>
            <button onClick={() => setEditing({ id: null, name: '', values: {} })} style={{ marginBottom: '0.5rem' }}>
              + Ny {definition.name}
            </button>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {instances.map((inst) => (
                <li key={inst.id} style={{ marginBottom: '0.3rem' }}>
                  <button onClick={() => setEditing({ id: inst.id, name: inst.name, values: inst.values })}>{inst.name}</button>{' '}
                  <button onClick={() => remove(inst.id)} style={{ fontSize: '0.7rem' }}>
                    ta bort
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {editing && (
            <div style={{ flex: 1, maxWidth: 600 }}>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Namn på den här instansen"
                style={{ width: '100%', padding: '0.4rem', marginBottom: '0.8rem', fontWeight: 'bold' }}
              />
              {definition.sections.map((s) => (
                <SectionEditor
                  key={s.sectionKey}
                  section={s}
                  values={editing.values}
                  onChange={(values) => setEditing({ ...editing, values })}
                />
              ))}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={save} disabled={!editing.name.trim()}>
                  Spara
                </button>
                <button onClick={() => setEditing(null)}>Avbryt</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
