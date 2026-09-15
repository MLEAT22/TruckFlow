import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { supabase } from "../supabaseClient";

function OwnerDashboard() {
  const [period, setPeriod] = useState("daily");

  const [moneyIn, setMoneyIn] = useState(0);
  const [moneyOut, setMoneyOut] = useState(0);
  const [moneyOwed, setMoneyOwed] = useState(0);

  const [cashBalance, setCashBalance] = useState(0);
  const [garageBalance, setGarageBalance] = useState(0);

  const [trucksInGarage, setTrucksInGarage] = useState(0);
  const [waitingForParts, setWaitingForParts] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();

    const handleFocus = () => {
      fetchDashboardData();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [period]);

  async function fetchDashboardData() {
    setLoading(true);

    try {
      /* =====================================================
         1. GET ALL TRANSACTIONS
         ===================================================== */

      const { data: allTransactions, error: transactionError } =
        await supabase
          .from("transactions")
          .select("amount, type, bank_accounts_id, date");

      if (transactionError) {
        console.error("Transaction error:", transactionError);
      }

      const transactions = allTransactions || [];

      /* =====================================================
         2. GET BANK ACCOUNTS
         ===================================================== */

      const { data: bankAccounts, error: bankError } = await supabase
        .from("bank_accounts")
        .select("id, name");

      if (bankError) {
        console.error("Bank account error:", bankError);
      }

      const accounts = bankAccounts || [];

      const cashAccount = accounts.find(
        (account) =>
          String(account.name || "").trim().toLowerCase() === "cash"
      );

      const garageAccount = accounts.find(
        (account) =>
          String(account.name || "").trim().toLowerCase() === "garage"
      );

      /* =====================================================
         3. CURRENT CASH / GARAGE BALANCES
         ===================================================== */

      let cashBalanceTotal = 0;
      let garageBalanceTotal = 0;

      transactions.forEach((transaction) => {
        const amount = Number(transaction.amount || 0);
        const type = String(transaction.type || "")
          .trim()
          .toLowerCase();

        if (
          cashAccount &&
          String(transaction.bank_accounts_id) === String(cashAccount.id)
        ) {
          if (type === "in") cashBalanceTotal += amount;
          if (type === "out") cashBalanceTotal -= amount;
        }

        if (
          garageAccount &&
          String(transaction.bank_accounts_id) === String(garageAccount.id)
        ) {
          if (type === "in") garageBalanceTotal += amount;
          if (type === "out") garageBalanceTotal -= amount;
        }
      });

      setCashBalance(cashBalanceTotal);
      setGarageBalance(garageBalanceTotal);

      /* =====================================================
         4. DETERMINE REPORT PERIOD
         ===================================================== */

      const now = new Date();

      function formatLocalDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
      }

      const todayString = formatLocalDate(now);

      let startDate = new Date(now);

      if (period === "daily") {
        startDate.setHours(0, 0, 0, 0);
      }

      if (period === "weekly") {
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
      }

      if (period === "monthly") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const startDateString = formatLocalDate(startDate);

      if (period === "yearly") {
  // Ethiopian New Year is Sept 11 (Sept 12 before a Gregorian leap year)
  const currentGregorianYear = now.getFullYear();
  const newYearDay = isLeapYear(currentGregorianYear + 1) ? 12 : 11;
  const thisEthiopianNewYear = new Date(currentGregorianYear, 8, newYearDay); // month 8 = September

  if (now >= thisEthiopianNewYear) {
    startDate = thisEthiopianNewYear;
  } else {
    const prevNewYearDay = isLeapYear(currentGregorianYear) ? 12 : 11;
    startDate = new Date(currentGregorianYear - 1, 8, prevNewYearDay);
  }
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

      /* =====================================================
         5. MONEY IN / MONEY OUT
         ===================================================== */

      let totalMoneyIn = 0;
      let totalMoneyOut = 0;

      transactions.forEach((transaction) => {
        if (!transaction.date) return;

        const transactionDate = String(transaction.date).slice(0, 10);
        const amount = Number(transaction.amount || 0);

        const type = String(transaction.type || "")
          .trim()
          .toLowerCase();

        if (
          transactionDate >= startDateString &&
          transactionDate <= todayString
        ) {
          if (type === "in") {
            totalMoneyIn += amount;
          }

          if (type === "out") {
            totalMoneyOut += amount;
          }
        }
      });

      setMoneyIn(totalMoneyIn);
      setMoneyOut(totalMoneyOut);

      /* =====================================================
         6. MONEY OWED
         Unpaid invoices only
         ===================================================== */

      const { data: invoices, error: invoiceError } = await supabase
        .from("invoices")
        .select("amount, status");

      if (invoiceError) {
        console.error("Invoice error:", invoiceError);
      }

      const outstandingAmount = (invoices || []).reduce(
        (total, invoice) => {
          const status = String(invoice.status || "")
            .trim()
            .toLowerCase();

          if (status === "unpaid") {
            return total + Number(invoice.amount || 0);
          }

          return total;
        },
        0
      );

      setMoneyOwed(outstandingAmount);

      /* =====================================================
         7. JOBS
         ===================================================== */

      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id, status, date_out");

      if (jobsError) {
        console.error("Jobs error:", jobsError);
      }

      const jobList = jobs || [];

      /* =====================================================
         8. TRUCKS IN GARAGE

         Only jobs that are currently in progress are counted.
         Ready/completed jobs are not counted.
         ===================================================== */

      const trucksCurrentlyInGarage = jobList.filter((job) => {
        const status = String(job.status || "")
          .trim()
          .toLowerCase();

        return status === "in_progress";
      });

      setTrucksInGarage(trucksCurrentlyInGarage.length);

      /* =====================================================
         9. WAITING FOR PARTS

         Count only:
         - material request = pending
         - its job = in_progress

         Delivered materials are NOT counted.
         ===================================================== */

      const { data: materials, error: materialError } = await supabase
        .from("material_requests")
        .select("id, job_id, fulfilled_status");

      if (materialError) {
        console.error("Material requests error:", materialError);
      }

      const inProgressJobIds = new Set(
        jobList
          .filter((job) => {
            const status = String(job.status || "")
              .trim()
              .toLowerCase();

            return status === "in_progress";
          })
          .map((job) => String(job.id))
      );

      const waitingMaterials = (materials || []).filter((material) => {
        const materialStatus = String(material.fulfilled_status || "")
          .trim()
          .toLowerCase();

        const materialJobId = String(material.job_id || "");

        return (
          materialStatus === "pending" &&
          inProgressJobIds.has(materialJobId)
        );
      });

      setWaitingForParts(waitingMaterials.length);

      /* =====================================================
         10. COMPLETED TODAY

         A job is Completed Today when:
         - status = ready
         - date_out is within the last 24 hours

         After 24 hours, it disappears from this card
         and should be shown in History.
         ===================================================== */

      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      );

      const completedTodayJobs = jobList.filter((job) => {
        const status = String(job.status || "")
          .trim()
          .toLowerCase();

        if (status !== "ready" || !job.date_out) {
          return false;
        }

        const dateOut = new Date(job.date_out);

        return dateOut >= twentyFourHoursAgo;
      });

      setCompletedToday(completedTodayJobs.length);
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }

  /* =====================================================
     AVAILABLE BALANCE
     ===================================================== */

  const availableBalance = moneyIn - moneyOut;

  return (
    <DashboardLayout>
      {/* WELCOME */}
      <div className="dashboard-welcome">
        <div>
          <h1>Good morning, Solomon</h1>
          <p>Here's what's happening in your garage today.</p>
        </div>

        <div className="date-box">
          <span>Today</span>
          <strong>{new Date().toLocaleDateString()}</strong>
        </div>
      </div>

      {/* FINANCIAL OVERVIEW */}
      <div className="section-title">
        <h2>Financial Overview</h2>

        <p>
          {period === "daily"
            ? "Today's financial activity"
            : period === "weekly"
            ? "This week's financial activity"
            : "This month's financial activity"}
        </p>

        <div className="period-selector">
          <button
            className={period === "daily" ? "active" : ""}
            onClick={() => setPeriod("daily")}
          >
            Daily
          </button>

          <button
            className={period === "weekly" ? "active" : ""}
            onClick={() => setPeriod("weekly")}
          >
            Weekly
          </button>

          <button
            className={period === "monthly" ? "active" : ""}
            onClick={() => setPeriod("monthly")}
          >
            Monthly
          </button>

          <button className={period === "yearly" ? "active" : ""} onClick={() => setPeriod("yearly")}>
  Yearly
</button>
        </div>
      </div>

      <div className="finance-cards">
        <div className="finance-card income-card">
          <div className="finance-card-top">
            <span className="finance-icon">↑</span>
            <span className="finance-label">Money In</span>
          </div>

          <h3>ETB {loading ? "..." : totalFormat(moneyIn)}</h3>

          <p>
            {period === "daily"
              ? "Received today"
              : period === "weekly"
              ? "Received this week"
              : "Received this month"}
          </p>
        </div>

        <div className="finance-card expense-card">
          <div className="finance-card-top">
            <span className="finance-icon">↓</span>
            <span className="finance-label">Money Out</span>
          </div>

          <h3>ETB {loading ? "..." : totalFormat(moneyOut)}</h3>

          <p>
            {period === "daily"
              ? "Paid today"
              : period === "weekly"
              ? "Paid this week"
              : "Paid this month"}
          </p>
        </div>

        <div className="finance-card balance-card">
          <div className="finance-card-top">
            <span className="finance-icon">◈</span>
            <span className="finance-label">Available Balance</span>
          </div>

          <h3>ETB {loading ? "..." : totalFormat(availableBalance)}</h3>

          <p>Money In − Money Out</p>
        </div>

        <div className="finance-card receivable-card">
          <div className="finance-card-top">
            <span className="finance-icon">!</span>
            <span className="finance-label">Money Owed</span>
          </div>

          <h3>ETB {loading ? "..." : totalFormat(moneyOwed)}</h3>

          <p>Outstanding payments</p>
        </div>
      </div>

      {/* CASH / GARAGE */}
      <div className="section-title second-section">
        <h2>Account Balances</h2>
        <p>Current balance by financial account</p>
      </div>

      <div className="finance-cards">
        <div className="finance-card">
          <div className="finance-card-top">
            <span className="finance-icon">💵</span>
            <span className="finance-label">CASH</span>
          </div>

          <h3>ETB {loading ? "..." : totalFormat(cashBalance)}</h3>

          <p>Official company account</p>
        </div>

        <div className="finance-card">
          <div className="finance-card-top">
            <span className="finance-icon">💰</span>
            <span className="finance-label">GARAGE</span>
          </div>

          <h3>ETB {loading ? "..." : totalFormat(garageBalance)}</h3>

          <p>Garage account</p>
        </div>
      </div>

      {/* GARAGE OVERVIEW */}
      <div className="section-title second-section">
        <h2>Garage Overview</h2>
        <p>Current truck and repair activity</p>
      </div>

      <div className="overview-grid">
        {/* TRUCKS IN GARAGE */}
        <div className="overview-card">
          <div className="overview-icon">🚛</div>

          <div>
            <span>Trucks in Garage</span>
            <strong>{trucksInGarage}</strong>
          </div>
        </div>

        {/* WAITING FOR PARTS */}
        <div className="overview-card">
          <div className="overview-icon">⏱</div>

          <div>
            <span>Waiting for Parts</span>
            <strong>{waitingForParts}</strong>
          </div>
        </div>

        {/* COMPLETED TODAY */}
        <div className="overview-card">
          <div className="overview-icon">✓</div>

          <div>
            <span>Completed Today</span>
            <strong>{completedToday}</strong>
          </div>
        </div>
      </div>

      {/* NEEDS ATTENTION */}
      <div className="section-title second-section">
        <h2>Needs Attention</h2>
        <p>Things that may require your attention</p>
      </div>

      <div className="attention-card">
        <div className="attention-item">
          <div className="attention-icon">!</div>

          <div>
            <strong>Financial and operational monitoring</strong>

            <p>
              Important financial and operational information will appear
              here.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

/* =====================================================
   NUMBER FORMATTER
   ===================================================== */

function totalFormat(number) {
  return Number(number || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default OwnerDashboard;