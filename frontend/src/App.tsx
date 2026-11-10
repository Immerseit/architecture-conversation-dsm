import { useEffect, useState } from 'react'
import './App.css'
import { api } from './api'
import Canvases from './Canvases'

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
  isProtected?: boolean
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

function newDimensionKey() {
  return `dimension-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function App() {
  const [view, setView] = useState<'matrices' | 'canvases'>('matrices')
  const [matrices, setMatrices] = useState<Matrix[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [matrix, setMatrix] = useState<MatrixDetail | null>(null)
  const [newMatrixName, setNewMatrixName] = useState('')
  const [newMatrixKey, setNewMatrixKey] = useState('')
  const [matrixKey, setMatrixKey] = useState('')
  const matrixUrl = (id: string) => `/api/matrices/${id}?key=${encodeURIComponent(matrixKey)}`

  useEffect(() => {
    api<Matrix[]>(`/api/matrices?key=${encodeURIComponent(matrixKey)}`).then(setMatrices)
  }, [matrixKey])

  useEffect(() => {
    if (!selectedId) {
      setMatrix(null)
      return
    }
    api<MatrixDetail>(matrixUrl(selectedId)).then(setMatrix)
  }, [selectedId, matrixKey])

  async function createMatrix(e: React.FormEvent) {
    e.preventDefault()
    if (!newMatrixName.trim()) return
    const key = newMatrixKey.trim()
    const created = await api<Matrix>('/api/matrices', {
      method: 'POST',
      body: JSON.stringify({ name: newMatrixName, key: key || undefined }),
    })
    if (key) setMatrixKey(key)
    setMatrices((prev) => [...prev, created])
    setNewMatrixName('')
    setNewMatrixKey('')
    setSelectedId(created.id)
  }

  async function deleteMatrix(id: string) {
    await api(matrixUrl(id), { method: 'DELETE' })
    setMatrices((prev) => prev.filter((m) => m.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  async function refreshMatrix() {
    if (!selectedId) return
    setMatrix(await api<MatrixDetail>(matrixUrl(selectedId)))
  }

  async function saveManifest(value: string) {
    if (!matrix) return
    await api(`/api/matrices/${matrix.id}`, { method: 'PATCH', body: JSON.stringify({ manifest: value, key: matrixKey }) })
  }

  async function saveDimensions(dimensions: Dimension[]) {
    if (!matrix) return
    const updated = await api<Matrix>(`/api/matrices/${matrix.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ dimensions, key: matrixKey }),
    })
    setMatrix((current) => current ? { ...current, dimensions: updated.dimensions } : current)
    setMatrices((current) => current.map((item) => item.id === updated.id ? { ...item, dimensions: updated.dimensions } : item))
  }

  async function renameDimension(dimensionKey: string, name: string) {
    if (!matrix || !name.trim()) return
    await saveDimensions(matrix.dimensions.map((dimension) =>
      dimension.key === dimensionKey ? { ...dimension, name: name.trim() } : dimension,
    ))
  }

  async function changeDimensionDescription(dimensionKey: string, description: string) {
    if (!matrix) return
    await saveDimensions(matrix.dimensions.map((dimension) =>
      dimension.key === dimensionKey ? { ...dimension, description } : dimension,
    ))
  }

  async function changeDimension(dimensionKey: string, action: string) {
    if (!matrix) return
    const index = matrix.dimensions.findIndex((dimension) => dimension.key === dimensionKey)
    if (index < 0) return
    const dimensions = [...matrix.dimensions]
    const current = dimensions[index]
    const createDimension = (): Dimension => {
      const key = newDimensionKey()
      return { key, name: 'New column', description: '' }
    }

    if (action === 'add-right') dimensions.splice(index + 1, 0, createDimension())
    if (action === 'add-left') dimensions.splice(index, 0, createDimension())
    if (action === 'delete') {
      if (dimensions.length <= 1) return
      dimensions.splice(index, 1)
    }
    if (action === 'move-right' && index < dimensions.length - 1) {
      dimensions.splice(index, 2, dimensions[index + 1], current)
    }
    if (action === 'move-left' && index > 0) {
      dimensions.splice(index - 1, 2, current, dimensions[index - 1])
    }
    await saveDimensions(dimensions)
  }

  async function addStatement(level: string, dimensionKey: string, content: string, tags: string[]) {
    if (!matrix) return
    await api(`/api/matrices/${matrix.id}/statements`, {
      method: 'POST',
      body: JSON.stringify({ level, dimensionKey, content, tags, key: matrixKey }),
    })
    await refreshMatrix()
  }

  async function deleteStatement(id: string) {
    await api(`/api/statements/${id}?key=${encodeURIComponent(matrixKey)}`, { method: 'DELETE' })
    await refreshMatrix()
  }

  async function updateStatement(id: string, content: string, tags: string[]) {
    await api(`/api/statements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content, tags, key: matrixKey }),
    })
    await refreshMatrix()
  }

  async function addLink(fromStatementId: string, toStatementId: string) {
    if (!matrix || !toStatementId) return
    await api(`/api/matrices/${matrix.id}/links`, {
      method: 'POST',
      body: JSON.stringify({ fromStatementId, toStatementId, key: matrixKey }),
    })
    await refreshMatrix()
  }

  async function deleteLink(id: string) {
    await api(`/api/links/${id}?key=${encodeURIComponent(matrixKey)}`, { method: 'DELETE' })
    await refreshMatrix()
  }

  return (
    <main style={{ maxWidth: 1100, margin: '2rem auto', fontFamily: 'sans-serif', padding: '0 1rem' }}>
      <h1>DSM — Architecture Conversation Matrix</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #ccc' }}>
        <button
          onClick={() => setView('matrices')}
          style={{ fontWeight: view === 'matrices' ? 'bold' : 'normal', padding: '0.4rem 0.8rem' }}
        >
          Matrices
        </button>
        <button
          onClick={() => setView('canvases')}
          style={{ fontWeight: view === 'canvases' ? 'bold' : 'normal', padding: '0.4rem 0.8rem' }}
        >
          Canvases
        </button>
      </div>

      {view === 'canvases' && <Canvases />}

      {view === 'matrices' && (
        <>
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

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input
              type="password"
              value={matrixKey}
              onChange={(e) => setMatrixKey(e.target.value)}
              placeholder="Key for private matrices"
              style={{ flex: 1, padding: '0.5rem' }}
            />
            <button type="button" onClick={() => setMatrixKey(matrixKey.trim())}>Load matrices</button>
          </div>

          <form onSubmit={createMatrix} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <input
              value={newMatrixName}
              onChange={(e) => setNewMatrixName(e.target.value)}
              placeholder="Name for new matrix, e.g. Current Architecture"
              style={{ flex: 1, padding: '0.5rem' }}
            />
            <input
              type="password"
              value={newMatrixKey}
              onChange={(e) => setNewMatrixKey(e.target.value)}
              placeholder="Optional key"
              style={{ flex: 1, padding: '0.5rem' }}
            />
            <button type="submit">Create matrix</button>
          </form>

          {matrix && (
            <MatrixView
              matrix={matrix}
              onSaveManifest={saveManifest}
              onAddStatement={addStatement}
              onUpdateStatement={updateStatement}
              onDeleteStatement={deleteStatement}
              onAddLink={addLink}
              onDeleteLink={deleteLink}
              onDeleteMatrix={() => deleteMatrix(matrix.id)}
              onRenameDimension={renameDimension}
              onChangeDimensionDescription={changeDimensionDescription}
              onChangeDimension={changeDimension}
            />
          )}
        </>
      )}
    </main>
  )
}

function MatrixView({
  matrix,
  onSaveManifest,
  onAddStatement,
  onUpdateStatement,
  onDeleteStatement,
  onAddLink,
  onDeleteLink,
  onDeleteMatrix,
  onRenameDimension,
  onChangeDimensionDescription,
  onChangeDimension,
}: {
  matrix: MatrixDetail
  onSaveManifest: (value: string) => void
  onAddStatement: (level: string, dimensionKey: string, content: string, tags: string[]) => void
  onUpdateStatement: (id: string, content: string, tags: string[]) => void
  onDeleteStatement: (id: string) => void
  onAddLink: (fromId: string, toId: string) => void
  onDeleteLink: (id: string) => void
  onDeleteMatrix: () => void
  onRenameDimension: (dimensionKey: string, name: string) => void
  onChangeDimensionDescription: (dimensionKey: string, description: string) => void
  onChangeDimension: (dimensionKey: string, action: string) => void
}) {
  const [manifest, setManifest] = useState(matrix.manifest)
  const [addingCell, setAddingCell] = useState<{ level: string; dimensionKey: string } | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [draftTags, setDraftTags] = useState('')
  const [editingStatement, setEditingStatement] = useState<{ id: string; content: string; tags: string } | null>(null)
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

  function submitStatementEdit() {
    if (!editingStatement?.content.trim()) return
    const tags = editingStatement.tags.split(',').map((t) => t.trim()).filter(Boolean)
    onUpdateStatement(editingStatement.id, editingStatement.content, tags)
    setEditingStatement(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{matrix.name}</h2>
        <button onClick={onDeleteMatrix}>Delete matrix</button>
      </div>

      <textarea
        value={manifest}
        onChange={(e) => setManifest(e.target.value)}
        onBlur={() => onSaveManifest(manifest)}
        placeholder="Manifest — what does this conversation scope?"
        style={{ width: '100%', minHeight: '3rem', padding: '0.5rem', marginBottom: '1rem' }}
      />

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc' }}>
        <thead>
          <tr>
            <th style={{ width: 60 }}></th>
            {matrix.dimensions.map((d) => (
              <th key={d.key} style={{ border: '1px solid #ccc', padding: '0.5rem', background: '#f5f5f5' }}>
                <input
                  defaultValue={d.name}
                  onBlur={(e) => onRenameDimension(d.key, e.target.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                    padding: 0,
                  }}
                  aria-label={`Column name ${d.name}`}
                />
                <input
                  defaultValue={d.description}
                  onBlur={(e) => onChangeDimensionDescription(d.key, e.target.value)}
                  placeholder="Description"
                  aria-label={`Description for column ${d.name}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontWeight: 'normal',
                    fontSize: '0.8rem',
                    color: '#666',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                    padding: 0,
                  }}
                />
              </th>
            ))}
          </tr>
          <tr>
            <th style={{ border: '1px solid #ccc', padding: '0.3rem' }}>Column</th>
            {matrix.dimensions.map((d) => (
              <th key={`${d.key}-actions`} style={{ border: '1px solid #ccc', padding: '0.3rem' }}>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) onChangeDimension(d.key, e.target.value)
                    e.target.value = ''
                  }}
                  aria-label={`Action for column ${d.name}`}
                  style={{ width: '100%' }}
                >
                  <option value="">Select action</option>
                  <option value="add-right">New column to the right</option>
                  <option value="add-left">New column to the left</option>
                  <option value="delete">Delete column</option>
                  <option value="move-right">Move column right</option>
                  <option value="move-left">Move column left</option>
                </select>
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
                        {editingStatement?.id === s.id ? (
                          <div>
                            <textarea
                              autoFocus
                              value={editingStatement.content}
                              onChange={(e) => setEditingStatement({ ...editingStatement, content: e.target.value })}
                              style={{ width: '100%', fontSize: '0.8rem', marginBottom: '0.2rem' }}
                            />
                            <input
                              value={editingStatement.tags}
                              onChange={(e) => setEditingStatement({ ...editingStatement, tags: e.target.value })}
                              placeholder="tags, comma-separated"
                              style={{ width: '100%', fontSize: '0.75rem', marginBottom: '0.2rem' }}
                            />
                            <div style={{ display: 'flex', gap: '0.2rem' }}>
                              <button onClick={submitStatementEdit} style={{ fontSize: '0.7rem' }}>Save</button>
                              <button onClick={() => setEditingStatement(null)} style={{ fontSize: '0.7rem' }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div>{s.content}</div>
                        )}
                        {editingStatement?.id !== s.id && s.tags.map((t) => (
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
                                  remove link
                                </button>
                              </div>
                            )
                          })}

                        <div style={{ marginTop: '0.2rem', display: 'flex', gap: '0.2rem' }}>
                          {editingStatement?.id !== s.id && (
                            <button
                              onClick={() => setEditingStatement({ id: s.id, content: s.content, tags: s.tags.join(', ') })}
                              style={{ fontSize: '0.7rem' }}
                            >
                              edit
                            </button>
                          )}
                          <button onClick={() => onDeleteStatement(s.id)} style={{ fontSize: '0.7rem' }}>
                            delete
                          </button>
                          <button
                            onClick={() => setLinkingFrom(linkingFrom === s.id ? null : s.id)}
                            style={{ fontSize: '0.7rem' }}
                          >
                            link
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
                              Link to...
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
                          placeholder="Content..."
                          style={{ width: '100%', fontSize: '0.8rem', marginBottom: '0.2rem' }}
                        />
                        <input
                          value={draftTags}
                          onChange={(e) => setDraftTags(e.target.value)}
                          placeholder="tags, comma-separated"
                          style={{ width: '100%', fontSize: '0.75rem', marginBottom: '0.2rem' }}
                        />
                        <div style={{ display: 'flex', gap: '0.2rem' }}>
                          <button onClick={() => submitStatement(level, d.key)} style={{ fontSize: '0.75rem' }}>
                            Save
                          </button>
                          <button onClick={() => setAddingCell(null)} style={{ fontSize: '0.75rem' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingCell({ level, dimensionKey: d.key })}
                        style={{ fontSize: '0.75rem', width: '100%' }}
                      >
                        + Add
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
