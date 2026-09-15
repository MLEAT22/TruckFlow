import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import DashboardLayout from '../layouts/DashboardLayout'

function JobDetailPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [items, setItems] = useState([])
  const [materials, setMaterials] = useState([])
  const [mechanics, setMechanics] = useState([])

  const [desc, setDesc] = useState('')
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [mechanicId, setMechanicId] = useState('')
  const [source, setSource] = useState('driver_requested')

  const [matName, setMatName] = useState('')
  const [matPart, setMatPart] = useState('')
  const [matQty, setMatQty] = useState('')

  useEffect(() => { fetchAll() }, [jobId])

  async function fetchAll() {
    const { data: jobData } = await supabase.from('jobs').select('*, trucks(plate_number, make, model)').eq('id', jobId).single()
    setJob(jobData)
    const { data: itemData } = await supabase.from('job_items').select('*').eq('job_id', jobId).order('id')
    setItems(itemData || [])
    const { data: matData } = await supabase.from('material_requests').select('*').eq('job_id', jobId).order('id')
    setMaterials(matData || [])
    const { data: mechData } = await supabase.from('mechanics').select('id, name')
    setMechanics(mechData || [])
  }

  async function addItem(e) {
    e.preventDefault()
    const total = Number(qty) * Number(price)
    const { error } = await supabase.from('job_items').insert({
      job_id: jobId, description: desc, quantity: qty, unit_price: price,
      total_price: total, mechanic_id: mechanicId || null, source,
    })
    if (!error) { setDesc(''); setQty(''); setPrice(''); setMechanicId(''); fetchAll() }
    else alert(error.message)
  }

  async function deleteItem(id) {
    await supabase.from('job_items').delete().eq('id', id)
    fetchAll()
  }

  async function addMaterial(e) {
    e.preventDefault()
    const { error } = await supabase.from('material_requests').insert({
      job_id: jobId, item_name: matName, part_number: matPart, quantity: matQty, fulfilled_status: 'pending',
    })
    if (!error) { setMatName(''); setMatPart(''); setMatQty(''); fetchAll() }
    else alert(error.message)
  }

  async function toggleFulfilled(id, current) {
    await supabase.from('material_requests').update({ fulfilled_status: current === 'pending' ? 'delivered' : 'pending' }).eq('id', id)
    fetchAll()
  }

  async function markDateOut() {
    await supabase.from('jobs').update({ date_out: new Date().toISOString(), status: 'ready' }).eq('id', jobId)
    fetchAll()
  }

  const grandTotal = items.reduce((sum, i) => sum + Number(i.total_price), 0)

  if (!job) return <DashboardLayout><p>Loading...</p></DashboardLayout>

  return (
    <DashboardLayout>
      <button onClick={() => navigate('/repairs')} style={{ marginBottom: '16px' }}>← Back to Job Board</button>

      <div className="page-card">
        <h2>{job.trucks?.plate_number} — {job.trucks?.make} {job.trucks?.model}</h2>
        <p style={{ color: '#718096', fontSize: '13px', marginTop: '4px' }}>
  Driver: {job.driver_name} · In: {job.date_in?.split('T')[0]} · Out: {job.date_out ? job.date_out.split('T')[0] : 'still in garage'} · Payment: {invoice ? `${invoice.status} (ETB ${invoice.amount})` : 'No invoice yet'}
</p>
        {!job.date_out && <button className="btn-primary" style={{ marginTop: '12px' }} onClick={markDateOut}>Mark as Ready (set date out)</button>}
      </div>

      <div className="section-title second-section"><h2>Repairs (estimate list)</h2></div>
      <div className="page-card">
        <table className="data-table">
          <thead>
            <tr><th>#</th><th>Repair</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Mechanic</th><th>Source</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id}>
                <td>{i + 1}</td>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{item.unit_price}</td>
                <td>{item.total_price}</td>
                <td>{mechanics.find(m => m.id === item.mechanic_id)?.name || '—'}</td>
                <td>{item.source === 'driver_requested' ? 'Requested' : 'Found by mechanic'}</td>
                <td><button className="btn-delete" onClick={() => deleteItem(item.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: '14px', fontWeight: '700', fontSize: '16px' }}>Total: ETB {grandTotal.toFixed(2)}</p>

        <form onSubmit={addItem} style={{ marginTop: '20px' }}>
          <div className="form-grid">
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Repair description" required />
            <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Quantity" type="number" required />
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Unit price" type="number" required />
            <select value={mechanicId} onChange={(e) => setMechanicId(e.target.value)}>
              <option value="">Assign mechanic</option>
              {mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="driver_requested">Driver requested</option>
              <option value="mechanic_found">Mechanic found it</option>
            </select>
          </div>
          <button className="btn-primary" type="submit">Add Repair Line</button>
        </form>
      </div>

      <div className="section-title second-section"><h2>Material Requests</h2></div>
      <div className="page-card">
        <table className="data-table">
          <thead><tr><th>Material</th><th>Part #</th><th>Qty</th><th>Status</th></tr></thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id}>
                <td>{m.item_name}</td>
                <td>{m.part_number || '—'}</td>
                <td>{m.quantity}</td>
                <td>
                  <button className={m.fulfilled_status === 'pending' ? 'btn-edit' : 'btn-save'} onClick={() => toggleFulfilled(m.id, m.fulfilled_status)}>
                    {m.fulfilled_status}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={addMaterial} style={{ marginTop: '20px' }}>
          <div className="form-grid">
            <input value={matName} onChange={(e) => setMatName(e.target.value)} placeholder="Material type" required />
            <input value={matPart} onChange={(e) => setMatPart(e.target.value)} placeholder="Part number (optional)" />
            <input value={matQty} onChange={(e) => setMatQty(e.target.value)} placeholder="Quantity" type="number" required />
          </div>
          <button className="btn-primary" type="submit">Add Material Request</button>
        </form>
      </div>
    </DashboardLayout>
  )
}

export default JobDetailPage