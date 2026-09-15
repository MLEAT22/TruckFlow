import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import DashboardLayout from '../layouts/DashboardLayout'

function HistoryPage() {
  const [jobs, setJobs] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchHistory()
  }, [])

  async function fetchHistory() {
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
      console.error('History error:', error)
      setError(error.message)
      setLoading(false)
      return
    }

    setJobs(data || [])
    setLoading(false)
  }

  // Group jobs by plate number
  const groupedTrucks = {}

  jobs.forEach((job) => {
    const plate = job.trucks?.plate_number || 'Unknown'

    if (!groupedTrucks[plate]) {
      groupedTrucks[plate] = {
        plate,
        make: job.trucks?.make || '',
        model: job.trucks?.model || '',
        jobs: [],
      }
    }

    groupedTrucks[plate].jobs.push(job)
  })

  const trucks = Object.values(groupedTrucks)

  const filteredTrucks = trucks.filter((truck) => {
    const query = search.trim().toLowerCase()

    if (!query) return true

    return (
      truck.plate.toLowerCase().includes(query) ||
      truck.make.toLowerCase().includes(query) ||
      truck.model.toLowerCase().includes(query)
    )
  })

  return (
    <DashboardLayout>

      <div className="history-page">

        {/* HEADER */}

        <div className="history-header">

          <div>
            <span className="history-eyebrow">
              GARAGE RECORDS
            </span>

            <h2>Job History</h2>

            <p>
              Select a truck to view its previous visits.
            </p>
          </div>

          <div className="history-total">

            <span>Trucks in History</span>

            <strong>
              {trucks.length}
            </strong>

          </div>

        </div>


        {/* SEARCH */}

        <div className="page-card history-search-card">

          <div className="history-search">

            <div className="history-search-icon">
              ⌕
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by plate number, make or model..."
            />

            {search && (
              <button
                type="button"
                className="history-clear"
                onClick={() => setSearch('')}
              >
                Clear
              </button>
            )}

          </div>

        </div>


        {/* ERROR */}

        {error && (
          <div className="history-error">

            <strong>
              Unable to load history
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
              Loading vehicle history...
            </p>

          </div>
        )}


        {/* EMPTY */}

        {!loading &&
          !error &&
          filteredTrucks.length === 0 && (

            <div className="page-card history-empty">

              <div className="history-empty-icon">
                ✓
              </div>

              <h3>
                {search
                  ? 'No matching trucks'
                  : 'No completed jobs yet'}
              </h3>

              <p>
                {search
                  ? 'Try another plate number.'
                  : 'Completed jobs will appear here automatically.'}
              </p>

            </div>
          )}


        {/* TRUCK LIST */}

        {!loading &&
          !error &&
          filteredTrucks.length > 0 && (

            <div className="history-list">

              {filteredTrucks.map((truck) => (

                <Link
                  key={truck.plate}
                  to={`/history/truck/${encodeURIComponent(
                    truck.plate
                  )}`}
                  className="history-job-card"
                >

                  {/* TRUCK */}

                  <div className="history-job-main">

                    <div className="history-plate">
                      {truck.plate}
                    </div>

                    <div className="history-truck">

                      {truck.make}

                      {truck.make && truck.model
                        ? ' '
                        : ''}

                      {truck.model}

                    </div>

                  </div>


                  {/* VISITS */}

                  <div className="history-job-info">

                    <div className="history-info-item">

                      <span>
                        Completed visits
                      </span>

                      <strong>
                        {truck.jobs.length}
                      </strong>

                    </div>

                    <div className="history-info-item">

                      <span>
                        Most recent
                      </span>

                      <strong>
                        {new Date(
                          truck.jobs[0].date_out
                        ).toLocaleDateString(
                          undefined,
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }
                        )}
                      </strong>

                    </div>

                  </div>


                  {/* VIEW */}

                  <div className="history-job-payment">

                    <span className="history-payment paid">
                      Completed
                    </span>

                    <span className="history-view">
                      View visits →
                    </span>

                  </div>

                </Link>

              ))}

            </div>
          )}

      </div>

    </DashboardLayout>
  )
}

export default HistoryPage