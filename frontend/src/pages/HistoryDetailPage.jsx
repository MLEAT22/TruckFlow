import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import DashboardLayout from '../layouts/DashboardLayout'

function HistoryDetailPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()

  const [job, setJob] = useState(null)
  const [items, setItems] = useState([])
  const [materials, setMaterials] = useState([])
  const [invoice, setInvoice] = useState(null)
  const [mechanics, setMechanics] = useState([])
  const [branch, setBranch] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (jobId) {
      fetchDetails()
    }
  }, [jobId])

  async function fetchDetails() {
    setLoading(true)
    setError('')

    try {

      // ------------------------------------------
      // JOB
      // ------------------------------------------

      const { data: jobData, error: jobError } =
        await supabase
          .from('jobs')
          .select(`
            *,
            trucks(
              plate_number,
              make,
              model,
              customer_id,
              customers(
                name,
                phone,
                company_name
              )
            )
          `)
          .eq('id', jobId)
          .single()

      if (jobError) {
        throw new Error(jobError.message)
      }

      setJob(jobData)


      // ------------------------------------------
      // REPAIRS
      // ------------------------------------------

      const { data: itemData, error: itemError } =
        await supabase
          .from('job_items')
          .select('*')
          .eq('job_id', jobId)
          .order('id', {
            ascending: true,
          })

      if (itemError) {
        console.error(
          'Repair items error:',
          itemError
        )
      }

      setItems(itemData || [])


      // ------------------------------------------
      // MATERIALS
      // ------------------------------------------

      const {
        data: materialData,
        error: materialError,
      } = await supabase
        .from('material_requests')
        .select('*')
        .eq('job_id', jobId)
        .order('id', {
          ascending: true,
        })

      if (materialError) {
        console.error(
          'Materials error:',
          materialError
        )
      }

      setMaterials(materialData || [])


      // ------------------------------------------
      // INVOICE
      // ------------------------------------------

      const {
        data: invoiceData,
        error: invoiceError,
      } = await supabase
        .from('invoices')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle()

      if (invoiceError) {
        console.error(
          'Invoice error:',
          invoiceError
        )
      }

      setInvoice(invoiceData || null)


      // ------------------------------------------
      // MECHANICS
      // ------------------------------------------

      const {
        data: mechanicData,
        error: mechanicError,
      } = await supabase
        .from('mechanics')
        .select('id, name')

      if (mechanicError) {
        console.error(
          'Mechanics error:',
          mechanicError
        )
      }

      setMechanics(mechanicData || [])


      // ------------------------------------------
      // BRANCH
      // ------------------------------------------

      if (jobData.branch_id) {

        const {
          data: branchData,
          error: branchError,
        } = await supabase
          .from('branches')
          .select('id, name, location')
          .eq('id', jobData.branch_id)
          .maybeSingle()

        if (branchError) {
          console.error(
            'Branch error:',
            branchError
          )
        }

        setBranch(branchData || null)
      }

    } catch (err) {

      console.error(
        'History detail error:',
        err
      )

      setError(
        err.message ||
        'Unable to load this job.'
      )
    }

    setLoading(false)
  }


  // ------------------------------------------
  // TOTAL
  // ------------------------------------------

  const grandTotal = items.reduce(
    (sum, item) =>
      sum + Number(item.total_price || 0),
    0
  )


  // ------------------------------------------
  // DATE
  // ------------------------------------------

  function formatDateTime(date) {

    if (!date) return '—'

    const value = new Date(date)

    if (Number.isNaN(value.getTime())) {
      return '—'
    }

    return value.toLocaleString(
      undefined,
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    )
  }


  function getMechanicName(id) {

    if (!id) return '—'

    return (
      mechanics.find(
        (mechanic) =>
          mechanic.id === id
      )?.name || '—'
    )
  }


  function getDuration() {

    if (!job?.date_in || !job?.date_out) {
      return '—'
    }

    const start =
      new Date(job.date_in)

    const end =
      new Date(job.date_out)

    const hours = Math.floor(
      (end - start) /
      (1000 * 60 * 60)
    )

    if (hours < 24) {
      return `${hours} hour${
        hours === 1 ? '' : 's'
      }`
    }

    const days =
      Math.floor(hours / 24)

    const remainingHours =
      hours % 24

    if (remainingHours === 0) {
      return `${days} day${
        days === 1 ? '' : 's'
      }`
    }

    return `${days}d ${remainingHours}h`
  }


  if (loading) {

    return (
      <DashboardLayout>

        <div className="page-card history-empty">

          <div className="history-spinner"></div>

          <p>
            Loading complete job record...
          </p>

        </div>

      </DashboardLayout>
    )
  }


  if (error || !job) {

    return (
      <DashboardLayout>

        <div className="history-page">

          <button
            className="history-back-button"
            onClick={() => navigate('/history')}
          >
            ← Back to History
          </button>

          <div className="history-error">

            <strong>
              Unable to load job
            </strong>

            <span>
              {error || 'Job not found.'}
            </span>

          </div>

        </div>

      </DashboardLayout>
    )
  }


  const truck = job.trucks
  const customer = truck?.customers

  const paid =
    String(invoice?.status || '')
      .toLowerCase()
      .trim() === 'paid'


  return (
    <DashboardLayout>

      <div className="history-detail-page">

        {/* BACK */}

        <button
          className="history-back-button"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>


        {/* HEADER */}

        <div className="history-detail-header">

          <div>

            <span className="history-eyebrow">
              COMPLETED JOB
            </span>

            <h2>
              {truck?.plate_number || '—'}
            </h2>

            <p>
              {truck?.make || ''}
              {truck?.make && truck?.model
                ? ' '
                : ''}
              {truck?.model || ''}
            </p>

          </div>

          <div className="history-detail-date">

            <span>
              Completed
            </span>

            <strong>
              {formatDateTime(job.date_out)}
            </strong>

          </div>

        </div>


        {/* TRUCK + CUSTOMER */}

        <div className="history-detail-grid">

          <div className="page-card history-detail-card">

            <div className="history-card-heading">

              <span className="history-card-icon">
                🚛
              </span>

              <div>
                <h3>Truck Information</h3>
                <p>Vehicle details</p>
              </div>

            </div>

            <div className="history-detail-fields">

              <div>
                <span>Plate Number</span>
                <strong>
                  {truck?.plate_number || '—'}
                </strong>
              </div>

              <div>
                <span>Make</span>
                <strong>
                  {truck?.make || '—'}
                </strong>
              </div>

              <div>
                <span>Model</span>
                <strong>
                  {truck?.model || '—'}
                </strong>
              </div>

            </div>

          </div>


          <div className="page-card history-detail-card">

            <div className="history-card-heading">

              <span className="history-card-icon">
                👤
              </span>

              <div>
                <h3>Customer</h3>
                <p>Customer information</p>
              </div>

            </div>

            <div className="history-detail-fields">

              <div>
                <span>Name</span>
                <strong>
                  {customer?.name || '—'}
                </strong>
              </div>

              <div>
                <span>Company</span>
                <strong>
                  {customer?.company_name || '—'}
                </strong>
              </div>

              <div>
                <span>Phone</span>
                <strong>
                  {customer?.phone || '—'}
                </strong>
              </div>

            </div>

          </div>

        </div>


        {/* JOB INFORMATION */}

        <div className="section-title second-section">

          <h2>
            Job Information
          </h2>

        </div>

        <div className="page-card history-detail-card">

          <div className="history-detail-fields">

            <div>
              <span>Driver</span>
              <strong>
                {job.driver_name || '—'}
              </strong>
            </div>

            <div>
              <span>Branch</span>
              <strong>
                {branch?.name || '—'}
              </strong>
            </div>

            <div>
              <span>Date In</span>
              <strong>
                {formatDateTime(job.date_in)}
              </strong>
            </div>

            <div>
              <span>Date Out</span>
              <strong>
                {formatDateTime(job.date_out)}
              </strong>
            </div>

            <div>
              <span>Time in Garage</span>
              <strong>
                {getDuration()}
              </strong>
            </div>

            <div>
              <span>Status</span>
              <strong className="history-status-completed">
                ✓ Completed
              </strong>
            </div>

          </div>

        </div>


        {/* REPAIRS */}

        <div className="section-title second-section">

          <h2>
            Repairs & Work Done
          </h2>

          <p>
            Work recorded during this visit
          </p>

        </div>

        <div className="page-card">

          {items.length === 0 ? (

            <div className="history-empty-small">
              No repair work recorded.
            </div>

          ) : (

            <div className="table-wrapper">

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
                  </tr>

                </thead>

                <tbody>

                  {items.map((item, index) => (

                    <tr key={item.id}>

                      <td>
                        {index + 1}
                      </td>

                      <td>
                        {item.description || '—'}
                      </td>

                      <td>
                        {item.quantity || 0}
                      </td>

                      <td>
                        ETB{' '}
                        {Number(
                          item.unit_price || 0
                        ).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </td>

                      <td>
                        <strong>
                          ETB{' '}
                          {Number(
                            item.total_price || 0
                          ).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </strong>
                      </td>

                      <td>
                        {getMechanicName(
                          item.mechanic_id
                        )}
                      </td>

                      <td>
                        {item.source ===
                        'driver_requested'
                          ? 'Driver requested'
                          : 'Mechanic found'}
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

          <div className="history-total-row">

            <span>
              Total Estimate
            </span>

            <strong>
              ETB{' '}
              {grandTotal.toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </strong>

          </div>

        </div>


        {/* MATERIALS */}

        <div className="section-title second-section">

          <h2>
            Material Requests
          </h2>

          <p>
            Materials requested during this visit
          </p>

        </div>

        <div className="page-card">

          {materials.length === 0 ? (

            <div className="history-empty-small">
              No material requests recorded.
            </div>

          ) : (

            <div className="table-wrapper">

              <table className="data-table">

                <thead>

                  <tr>
                    <th>Material</th>
                    <th>Part Number</th>
                    <th>Quantity</th>
                    <th>Status</th>
                  </tr>

                </thead>

                <tbody>

                  {materials.map((material) => {

                    const delivered =
                      String(
                        material.fulfilled_status || ''
                      )
                        .toLowerCase()
                        .trim() ===
                      'delivered'

                    return (

                      <tr key={material.id}>

                        <td>
                          {material.item_name || '—'}
                        </td>

                        <td>
                          {material.part_number || '—'}
                        </td>

                        <td>
                          {material.quantity || 0}
                        </td>

                        <td>

                          <span
                            className={
                              delivered
                                ? 'material-status delivered'
                                : 'material-status pending'
                            }
                          >
                            {delivered
                              ? '✓ Delivered'
                              : 'Waiting'}
                          </span>

                        </td>

                      </tr>

                    )
                  })}

                </tbody>

              </table>

            </div>

          )}

        </div>


        {/* PAYMENT */}

        <div className="section-title second-section">

          <h2>
            Payment
          </h2>

        </div>

        <div className="page-card history-payment-detail">

          <div className="history-payment-main">

            <div>

              <span>
                Invoice Amount
              </span>

              <strong>
                ETB{' '}
                {Number(
                  invoice?.amount ||
                  grandTotal ||
                  0
                ).toLocaleString(
                  undefined,
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
              </strong>

            </div>


            <div>

              <span>
                Payment Status
              </span>

              <span
                className={`history-payment ${
                  paid ? 'paid' : 'unpaid'
                }`}
              >
                {paid
                  ? '✓ Paid'
                  : 'Unpaid'}
              </span>

            </div>


            <div>

              <span>
                Paid Date
              </span>

              <strong>
                {invoice?.paid_date
                  ? formatDateTime(
                      invoice.paid_date
                    )
                  : '—'}
              </strong>

            </div>

          </div>

        </div>


        {/* BACK */}

        <div className="history-detail-footer">

          <button
            className="history-back-button"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>

        </div>

      </div>

    </DashboardLayout>
  )
}

export default HistoryDetailPage