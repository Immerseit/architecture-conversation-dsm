import { useEffect, useState } from 'react'
import './App.css'

interface Dimension {
  key: string
  name: string
  description: string
}

interface Matrix {
  id: string
  name: string
  manifest: string
  dimensions: Dimension[]
  createdAt: string
}

interface Statement {
  id: string
  matrixId: string
  level: 'N1' | 'N2' | 'N3' | 'N4'
  dimensionKey: string
  content: string
  tags: string[]
  createdAt: string
}

interface StatementLink {
  id: string
  matrixId: string
  fromStatementId: string
  toStatementId: string
  verb: string
}

interface MatrixDetail extends Matrix {
  statements: Statement[]
  links: StatementLink[]
}

const LEVELS = ['N1', 'N2', 'N3', 'N4'] as const

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

function App() {
  const [matrices, setMatrices] = useState<Matrix[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [matrix, setMatrix] = useState<MatrixDetail | null>(null)
  const [newMatrixName, setNewMatrixName] = useState('')

  useEffect(() => {
    api<Matrix[]>('/api/matrices').then(setMatrices)
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setMatrix(null)
      return
    }
    api<MatrixDetail>(`/api/matrices/${selectedId}`).then(setMatrix)
  }, [selectedId])

  async function createMatrix(e: React.FormEvent) {
    e.preventDefault()
    if (!newMatrixName.trim()) return
    const created = await api<Matrix>('/api/matrices', {
      method: 'POST',
      body: JSON.stringify({ name: newMatrixName }),
    })
    setMatrices((prev) => [...prev, created])
    setNewMatrixName('')
    setSelectedId(created.id)
  }

  async function deleteMatrix(id: string) {
    await api(`/api/matrices/${id}`, { method: 'DELETE' })
    setMatrices((prev) => prev.filter((m) => m.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  async function refreshMatrix() {
    if (!selectedId) return
    setMatrix(await api<MatrixDetail>(`/api/matrices/${selectedId}`))
  }

  async function saveManifest(value: string) {
    if (!matrix) return
    await api(`/api/matrices/${matrix.id}`, { method: 'PATCH', body: JSON.stringify({ manifest: value }) })
  }

  async function addStatement(level: string, dimensionKey: string, content: string, tags: string[]) {
    if (!matrix) return
    await api(`/api/matrices/${matrix.id}/statements`, {
      method: 'POST',
      body: JSON.stringify({ level, dimensionKey, content, tags }),
    })
    await refreshMatrix()
  }

  async function deleteStatement(id: string) {
    await api(`/api/statements/${id}`, { method: 'DELETE' })
    await refreshMatrix()
  }

  async function addLink(fromStatementId: string, toStatementId: string) {
    if (!matrix || !toStatementId) return
    await api(`/api/matrices/${matrix.id}/links`, {
      method: 'POST',
      body: JSON.stringify({ fromStatementId, toStatementId }),
    })
    await refreshMatrix()
  }

  async function deleteLink(id: string) {
    await api(`/api/links/${id}`, { method: 'DELETE' })
    await refreshMatrix()
  }

  return (
    <main style={{ maxWidth: 1100, margin: '2rem auto', fontFamily: 'sans-serif', padding: '0 1rem' }}>
      <h1>DSM — Architecture Conversation Matrix</h1>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {matrices.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedId(m.id)}
            style={{ fontWeight: m.id === selectedId ? 'bold' : 'normal' }}
          >
            {m.name}
          </button>
        ))}
      </div>

      <form onSubmit={createMatrix} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        <input
          value={newMatrixName}
          onChange={(e) => setNewMatrixName(e.target.value)}
          placeholder="Namn på ny matris, t.ex. Current Architecture"
          style={{ flex: 1, padding: '0.5rem' }}
        />
        <button type="submit">Skapa matris</button>
      </form>

      {matrix && (
        <MatrixView
          matrix={matrix}
          onSaveManifest={saveManifest}
          onAddStatement={addStatement}
          onDeleteStatement={deleteStatement}
          onAddLink={addLink}
          onDeleteLink={deleteLink}
          onDeleteMatrix={() => deleteMatrix(matrix.id)}
        />
      )}
    </main>
  )
}

function MatrixView({
  matrix,
  onSaveManifest,
  onAddStatement,
  onDeleteStatement,
  onAddLink,
  onDeleteLink,
  onDeleteMatrix,
}: {
  matrix: MatrixDetail
  onSaveManifest: (value: string) => void
  onAddStatement: (level: string, dimensionKey: string, content: string, tags: string[]) => void
  onDeleteStatement: (id: string) => void
  onAddLink: (fromId: string, toId: string) => void
  onDeleteLink: (id: string) => void
  onDeleteMatrix: () => void
}) {
  const [manifest, setManifest] = useState(matrix.manifest)
  const [addingCell, setAddingCell] = useState<{ level: string; dimensionKey: string } | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [draftTags, setDraftTags] = useState('')
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null)

  useEffect(() => setManifest(matrix.manifest), [matrix.id, matrix.manifest])

  function statementsAt(level: string, dimensionKey: string) {
    return matrix.statements.filter((s) => s.level === level && s.dimensionKey === dimensionKey)
  }

  function submitStatement(level: string, dimensionKey: string) {
    if (!draftContent.trim()) return
    const tags = draftTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    onAddStatement(level, dimensionKey, draftContent, tags)
    setDraftContent('')
    setDraftTags('')
    setAddingCell(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{matrix.name}</h2>
        <button onClick={onDeleteMatrix}>Ta bort matris</button>
      </div>

      <textarea
        value={manifest}
        onChange={(e) => setManifest(e.target.value)}
        onBlur={() => onSaveManifest(manifest)}
        placeholder="Manifest — vad scopar den här konversationen?"
        style={{ width: '100%', minHeight: '3rem', padding: '0.5rem', marginBottom: '1rem' }}
      />

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc' }}>
        <thead>
          <tr>
            <th style={{ width: 60 }}></th>
            {matrix.dimensions.map((d) => (
              <th key={d.key} style={{ border: '1px solid #ccc', padding: '0.5rem', background: '#f5f5f5' }}>
                <div>{d.name}</div>
                <div style={{ fontWeight: 'normal', fontSize: '0.8rem', color: '#666' }}>{d.description}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LEVELS.map((level) => (
            <tr key={level}>
              <td
                style={{
                  border: '1px solid #ccc',
                  padding: '0.5rem',
                  background: '#e0f0ee',
                  fontWeight: 'bold',
                  textAlign: 'center',
                }}
              >
                {level}
              </td>
              {matrix.dimensions.map((d) => {
                const cellStatements = statementsAt(level, d.key)
                const isAdding = addingCell?.level === level && addingCell?.dimensionKey === d.key
                return (
                  <td key={d.key} style={{ border: '1px solid #ccc', padding: '0.4rem', verticalAlign: 'top', minWidth: 160 }}>
                    {cellStatements.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          background: '#fff3cd',
                          border: '1px solid #e0c36a',
                          borderRadius: 4,
                          padding: '0.3rem',
                          marginBottom: '0.3rem',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div>{s.content}</div>
                        {s.tags.map((t) => (
                          <span
                            key={t}
                            style={{
                              display: 'inline-block',
                              background: '#f5c2c7',
                              borderRadius: 3,
                              padding: '0 4px',
                              fontSize: '0.7rem',
                              marginRight: 4,
                            }}
                          >
                            {t}
                          </span>
                        ))}

                        {matrix.links
                          .filter((l) => l.fromStatementId === s.id)
                          .map((l) => {
                            const target = matrix.statements.find((t) => t.id === l.toStatementId)
                            return (
                              <div key={l.id} style={{ fontSize: '0.7rem', color: '#555' }}>
                                → {target?.content ?? '?'}{' '}
                                <button onClick={() => onDeleteLink(l.id)} style={{ fontSize: '0.65rem' }}>
                                  ta bort länk
                                </button>
                              </div>
                            )
                          })}

                        <div style={{ marginTop: '0.2rem', display: 'flex', gap: '0.2rem' }}>
                          <button onClick={() => onDeleteStatement(s.id)} style={{ fontSize: '0.7rem' }}>
                            ta bort
                          </button>
                          <button
                            onClick={() => setLinkingFrom(linkingFrom === s.id ? null : s.id)}
                            style={{ fontSize: '0.7rem' }}
                          >
                            länka
                          </button>
                        </div>

                        {linkingFrom === s.id && (
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              onAddLink(s.id, e.target.value)
                              setLinkingFrom(null)
                            }}
                            style={{ marginTop: '0.2rem', width: '100%', fontSize: '0.7rem' }}
                          >
                            <option value="" disabled>
                              Länka till...
                            </option>
                            {matrix.statements
                              .filter((t) => t.id !== s.id)
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.level} {matrix.dimensions.find((d) => d.key === t.dimensionKey)?.name}: {t.content.slice(0, 30)}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                    ))}

                    {isAdding ? (
                      <div>
                        <textarea
                          autoFocus
                          value={draftContent}
                          onChange={(e) => setDraftContent(e.target.value)}
                          placeholder="Innehåll..."
                          style={{ width: '100%', fontSize: '0.8rem', marginBottom: '0.2rem' }}
                        />
                        <input
                          value={draftTags}
                          onChange={(e) => setDraftTags(e.target.value)}
                          placeholder="taggar, kommaseparerat"
                          style={{ width: '100%', fontSize: '0.75rem', marginBottom: '0.2rem' }}
                        />
                        <div style={{ display: 'flex', gap: '0.2rem' }}>
                          <button onClick={() => submitStatement(level, d.key)} style={{ fontSize: '0.75rem' }}>
                            Spara
                          </button>
                          <button onClick={() => setAddingCell(null)} style={{ fontSize: '0.75rem' }}>
                            Avbryt
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingCell({ level, dimensionKey: d.key })}
                        style={{ fontSize: '0.75rem', width: '100%' }}
                      >
                        + Lägg till
                      </button>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default App
