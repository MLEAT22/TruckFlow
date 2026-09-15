import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'

function ReportsPage() {
  const [period, setPeriod] = useState('weekly')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [transactions, setTransactions] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [jobs, setJobs] = useState([])
  const [materialRequests, setMaterialRequests] = useState([])
  const [branches, setBranches] = useState([])

  useEffect(() => {
    fetchReports()
  }, [period])

  function getPeriodDates() {
    const now = new Date()

    const end = new Date(now)
    end.setHours(23, 59, 59, 999)

    const start = new Date(now)

    if (period === 'weekly') {
      start.setDate(start.getDate() - 6)
    } else {
      start.setDate(1)
    }

    start.setHours(0, 0, 0, 0)

    return { start, end }
  }

  function toISOStringStart(date) {
    return date.toISOString()
  }

  async function fetchReports() {
    setLoading(true)
    setError('')

    const { start, end } = getPeriodDates()

    try {
      const [
        transactionsResult,
        bankAccountsResult,
        jobsResult,
        materialsResult,
        branchesResult,
      ] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .gte('date', toISOStringStart(start))
          .lte('date', toISOStringStart(end))
          .order('date', { ascending: false }),

        supabase
          .from('bank_accounts')
          .select('*'),

        supabase
          .from('jobs')
          .select(`
            *,
            trucks (
              id,
              plate_number,
              make,
              model
            ),
            branches (
              id,
              name
            )
          `)
          .order('date_in', { ascending: false }),

        supabase
          .from('material_requests')
          .select('*'),

        supabase
          .from('branches')
          .select('*'),
      ])

      if (transactionsResult.error) {
        console.error('Transactions error:', transactionsResult.error)
        throw new Error(transactionsResult.error.message)
      }

      if (bankAccountsResult.error) {
        console.error('Bank accounts error:', bankAccountsResult.error)
      }

      if (jobsResult.error) {
        console.error('Jobs error:', jobsResult.error)
        throw new Error(jobsResult.error.message)
      }

      if (materialsResult.error) {
        console.error('Materials error:', materialsResult.error)
      }

      if (branchesResult.error) {
        console.error('Branches error:', branchesResult.error)
      }

      setTransactions(transactionsResult.data || [])
      setBankAccounts(bankAccountsResult.data || [])
      setJobs(jobsResult.data || [])
      setMaterialRequests(materialsResult.data || [])
      setBranches(branchesResult.data || [])
    } catch (err) {
      console.error('Reports error:', err)
      setError(err.message || 'Could not load reports.')
    } finally {
      setLoading(false)
    }
  }

  const { start, end } = useMemo(() => getPeriodDates(), [period])

  const periodLabel = useMemo(() => {
    const startText = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })

    const endText = end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    return `${startText} – ${endText}`
  }, [start, end])

  function money(value) {
    return `ETB ${Number(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  function isWithinPeriod(dateValue) {
    if (!dateValue) return false

    const date = new Date(dateValue)
    return date >= start && date <= end
  }

  /*
   * ---------------------------------------------------------
   * FINANCE
   * ---------------------------------------------------------
   */

  const moneyIn = useMemo(() => {
    return transactions
      .filter((transaction) => transaction.type === 'in')
      .reduce((sum, transaction) => {
        return sum + Number(transaction.amount || 0)
      }, 0)
  }, [transactions])

  const moneyOut = useMemo(() => {
    return transactions
      .filter((transaction) => transaction.type === 'out')
      .reduce((sum, transaction) => {
        return sum + Number(transaction.amount || 0)
      }, 0)
  }, [transactions])

  const netCashFlow = moneyIn - moneyOut

  /*
   * CASH vs GARAGE
   *
   * Your database uses bank_accounts_id.
   */

  const cashAccount = useMemo(() => {
    return bankAccounts.find(
      (account) =>
        String(account.name || '').trim().toLowerCase() === 'cash'
    )
  }, [bankAccounts])

  const garageAccount = useMemo(() => {
    return bankAccounts.find(
      (account) =>
        String(account.name || '').trim().toLowerCase() === 'garage'
    )
  }, [bankAccounts])

  const cashBalance = useMemo(() => {
    if (!cashAccount) return 0

    return transactions
      .filter(
        (transaction) =>
          String(transaction.bank_accounts_id) === String(cashAccount.id)
      )
      .reduce((sum, transaction) => {
        const amount = Number(transaction.amount || 0)

        return transaction.type === 'in'
          ? sum + amount
          : sum - amount
      }, 0)
  }, [transactions, cashAccount])

  const garageBalance = useMemo(() => {
    if (!garageAccount) return 0

    return transactions
      .filter(
        (transaction) =>
          String(transaction.bank_accounts_id) === String(garageAccount.id)
      )
      .reduce((sum, transaction) => {
        const amount = Number(transaction.amount || 0)

        return transaction.type === 'in'
          ? sum + amount
          : sum - amount
      }, 0)
  }, [transactions, garageAccount])

  /*
   * ---------------------------------------------------------
   * JOBS
   * ---------------------------------------------------------
   */

  const completedJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (!job.date_out) return false
      return isWithinPeriod(job.date_out)
    })
  }, [jobs, start, end])

  const trucksServiced = useMemo(() => {
    const ids = new Set()

    completedJobs.forEach((job) => {
      if (job.truck_id) ids.add(job.truck_id)
    })

    return ids.size
  }, [completedJobs])

  /*
   * ---------------------------------------------------------
   * MATERIAL REQUESTS
   * ---------------------------------------------------------
   */

  const pendingMaterials = useMemo(() => {
    return materialRequests.filter(
      (material) =>
        material.fulfilled_status === 'pending'
    )
  }, [materialRequests])

  const deliveredMaterials = useMemo(() => {
    return materialRequests.filter(
      (material) =>
        material.fulfilled_status === 'delivered'
    )
  }, [materialRequests])

  /*
   * ---------------------------------------------------------
   * BRANCH REPORT
   * ---------------------------------------------------------
   */

  const branchReport = useMemo(() => {
    return branches.map((branch) => {
      const branchJobs = completedJobs.filter(
        (job) => String(job.branch_id) === String(branch.id)
      )

      return {
        ...branch,
        jobs: branchJobs.length,
        trucks: new Set(
          branchJobs
            .map((job) => job.truck_id)
            .filter(Boolean)
        ).size,
      }
    })
  }, [branches, completedJobs])

  /*
   * ---------------------------------------------------------
   * CHART DATA
   * ---------------------------------------------------------
   */

  const chartData = useMemo(() => {
    const days = []

    if (period === 'weekly') {
      for (let i = 0; i < 7; i++) {
        const date = new Date(start)
        date.setDate(start.getDate() + i)

        days.push(date)
      }
    } else {
      const year = start.getFullYear()
      const month = start.getMonth()
      const daysInMonth = new Date(year, month + 1, 0).getDate()

      for (let i = 0; i < daysInMonth; i++) {
        const date = new Date(year, month, i + 1)
        days.push(date)
      }
    }

    return days.map((date) => {
      const dayString = date.toISOString().split('T')[0]

      const income = transactions
        .filter((transaction) => {
          if (transaction.type !== 'in') return false

          return (
            new Date(transaction.date)
              .toISOString()
              .split('T')[0] === dayString
          )
        })
        .reduce(
          (sum, transaction) =>
            sum + Number(transaction.amount || 0),
          0
        )

      const expense = transactions
        .filter((transaction) => {
          if (transaction.type !== 'out') return false

          return (
            new Date(transaction.date)
              .toISOString()
              .split('T')[0] === dayString
          )
        })
        .reduce(
          (sum, transaction) =>
            sum + Number(transaction.amount || 0),
          0
        )

      return {
        date: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        income,
        expense,
      }
    })
  }, [transactions, period, start])

  const maxChartValue = Math.max(
    ...chartData.map((item) =>
      Math.max(item.income, item.expense)
    ),
    1
  )

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  if (loading) {
    return (
      <DashboardLayout>
        <div className="reports-loading">
          <div className="reports-spinner"></div>
          <h3>Preparing your report...</h3>
          <p>Gathering financial and garage information.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="reports-page">

        {/* HEADER */}

        <div className="reports-header">
          <div>
            <div className="reports-eyebrow">
              BUSINESS REPORT
            </div>

            <h2>Reports & Performance</h2>

            <p>
              A clear view of your garage's financial and
              operational performance.
            </p>
          </div>

          <div className="report-period-controls">
            <div className="period-label">
              Reporting period
            </div>

            <div className="period-buttons">
              <button
                className={period === 'weekly' ? 'period-active' : ''}
                onClick={() => setPeriod('weekly')}
              >
                Weekly
              </button>

              <button
                className={period === 'monthly' ? 'period-active' : ''}
                onClick={() => setPeriod('monthly')}
              >
                Monthly
              </button>
            </div>

            <span className="period-date">
              {periodLabel}
            </span>
          </div>
        </div>

        {error && (
          <div className="reports-error">
            <strong>Unable to load part of the report.</strong>
            <span>{error}</span>
            <button onClick={fetchReports}>
              Try again
            </button>
          </div>
        )}

        {/* FINANCIAL CARDS */}

        <div className="report-section-heading">
          <div>
            <span>FINANCIAL OVERVIEW</span>
            <h3>Money at a glance</h3>
          </div>
        </div>

        <div className="report-stats-grid">

          <div className="report-stat-card income-card">
            <div className="stat-icon">↗</div>
            <div className="stat-content">
              <span>Money In</span>
              <strong>{money(moneyIn)}</strong>
              <small>
                Total received during this period
              </small>
            </div>
          </div>

          <div className="report-stat-card expense-card">
            <div className="stat-icon">↘</div>
            <div className="stat-content">
              <span>Money Out</span>
              <strong>{money(moneyOut)}</strong>
              <small>
                Total expenses during this period
              </small>
            </div>
          </div>

          <div className="report-stat-card net-card">
            <div className="stat-icon">=</div>
            <div className="stat-content">
              <span>Net Cash Flow</span>
              <strong>{money(netCashFlow)}</strong>
              <small>
                Income minus expenses
              </small>
            </div>
          </div>

          <div className="report-stat-card owed-card">
            <div className="stat-icon">₿</div>
            <div className="stat-content">
              <span>Money Owed</span>
              <strong>
                See Finance
              </strong>
              <small>
                Outstanding customer balances
              </small>
            </div>
          </div>

        </div>

        {/* CASH VS GARAGE */}

        <div className="report-two-column">

          <div className="report-panel">
            <div className="panel-heading">
              <div>
                <span>ACCOUNTS</span>
                <h3>CASH vs GARAGE</h3>
              </div>

              <div className="panel-icon">
                ₿
              </div>
            </div>

            <div className="account-comparison">

              <div className="account-box cash">
                <div className="account-top">
                  <span className="account-dot"></span>
                  <span>CASH</span>
                </div>

                <strong>{money(cashBalance)}</strong>

                <small>
                  Official account
                </small>
              </div>

              <div className="account-divider">
                VS
              </div>

              <div className="account-box garage">
                <div className="account-top">
                  <span className="account-dot"></span>
                  <span>GARAGE</span>
                </div>

                <strong>{money(garageBalance)}</strong>

                <small>
                  Garage account
                </small>
              </div>

            </div>
          </div>

          {/* OPERATIONS */}

          <div className="report-panel">
            <div className="panel-heading">
              <div>
                <span>OPERATIONS</span>
                <h3>Garage activity</h3>
              </div>

              <div className="panel-icon">
                🚛
              </div>
            </div>

            <div className="operation-grid">

              <div>
                <strong>{trucksServiced}</strong>
                <span>Trucks serviced</span>
              </div>

              <div>
                <strong>{completedJobs.length}</strong>
                <span>Jobs completed</span>
              </div>


            </div>
          </div>

        </div>

        {/* CHART */}

        <div className="report-panel chart-panel">

          <div className="panel-heading">
            <div>
              <span>FINANCIAL TREND</span>
              <h3>Income vs expenses</h3>
            </div>

            <div className="chart-legend">
              <span>
                <i className="legend-income"></i>
                Income
              </span>

              <span>
                <i className="legend-expense"></i>
                Expenses
              </span>
            </div>
          </div>

          <div className="chart-container">

            <div className="chart-y-axis">
              <span>{money(maxChartValue)}</span>
              <span>{money(maxChartValue / 2)}</span>
              <span>ETB 0</span>
            </div>

            <div className="chart-main">

              <div className="chart-grid-lines">
                <span></span>
                <span></span>
                <span></span>
              </div>

              <div className="bars">

                {chartData.map((item, index) => {
                  const incomeHeight =
                    (item.income / maxChartValue) * 100

                  const expenseHeight =
                    (item.expense / maxChartValue) * 100

                  return (
                    <div
                      className="chart-day"
                      key={index}
                    >
                      <div className="bar-group">

                        <div
                          className="chart-bar income-bar"
                          style={{
                            height: `${Math.max(
                              incomeHeight,
                              item.income > 0 ? 3 : 0
                            )}%`,
                          }}
                          title={`Income: ${money(item.income)}`}
                        />

                        <div
                          className="chart-bar expense-bar"
                          style={{
                            height: `${Math.max(
                              expenseHeight,
                              item.expense > 0 ? 3 : 0
                            )}%`,
                          }}
                          title={`Expenses: ${money(item.expense)}`}
                        />

                      </div>

                      <span>
                        {item.date}
                      </span>
                    </div>
                  )
                })}

              </div>
            </div>

          </div>

          {transactions.length === 0 && (
            <div className="empty-report">
              No transactions were recorded during this period.
            </div>
          )}

        </div>

        {/* BRANCHES */}

        <div className="report-section-heading branch-heading">
          <div>
            <span>OPERATIONS</span>
            <h3>Branch performance</h3>
          </div>
        </div>

        <div className="branch-report-grid">

          {branchReport.map((branch) => (
            <div
              className="branch-report-card"
              key={branch.id}
            >
              <div className="branch-report-icon">
                📍
              </div>

              <div className="branch-report-info">
                <h4>
                  {branch.name}
                </h4>

                <div className="branch-metrics">
                  <div>
                    <strong>{branch.jobs}</strong>
                    <span>Completed jobs</span>
                  </div>

                  <div>
                    <strong>{branch.trucks}</strong>
                    <span>Trucks serviced</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {branchReport.length === 0 && (
            <div className="empty-report">
              No branch information available.
            </div>
          )}

        </div>

        {/* MATERIALS */}

        <div className="report-two-column material-section">

          <div className="report-panel">

            <div className="panel-heading">
              <div>
                <span>PARTS & MATERIALS</span>
                <h3>Material requests</h3>
              </div>

              <div className="panel-icon">
                📦
              </div>
            </div>

            <div className="material-summary">

              <div className="material-number pending">
                <strong>
                  {pendingMaterials.length}
                </strong>
                <span>Pending</span>
              </div>

              <div className="material-number delivered">
                <strong>
                  {deliveredMaterials.length}
                </strong>
                <span>Delivered</span>
              </div>

            </div>

            <p className="panel-note">
              Pending requests may indicate jobs waiting
              for parts.
            </p>

          </div>

          {/* COMPLETED JOBS */}

          <div className="report-panel">

            <div className="panel-heading">
              <div>
                <span>RECENT ACTIVITY</span>
                <h3>Completed jobs</h3>
              </div>

              <div className="panel-icon">
                ✓
              </div>
            </div>

            <div className="recent-jobs">

              {completedJobs
                .slice(0, 5)
                .map((job) => (
                  <div
                    className="recent-job"
                    key={job.id}
                  >
                    <div>
                      <strong>
                        {job.trucks?.plate_number || 'Unknown truck'}
                      </strong>

                      <span>
                        {job.trucks?.make}{' '}
                        {job.trucks?.model}
                      </span>
                    </div>

                    <div className="recent-job-date">
                      {job.date_out
                        ? new Date(
                            job.date_out
                          ).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </div>
                  </div>
                ))}

              {completedJobs.length === 0 && (
                <div className="empty-report">
                  No completed jobs during this period.
                </div>
              )}

            </div>

          </div>

        </div>

        {/* FOOTER */}

        <div className="reports-footer">
          <div>
            <strong>
              {period === 'weekly'
                ? 'Weekly report'
                : 'Monthly report'}
            </strong>

            <span>
              Generated from your current TruckFlow data.
            </span>
          </div>

          <button
            className="refresh-report"
            onClick={fetchReports}
          >
            ↻ Refresh report
          </button>
        </div>

      </div>
    </DashboardLayout>
  )
}

export default ReportsPage