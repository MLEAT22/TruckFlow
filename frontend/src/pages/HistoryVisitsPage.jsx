import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import DashboardLayout from '../layouts/DashboardLayout'

function HistoryVisitsPage() {
  const { plate } = useParams()
  const navigate = useNavigate()

  const decodedPlate = decodeURIComponent(plate)

  const [jobs, setJobs] = useState([])
  const [truck, setTruck] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchVisits()
  }, [plate])

  async function fetchVisits() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        trucks(
          plate_number,
          make,
          model
        )
      `)
      .eq('status', 'ready')
      .not('date_out', 'is', null)
      .order('date_out', { ascending: false })

    if (error) {
      console.error('Visit history error:', error)
      setError(error.message)
      setLoading(false)
      return
    }

    const matchingJobs = (data || []).filter(
      (job) =>
        job.trucks?.plate_number === decodedPlate
    )

    setJobs(matchingJobs)

    if (matchingJobs.length > 0) {
      setTruck(matchingJobs[0].trucks)
    }

    setLoading(false)
  }

  function formatDate(date) {
    if (!date) return '—'

    return new Date(date).toLocaleDateString(
      undefined,
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }
    )
  }

  return (
    <DashboardLayout>

      <div className="history-page">

        {/* BACK */}

        <button
          type="button"
          className="history-back-button"
          onClick={() => navigate('/history')}
        >
          ← Back to History
        </button>


        {/* HEADER */}

        <div className="history-header">

          <div>

            <span className="history-eyebrow">
              VEHICLE HISTORY
            </span>

            <h2>
              {decodedPlate}
            </h2>

            <p>
              {truck?.make || ''}
              {truck?.make && truck?.model
                ? ' '
                : ''}
              {truck?.model || ''}
            </p>

          </div>

          <div className="history-total">

            <span>Completed Visits</span>

            <strong>
              {jobs.length}
            </strong>

          </div>

        </div>


        {/* ERROR */}

        {error && (
          <div className="history-error">

            <strong>
              Unable to load visits
            </strong>

            <span>
              {error}
            </span>

          </div>
        )}


        {/* LOADING */}

        {loading && (
          <div className="page-card history-empty">

            <div className="history-spinner"></div>

            <p>
              Loading visits...
            </p>

          </div>
        )}


        {/* DATES */}

       <div className="history-dates">
  <div className="history-dates-title">
    Repair Visits
  </div>

  <div className="history-date-list">
    {vehicle.jobs.map((job) => (
      <Link
        key={job.id}
        to={`/history/${job.id}`}
        className="history-date-button"
      >
        <span>
          {formatDate(job.date_out)}
        </span>

        <span className="history-date-arrow">
          →
        </span>
      </Link>
    ))}
  </div>
</div>


        {!loading &&
          !error &&
          jobs.length === 0 && (

            <div className="page-card history-empty">

              <div className="history-empty-icon">
                ✓
              </div>

              <h3>
                No completed visits found
              </h3>

              <p>
                There are no completed jobs for this truck.
              </p>

            </div>
          )}

      </div>

    </DashboardLayout>
  )
}

export default HistoryVisitsPage