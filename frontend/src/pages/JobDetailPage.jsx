import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import DashboardLayout from '../layouts/DashboardLayout'

function JobDetailPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()

  // =========================
  // DATA
  // =========================
  const [job, setJob] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [items, setItems] = useState([])
  const [materials, setMaterials] = useState([])
  const [mechanics, setMechanics] = useState([])

  // =========================
  // REPAIR FORM
  // =========================
  const [desc, setDesc] = useState('')
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [mechanicId, setMechanicId] = useState('')
  const [source, setSource] = useState('driver_requested')

  // =========================
  // MATERIAL FORM
  // =========================
  const [matName, setMatName] = useState('')
  const [matPart, setMatPart] = useState('')
  const [matQty, setMatQty] = useState('')

  // =========================
  // LOAD EVERYTHING
  // =========================
  useEffect(() => {
    if (jobId) {
      fetchAll()
    }
  }, [jobId])

  async function fetchAll() {
    // -------------------------
    // Load job
    // -------------------------
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('*, trucks(plate_number, make, model)')
      .eq('id', jobId)
      .single()

    if (jobError) {
      console.error('Job loading error:', jobError)
      return
    }

    setJob(jobData)

    // -------------------------
    // Load repair / estimate items
    // -------------------------
    const { data: itemData, error: itemError } = await supabase
      .from('job_items')
      .select('*')
      .eq('job_id', jobId)
      .order('id')

    if (itemError) {
      console.error('Job items loading error:', itemError)
    }

    setItems(itemData || [])

    // -------------------------
    // Load material requests
    // -------------------------
    const { data: matData, error: matError } = await supabase
      .from('material_requests')
      .select('*')
      .eq('job_id', jobId)
      .order('id')

    if (matError) {
      console.error('Material requests loading error:', matError)
    }

    setMaterials(matData || [])

    // -------------------------
    // Load mechanics
    // -------------------------
    const { data: mechData, error: mechError } = await supabase
      .from('mechanics')
      .select('id, name')

    if (mechError) {
      console.error('Mechanics loading error:', mechError)
    }

    setMechanics(mechData || [])

    // -------------------------
    // Load invoice
    // -------------------------
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('job_id', jobId)
      .maybeSingle()

    if (invoiceError) {
      console.error('Invoice loading error:', invoiceError)
    }

    setInvoice(invoiceData || null)
  }

  // =========================
  // ADD REPAIR / ESTIMATE ITEM
  // =========================
  async function addItem(e) {
    e.preventDefault()

    const quantity = Number(qty)
    const unitPrice = Number(price)
    const total = quantity * unitPrice

    const { error } = await supabase
      .from('job_items')
      .insert({
        job_id: jobId,
        description: desc,
        quantity,
        unit_price: unitPrice,
        total_price: total,
        mechanic_id: mechanicId || null,
        source,
      })

    if (error) {
      alert(`Could not add repair: ${error.message}`)
      return
    }

    setDesc('')
    setQty('')
    setPrice('')
    setMechanicId('')
    setSource('driver_requested')

    await fetchAll()
  }

  // =========================
  // DELETE REPAIR ITEM
  // =========================
  async function deleteItem(id) {
    const confirmed = window.confirm(
      'Remove this repair/estimate item?'
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('job_items')
      .delete()
      .eq('id', id)

    if (error) {
      alert(`Could not remove repair: ${error.message}`)
      return
    }

    await fetchAll()
  }

  // =========================
  // ADD MATERIAL REQUEST
  // =========================
  async function addMaterial(e) {
    e.preventDefault()

    const quantity = Number(matQty)

    if (!matName.trim()) {
      alert('Please enter the material name.')
      return
    }

    if (!quantity || quantity <= 0) {
      alert('Please enter a valid quantity.')
      return
    }

    const { error } = await supabase
      .from('material_requests')
      .insert({
        job_id: jobId,
        item_name: matName.trim(),
        part_number: matPart.trim() || null,
        quantity,
        fulfilled_status: 'pending',
      })

    if (error) {
      alert(`Could not add material request: ${error.message}`)
      return
    }

    setMatName('')
    setMatPart('')
    setMatQty('')

    await fetchAll()
  }

  // =========================
  // TOGGLE MATERIAL DELIVERED
  // =========================
  async function toggleFulfilled(id, currentStatus) {
    const current = String(currentStatus || '')
      .trim()
      .toLowerCase()

    const newStatus =
      current === 'delivered'
        ? 'pending'
        : 'delivered'

    const { error } = await supabase
      .from('material_requests')
      .update({
        fulfilled_status: newStatus,
      })
      .eq('id', id)

    if (error) {
      alert(`Could not update material status: ${error.message}`)
      return
    }

    await fetchAll()
  }

  // =========================
  // MARK JOB AS READY
  // =========================
  async function markDateOut() {
    const grandTotal = items.reduce(
      (sum, item) =>
        sum + Number(item.total_price || 0),
      0
    )

    const now = new Date().toISOString()

    // -------------------------
    // Mark job as ready
    // -------------------------
    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        date_out: now,
        status: 'ready',
      })
      .eq('id', jobId)

    if (jobError) {
      alert(
        `Could not mark job as ready: ${jobError.message}`
      )
      return
    }

    // -------------------------
    // Check if invoice exists
    // -------------------------
    const {
      data: existingInvoice,
      error: invoiceCheckError,
    } = await supabase
      .from('invoices')
      .select('*')
      .eq('job_id', jobId)
      .maybeSingle()

    if (invoiceCheckError) {
      alert(
        `Could not check invoice: ${invoiceCheckError.message}`
      )
      return
    }

    // -------------------------
    // Update existing invoice
    // -------------------------
    if (existingInvoice) {
      const { error } = await supabase
        .from('invoices')
        .update({
          amount: grandTotal,
        })
        .eq('id', existingInvoice.id)

      if (error) {
        alert(
          `Could not update invoice: ${error.message}`
        )
        return
      }
    }

    // -------------------------
    // Create new invoice
    // -------------------------
    else {
      const { error } = await supabase
        .from('invoices')
        .insert({
          job_id: jobId,
          amount: grandTotal,
          status: 'unpaid',
          paid_date: null,
        })

      if (error) {
        alert(
          `Could not create invoice: ${error.message}`
        )
        return
      }
    }

    await fetchAll()

    alert(
      'Job marked as ready and invoice created successfully.'
    )
  }

  // =========================
  // MARK INVOICE AS PAID
  // =========================
  async function markAsPaid() {
    if (!invoice) {
      alert(
        'There is no invoice for this job yet. Mark the job as ready first.'
      )
      return
    }

    if (invoice.status === 'paid') {
      alert('This invoice has already been paid.')
      return
    }

    const paidDate = new Date().toISOString()

    // -------------------------
    // 1. Mark invoice as paid
    // -------------------------
    const { error: invoiceError } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_date: paidDate,
      })
      .eq('id', invoice.id)

    if (invoiceError) {
      alert(
        `Could not mark invoice as paid: ${invoiceError.message}`
      )
      return
    }

    // -------------------------
    // 2. Check for existing
    //    Money In transaction
    // -------------------------
    const { data: existingTransaction, error: transactionCheckError } =
      await supabase
        .from('transactions')
        .select('id')
        .eq('job_id', String(job.id))
        .eq('type', 'in')
        .limit(1)
        .maybeSingle()

    if (transactionCheckError) {
      console.error(
        'Transaction check error:',
        transactionCheckError
      )

      alert(
        `Invoice was marked paid, but the Money In transaction could not be checked: ${transactionCheckError.message}`
      )

      await fetchAll()
      return
    }

    // -------------------------
    // 3. Create Money In
    // -------------------------
    if (!existingTransaction) {
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          job_id: String(job.id),
          amount: Number(invoice.amount || 0),
          type: 'in',
        })

      if (transactionError) {
        console.error(
          'Transaction creation error:',
          transactionError
        )

        alert(
          `Invoice was marked paid, but Money In could not be created: ${transactionError.message}`
        )

        await fetchAll()
        return
      }
    }

    // -------------------------
    // 4. Reload everything
    // -------------------------
    await fetchAll()

    alert(
      'Payment recorded successfully. The amount has been added to Money In and transaction history.'
    )
  }

  // =========================
  // TOTAL
  // =========================
  const grandTotal = items.reduce(
    (sum, item) =>
      sum + Number(item.total_price || 0),
    0
  )

  // =========================
  // MATERIAL COUNTS
  // =========================
  const pendingMaterials = materials.filter(
    (material) =>
      String(material.fulfilled_status || '')
        .trim()
        .toLowerCase() !== 'delivered'
  ).length

  const deliveredMaterials = materials.filter(
    (material) =>
      String(material.fulfilled_status || '')
        .trim()
        .toLowerCase() === 'delivered'
  ).length

  // =========================
  // LOADING
  // =========================
  if (!job) {
    return (
      <DashboardLayout>
        <div className="page-card">
          <p>Loading job details...</p>
        </div>
      </DashboardLayout>
    )
  }

  // =========================
  // PAGE
  // =========================
  return (
    <DashboardLayout>

      {/* =========================
          BACK BUTTON
      ========================= */}
      <button
        onClick={() => navigate('/repairs')}
        className="btn-cancel"
        style={{ marginBottom: '18px' }}
      >
        ← Back to Job Board
      </button>

      {/* =========================
          JOB HEADER
      ========================= */}
      <div className="page-card">

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '20px',
            flexWrap: 'wrap',
          }}
        >

          <div>

            <h2 style={{ marginBottom: '6px' }}>
              {job.trucks?.plate_number || '—'} —{' '}
              {job.trucks?.make || ''}{' '}
              {job.trucks?.model || ''}
            </h2>

            <p
              style={{
                color: '#718096',
                fontSize: '13px',
                lineHeight: '1.7',
              }}
            >

              <strong>Driver:</strong>{' '}
              {job.driver_name || '—'}

              <br />

              <strong>Date In:</strong>{' '}
              {job.date_in
                ? job.date_in.split('T')[0]
                : '—'}

              <br />

              <strong>Date Out:</strong>{' '}
              {job.date_out
                ? job.date_out.split('T')[0]
                : 'Still in garage'}

            </p>

          </div>

          <div>

            <span
              className={
                job.status === 'ready'
                  ? 'payment-status paid'
                  : 'payment-status unpaid'
              }
            >
              {job.status === 'ready'
                ? '✓ Ready'
                : 'In Progress'}
            </span>

          </div>

        </div>

        {!job.date_out && (
          <button
            className="btn-primary"
            style={{ marginTop: '16px' }}
            onClick={markDateOut}
          >
            Mark as Ready
          </button>
        )}

      </div>

      {/* =========================
          PAYMENT
      ========================= */}
      <div className="section-title second-section">

        <h2>Payment</h2>

        <p>
          Track the customer's payment for this job.
        </p>

      </div>

      <div className="page-card payment-card">

        <div className="payment-summary">

          <div>
            <span className="payment-label">
              Total Estimate
            </span>

            <strong className="payment-amount">
              ETB {grandTotal.toFixed(2)}
            </strong>
          </div>

          <div>
            <span className="payment-label">
              Payment Status
            </span>

            {invoice?.status === 'paid' ? (
              <span className="payment-status paid">
                ✓ Paid
              </span>
            ) : invoice ? (
              <span className="payment-status unpaid">
                Payment Pending
              </span>
            ) : (
              <span className="payment-status unpaid">
                No Invoice
              </span>
            )}
          </div>

          <div>
            <span className="payment-label">
              Invoice
            </span>

            <strong style={{ fontSize: '15px' }}>
              {invoice
                ? `ETB ${Number(
                    invoice.amount || 0
                  ).toFixed(2)}`
                : 'Not created'}
            </strong>
          </div>

        </div>

        {invoice?.status === 'paid' ? (

          <div className="paid-message">

            <strong>
              ✓ Payment received
            </strong>

            <span>
              Paid on{' '}
              {invoice.paid_date
                ? invoice.paid_date.split('T')[0]
                : '—'}
            </span>

          </div>

        ) : invoice ? (

          <button
            className="btn-primary payment-button"
            onClick={markAsPaid}
          >
            ✓ Mark as Paid
          </button>

        ) : (

          <p className="payment-note">
            Mark the job as ready first. An invoice
            will automatically be created using the
            estimate.
          </p>

        )}

      </div>

      {/* =========================
          REPAIRS / ESTIMATE
      ========================= */}
      <div className="section-title second-section">

        <h2>Repairs & Estimate</h2>

        <p>
          Add the repairs found or requested and
          calculate the estimated cost.
        </p>

      </div>

      <div className="page-card">

        <div style={{ overflowX: 'auto' }}>

          <table className="data-table">

            <thead>

              <tr>
                <th>#</th>
                <th>Repair</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
                <th>Mechanic</th>
                <th>Source</th>
                <th>Action</th>
              </tr>

            </thead>

            <tbody>

              {items.length === 0 ? (

                <tr>

                  <td
                    colSpan="8"
                    style={{
                      textAlign: 'center',
                      padding: '24px',
                      color: '#8a94a6',
                    }}
                  >
                    No repair items added yet.
                  </td>

                </tr>

              ) : (

                items.map((item, i) => (

                  <tr key={item.id}>

                    <td>{i + 1}</td>

                    <td>
                      {item.description}
                    </td>

                    <td>
                      {item.quantity}
                    </td>

                    <td>
                      ETB{' '}
                      {Number(
                        item.unit_price || 0
                      ).toFixed(2)}
                    </td>

                    <td>

                      <strong>
                        ETB{' '}
                        {Number(
                          item.total_price || 0
                        ).toFixed(2)}
                      </strong>

                    </td>

                    <td>

                      {mechanics.find(
                        (m) =>
                          m.id === item.mechanic_id
                      )?.name || '—'}

                    </td>

                    <td>

                      {item.source ===
                      'driver_requested'
                        ? 'Driver requested'
                        : 'Found by mechanic'}

                    </td>

                    <td>

                      <button
                        className="btn-delete"
                        onClick={() =>
                          deleteItem(item.id)
                        }
                      >
                        Remove
                      </button>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

        {/* TOTAL */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '18px',
            paddingTop: '16px',
            borderTop: '1px solid #edf0f5',
          }}
        >

          <div style={{ textAlign: 'right' }}>

            <span
              style={{
                display: 'block',
                color: '#718096',
                fontSize: '12px',
                marginBottom: '4px',
              }}
            >
              Estimated Total
            </span>

            <strong style={{ fontSize: '22px' }}>
              ETB {grandTotal.toFixed(2)}
            </strong>

          </div>

        </div>

        {/* ADD REPAIR */}

        <form
          onSubmit={addItem}
          style={{ marginTop: '24px' }}
        >

          <h3
            style={{
              marginBottom: '14px',
              fontSize: '15px',
            }}
          >
            Add Repair
          </h3>

          <div className="form-grid">

            <input
              value={desc}
              onChange={(e) =>
                setDesc(e.target.value)
              }
              placeholder="Repair description"
              required
            />

            <input
              value={qty}
              onChange={(e) =>
                setQty(e.target.value)
              }
              placeholder="Quantity"
              type="number"
              min="1"
              required
            />

            <input
              value={price}
              onChange={(e) =>
                setPrice(e.target.value)
              }
              placeholder="Unit price"
              type="number"
              min="0"
              step="0.01"
              required
            />

            <select
              value={mechanicId}
              onChange={(e) =>
                setMechanicId(e.target.value)
              }
            >

              <option value="">
                Assign mechanic
              </option>

              {mechanics.map((mechanic) => (

                <option
                  key={mechanic.id}
                  value={mechanic.id}
                >
                  {mechanic.name}
                </option>

              ))}

            </select>

            <select
              value={source}
              onChange={(e) =>
                setSource(e.target.value)
              }
            >

              <option value="driver_requested">
                Driver requested
              </option>

              <option value="mechanic_found">
                Found by mechanic
              </option>

            </select>

          </div>

          <button
            className="btn-primary"
            type="submit"
            style={{ marginTop: '14px' }}
          >
            + Add Repair Line
          </button>

        </form>

      </div>

      {/* =========================
          MATERIAL REQUESTS
      ========================= */}
      <div className="section-title second-section">

        <h2>Material Requests</h2>

        <p>
          Parts and materials needed to complete
          this job.
        </p>

      </div>

      <div className="page-card">

        {/* MATERIAL SUMMARY */}

        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '18px',
            flexWrap: 'wrap',
          }}
        >

          <div
            style={{
              padding: '10px 14px',
              background: '#fff4df',
              borderRadius: '10px',
              fontSize: '13px',
            }}
          >
            <strong>
              {pendingMaterials}
            </strong>{' '}
            waiting
          </div>

          <div
            style={{
              padding: '10px 14px',
              background: '#e9f8ef',
              borderRadius: '10px',
              fontSize: '13px',
            }}
          >
            <strong>
              {deliveredMaterials}
            </strong>{' '}
            delivered
          </div>

        </div>

        <div style={{ overflowX: 'auto' }}>

          <table className="data-table">

            <thead>

              <tr>
                <th>Material</th>
                <th>Part #</th>
                <th>Qty</th>
                <th>Status</th>
              </tr>

            </thead>

            <tbody>

              {materials.length === 0 ? (

                <tr>

                  <td
                    colSpan="4"
                    style={{
                      textAlign: 'center',
                      padding: '24px',
                      color: '#8a94a6',
                    }}
                  >
                    No material requests yet.
                  </td>

                </tr>

              ) : (

                materials.map((material) => {

                  const isDelivered =
                    String(
                      material.fulfilled_status || ''
                    )
                      .trim()
                      .toLowerCase() ===
                    'delivered'

                  return (

                    <tr key={material.id}>

                      <td>
                        {material.item_name}
                      </td>

                      <td>
                        {material.part_number || '—'}
                      </td>

                      <td>
                        {material.quantity}
                      </td>

                      <td>

                        <button
                          className={
                            isDelivered
                              ? 'btn-save'
                              : 'btn-edit'
                          }
                          onClick={() =>
                            toggleFulfilled(
                              material.id,
                              material.fulfilled_status
                            )
                          }
                        >
                          {isDelivered
                            ? '✓ Delivered'
                            : 'Mark Delivered'}
                        </button>

                      </td>

                    </tr>

                  )
                })

              )}

            </tbody>

          </table>

        </div>

        {/* ADD MATERIAL */}

        <form
          onSubmit={addMaterial}
          style={{ marginTop: '24px' }}
        >

          <h3
            style={{
              marginBottom: '14px',
              fontSize: '15px',
            }}
          >
            Request Material
          </h3>

          <div className="form-grid">

            <input
              value={matName}
              onChange={(e) =>
                setMatName(e.target.value)
              }
              placeholder="Material / part name"
              required
            />

            <input
              value={matPart}
              onChange={(e) =>
                setMatPart(e.target.value)
              }
              placeholder="Part number"
            />

            <input
              value={matQty}
              onChange={(e) =>
                setMatQty(e.target.value)
              }
              placeholder="Quantity"
              type="number"
              min="1"
              required
            />

          </div>

          <button
            className="btn-primary"
            type="submit"
            style={{ marginTop: '14px' }}
          >
            + Add Material Request
          </button>

        </form>

      </div>

    </DashboardLayout>
  )
}

export default JobDetailPage