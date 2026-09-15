import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import DashboardLayout from '../layouts/DashboardLayout'

function VehicleHistoryPage() {
  const { plate } = useParams()

  const [jobs, setJobs] = useState([])
  const [truck, setTruck] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchVehicleHistory()
  }, [plate])

  async function fetchVehicleHistory() {
    setLoading(true)
    setError('')

    const decodedPlate = decodeURIComponent(plate)

    // Find the truck
    const { data: truckData, error: truckError } = await supabase
      .from('trucks')
      .select('id, plate_number, make, model')
      .eq('plate_number', decodedPlate)
      .maybeSingle()

    if (truckError || !truckData) {
      setError('Could not find this vehicle.')
      setLoading(false)
      return
    }

    setTruck(truckData)

    // Find every completed visit for this truck
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('truck_id', truckData.id)
      .not('date_out', 'is', null)
      .order('date_out', { ascending: false })

    if (jobError) {
      console.error('Vehicle history error:', jobError)
      setError('Could not load this vehicle history.')
      setLoading(false)
      return
    }

    setJobs(jobData || [])
    setLoading(false)
  }

  function formatDate(date) {
    if (!date) return '—'

    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  function getDuration(job) {
    if (!job.date_in || !job.date_out) return '—'

    const start = new Date(job.date_in)
    const end = new Date(job.date_out)

    const hours = Math.round((end - start) / (1000 * 60 * 60))

    if (hours < 24) {
      return `${hours} hour${hours === 1 ? '' : 's'}`
    }

    const days = Math.floor(hours / 24)
    return `${days} day${days === 1 ? '' : 's'}`
  }

  return (
    <DashboardLayout>

      <div className="vehicle-history-page">

        <Link
          to="/history"
          className="history-back-button"
        >
          ← Back to Vehicle History
        </Link>

        {loading && (
          <div className="page-card history-empty">
            <p>Loading vehicle history...</p>
          </div>
        )}

        {!loading && error && (
          <div className="page-card history-error">
            <strong>Unable to load vehicle</strong>
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && truck && (
          <>
            {/* VEHICLE HEADER */}

            <div className="page-card vehicle-history-header">

              <div>
                <span className="history-eyebrow">
                  VEHICLE HISTORY
                </span>

                <h2>
                  {truck.plate_number}
                </h2>

                <p>
                  {truck.make || ''}{' '}
                  {truck.model || ''}
                </p>
              </div>

              <div className="vehicle-history-stat">
                <span>Completed Visits</span>
                <strong>{jobs.length}</strong>
              </div>

            </div>

            {/* VISITS */}

            <div className="section-title second-section">
              <h2>Repair Visits</h2>

              <p>
                Select a date to view the complete repair record.
              </p>
            </div>

            {jobs.length === 0 ? (

              <div className="page-card history-empty">
                <div className="history-empty-icon">
                  ✓
                </div>

                <h3>
                  No completed visits
                </h3>

                <p>
                  This vehicle has no completed repair visits yet.
                </p>
              </div>

            ) : (

              <div className="page-card">

                <div className="history-date-list">

                  {jobs.map((job) => (

                    <Link
                      key={job.id}
                      to={`/history/${job.id}`}
                      className="history-date-button"
                    >

                      <div>
                        <strong>
                          {formatDate(job.date_out)}
                        </strong>

                        <span>
                          {getDuration(job)}
                        </span>
                      </div>

                      <span className="history-date-arrow">
                        →
                      </span>

                    </Link>

                  ))}

                </div>

              </div>

            )}

          </>
        )}

      </div>

    </DashboardLayout>
  )
}

export default VehicleHistoryPage