import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { supabase } from "../supabaseClient";

function FinancePage({ userRole }) {
    console.log("Finance user role:", userRole);
  const [transactions, setTransactions] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState("monthly");
  const [accountFilter, setAccountFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [showAddTransaction, setShowAddTransaction] = useState(false);

  const [form, setForm] = useState({
    amount: "",
    type: "in",
    bank_accounts_id: "",
    branch_id: "",
    category: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [editingTransactionId, setEditingTransactionId] = useState(null);

const [editTransaction, setEditTransaction] = useState({
  amount: "",
  date: "",
  bank_accounts_id: "",
  branch_id: "",
  category: "",
  description: "",
  type: "in",
});

  useEffect(() => {
    fetchFinanceData();
  }, []);

  async function fetchFinanceData() {
    setLoading(true);

    try {
      const [
        transactionsResult,
        accountsResult,
        branchesResult,
        invoicesResult,
      ] = await Promise.all([
        supabase
          .from("transactions")
          .select(
            "id, created_at, bank_accounts_id, branch_id, type, amount, category, description, date, entered_by"
          )
          .order("date", { ascending: false }),

        supabase
          .from("bank_accounts")
          .select("id, name")
          .order("name"),

        supabase
          .from("branches")
          .select("id, name, location")
          .order("name"),

        supabase
          .from("invoices")
          .select("id, amount, status"),
      ]);

      if (transactionsResult.error) {
        console.error(
          "Transactions error:",
          transactionsResult.error
        );
      }

      if (accountsResult.error) {
        console.error(
          "Bank accounts error:",
          accountsResult.error
        );
      }

      if (branchesResult.error) {
        console.error(
          "Branches error:",
          branchesResult.error
        );
      }

      if (invoicesResult.error) {
        console.error(
          "Invoices error:",
          invoicesResult.error
        );
      }

      const loadedAccounts = accountsResult.data || [];
      const loadedBranches = branchesResult.data || [];

      setTransactions(transactionsResult.data || []);
      setBankAccounts(loadedAccounts);
      setBranches(loadedBranches);
      setInvoices(invoicesResult.data || []);

      if (loadedAccounts.length > 0) {
        setForm((previous) => ({
          ...previous,
          bank_accounts_id:
            previous.bank_accounts_id ||
            String(loadedAccounts[0].id),
        }));
      }

      if (loadedBranches.length > 0) {
        setForm((previous) => ({
          ...previous,
          branch_id:
            previous.branch_id ||
            String(loadedBranches[0].id),
        }));
      }
    } catch (error) {
      console.error("Finance page error:", error);
    } finally {
      setLoading(false);
    }
  }

  function getAccountName(accountId) {
    const account = bankAccounts.find(
      (item) => String(item.id) === String(accountId)
    );

    return account?.name || "Unknown";
  }

  function getBranchName(branchId) {
    const branch = branches.find(
      (item) => String(item.id) === String(branchId)
    );

    return branch?.name || "Unknown branch";
  }

  function formatMoney(amount) {
    return Number(amount || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function getStartDate() {
    const today = new Date();

    if (period === "daily") {
      return new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
    }

    if (period === "weekly") {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return start;
    }

    return new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );
  }

  function isInsidePeriod(transactionDate) {
    if (!transactionDate) return false;

    const transactionDay = String(transactionDate).slice(
      0,
      10
    );

    const today = new Date();

    const todayString = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

    const start = getStartDate();

    const startString = `${start.getFullYear()}-${String(
      start.getMonth() + 1
    ).padStart(2, "0")}-${String(
      start.getDate()
    ).padStart(2, "0")}`;

    return (
      transactionDay >= startString &&
      transactionDay <= todayString
    );
  }

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      if (!isInsidePeriod(transaction.date)) {
        return false;
      }

      if (
        accountFilter !== "all" &&
        String(transaction.bank_accounts_id) !==
          String(accountFilter)
      ) {
        return false;
      }

      if (
        typeFilter !== "all" &&
        String(transaction.type).toLowerCase() !==
          typeFilter
      ) {
        return false;
      }

      if (
        branchFilter !== "all" &&
        String(transaction.branch_id) !==
          String(branchFilter)
      ) {
        return false;
      }

      if (search.trim()) {
        const text = search.toLowerCase();

        const searchableText = `
          ${transaction.description || ""}
          ${transaction.category || ""}
          ${getAccountName(transaction.bank_accounts_id)}
          ${getBranchName(transaction.branch_id)}
        `.toLowerCase();

        if (!searchableText.includes(text)) {
          return false;
        }
      }

      return true;
    });
  }, [
    transactions,
    period,
    accountFilter,
    typeFilter,
    branchFilter,
    search,
    bankAccounts,
    branches,
  ]);

  const moneyIn = filteredTransactions
    .filter(
      (transaction) =>
        String(transaction.type).toLowerCase() === "in"
    )
    .reduce(
      (total, transaction) =>
        total + Number(transaction.amount || 0),
      0
    );

  const moneyOut = filteredTransactions
    .filter(
      (transaction) =>
        String(transaction.type).toLowerCase() === "out"
    )
    .reduce(
      (total, transaction) =>
        total + Number(transaction.amount || 0),
      0
    );

  const netMovement = moneyIn - moneyOut;

  const moneyOwed = invoices
    .filter(
      (invoice) =>
        String(invoice.status || "")
          .trim()
          .toLowerCase() !== "paid"
    )
    .reduce(
      (total, invoice) =>
        total + Number(invoice.amount || 0),
      0
    );

  const cashAccount = bankAccounts.find(
    (account) =>
      String(account.name || "")
        .trim()
        .toLowerCase() === "cash"
  );

  const garageAccount = bankAccounts.find(
    (account) =>
      String(account.name || "")
        .trim()
        .toLowerCase() === "garage"
  );

  function calculateAccountBalance(accountId) {
    return transactions
      .filter(
        (transaction) =>
          String(transaction.bank_accounts_id) ===
          String(accountId)
      )
      .reduce((balance, transaction) => {
        const amount = Number(transaction.amount || 0);

        if (
          String(transaction.type).toLowerCase() ===
          "in"
        ) {
          return balance + amount;
        }

        if (
          String(transaction.type).toLowerCase() ===
          "out"
        ) {
          return balance - amount;
        }

        return balance;
      }, 0);
  }

  const cashBalance = cashAccount
    ? calculateAccountBalance(cashAccount.id)
    : 0;

  const garageBalance = garageAccount
    ? calculateAccountBalance(garageAccount.id)
    : 0;

  const combinedBalance =
    cashBalance + garageBalance;

  async function handleAddTransaction(event) {
    event.preventDefault();

    if (!form.amount || Number(form.amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (!form.bank_accounts_id) {
      alert("Please select an account.");
      return;
    }

    if (!form.branch_id) {
      alert("Please select a branch.");
      return;
    }

    const { error } = await supabase
      .from("transactions")
      .insert([
        {
          amount: Number(form.amount),
          type: form.type,
          bank_accounts_id: form.bank_accounts_id,
          branch_id: form.branch_id,
          category: form.category,
          description: form.description,
          date: form.date,
        },
      ]);

    if (error) {
      console.error(
        "Add transaction error:",
        error
      );

      alert(
        `Could not save transaction: ${error.message}`
      );

      return;
    }

    setShowAddTransaction(false);

    setForm({
      amount: "",
      type: "in",
      bank_accounts_id:
        bankAccounts[0]
          ? String(bankAccounts[0].id)
          : "",
      branch_id:
        branches[0]
          ? String(branches[0].id)
          : "",
      category: "",
      description: "",
      date: new Date().toISOString().slice(0, 10),
    });

    await fetchFinanceData();
  }

  return (
    <DashboardLayout>

      {/* ===============================================
          PAGE HEADER
          =============================================== */}

      <div className="finance-page-header">

        <div>
          <span className="finance-page-eyebrow">
            FINANCIAL MANAGEMENT
          </span>

          <h1>Finance</h1>

          <p>
            Track every birr coming into and leaving
            the garage.
          </p>
        </div>
{userRole === "accountant" && (
        <button
          className="add-transaction-button"
          onClick={() =>
            setShowAddTransaction(true)
          }
        >
          <span>＋</span>
          Add Transaction
        </button>
)}
      </div>


      {/* ===============================================
          ACCOUNT BALANCES
          =============================================== */}

      <div className="finance-section-heading">

        <div>
          <h2>Account Balances</h2>

          <p>
            Current balance across your financial
            accounts
          </p>
        </div>

      </div>


      <div className="finance-account-grid">

        {/* CASH */}

        <div className="finance-account-card cash-account">

          <div className="account-card-top">

            <div className="account-icon">
              💵
            </div>

            <div>
              <span>OFFICIAL ACCOUNT</span>
              <h3>CASH</h3>
            </div>

          </div>

          <div className="account-balance">
            ETB {formatMoney(cashBalance)}
          </div>

          <p>
            Government-known company account
          </p>

        </div>


        {/* GARAGE */}

        <div className="finance-account-card garage-account">

          <div className="account-card-top">

            <div className="account-icon">
              💰
            </div>

            <div>
              <span>GARAGE ACCOUNT</span>
              <h3>GARAGE</h3>
            </div>

          </div>

          <div className="account-balance">
            ETB {formatMoney(garageBalance)}
          </div>

          <p>
            Garage financial account
          </p>

        </div>


        {/* COMBINED */}

        <div className="finance-account-card combined-account">

          <div className="account-card-top">

            <div className="account-icon">
              ◈
            </div>

            <div>
              <span>TOTAL POSITION</span>
              <h3>COMBINED</h3>
            </div>

          </div>

          <div className="account-balance">
            ETB {formatMoney(combinedBalance)}
          </div>

          <p>
            CASH + GARAGE
          </p>

        </div>

      </div>


      {/* ===============================================
          PERIOD SELECTOR
          =============================================== */}

      <div className="finance-toolbar">

        <div className="period-buttons">

          <button
            className={
              period === "daily"
                ? "period-active"
                : ""
            }
            onClick={() => setPeriod("daily")}
          >
            Daily
          </button>

          <button
            className={
              period === "weekly"
                ? "period-active"
                : ""
            }
            onClick={() => setPeriod("weekly")}
          >
            Weekly
          </button>

          <button
            className={
              period === "monthly"
                ? "period-active"
                : ""
            }
            onClick={() => setPeriod("monthly")}
          >
            Monthly
          </button>

        </div>

        <span className="period-description">
          {period === "daily"
            ? "Today's activity"
            : period === "weekly"
            ? "Last 7 days"
            : "This month's activity"}
        </span>

      </div>


      {/* ===============================================
          FINANCIAL SUMMARY
          =============================================== */}

      <div className="finance-summary-grid">

        <div className="summary-card income-summary">

          <div className="summary-icon">
            ↑
          </div>

          <div>
            <span>Money In</span>

            <strong>
              ETB {formatMoney(moneyIn)}
            </strong>

            <small>
              {filteredTransactions.filter(
                (item) =>
                  String(item.type).toLowerCase() ===
                  "in"
              ).length}{" "}
              transactions
            </small>
          </div>

        </div>


        <div className="summary-card expense-summary">

          <div className="summary-icon">
            ↓
          </div>

          <div>
            <span>Money Out</span>

            <strong>
              ETB {formatMoney(moneyOut)}
            </strong>

            <small>
              {filteredTransactions.filter(
                (item) =>
                  String(item.type).toLowerCase() ===
                  "out"
              ).length}{" "}
              transactions
            </small>
          </div>

        </div>


        <div className="summary-card net-summary">

          <div className="summary-icon">
            ◈
          </div>

          <div>
            <span>Net Movement</span>

            <strong>
              ETB {formatMoney(netMovement)}
            </strong>

            <small>
              In − Out
            </small>
          </div>

        </div>


        <div className="summary-card owed-summary">

          <div className="summary-icon">
            !
          </div>

          <div>
            <span>Money Owed</span>

            <strong>
              ETB {formatMoney(moneyOwed)}
            </strong>

            <small>
              Outstanding invoices
            </small>
          </div>

        </div>

      </div>


      {/* ===============================================
          TRANSACTION HISTORY
          =============================================== */}

      <div className="finance-transactions-section">

        <div className="transaction-heading">

          <div>
            <h2>Transaction History</h2>

            <p>
              Review money coming in and going out
            </p>
          </div>

          <span className="transaction-count">
            {filteredTransactions.length} records
          </span>

        </div>


        {/* FILTERS */}

        <div className="transaction-filters">

          <div className="finance-search">

            <span>⌕</span>

            <input
              type="text"
              placeholder="Search transactions..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

          </div>


          <select
            value={accountFilter}
            onChange={(event) =>
              setAccountFilter(event.target.value)
            }
          >
            <option value="all">
              All Accounts
            </option>

            {bankAccounts.map((account) => (
              <option
                key={account.id}
                value={account.id}
              >
                {account.name}
              </option>
            ))}
          </select>


          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value)
            }
          >
            <option value="all">
              All Transactions
            </option>

            <option value="in">
              Money In
            </option>

            <option value="out">
              Money Out
            </option>
          </select>


          <select
            value={branchFilter}
            onChange={(event) =>
              setBranchFilter(event.target.value)
            }
          >
            <option value="all">
              All Branches
            </option>

            {branches.map((branch) => (
              <option
                key={branch.id}
                value={branch.id}
              >
                {branch.name}
              </option>
            ))}
          </select>

        </div>


        {/* TABLE */}

        <div className="transaction-table-wrapper">

          {loading ? (
            <div className="finance-empty-state">
              <div className="finance-loading">
                ⟳
              </div>

              <p>
                Loading financial records...
              </p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="finance-empty-state">

              <div className="empty-finance-icon">
                💳
              </div>

              <h3>
                No transactions found
              </h3>

              <p>
                There are no transactions matching
                your current filters.
              </p>

              <button
                onClick={() => {
                  setPeriod("monthly");
                  setAccountFilter("all");
                  setTypeFilter("all");
                  setBranchFilter("all");
                  setSearch("");
                }}
              >
                Clear Filters
              </button>

            </div>
          ) : (
            <table className="finance-table">

              <thead>
                <tr>

                  <th>Date</th>

                  <th>Description</th>

                  <th>Category</th>

                  <th>Account</th>

                  <th>Branch</th>

                  <th>Type</th>

                  <th className="amount-column">
                    Amount
                  </th>

                </tr>
              </thead>

              <tbody>

                {filteredTransactions.map(
                  (transaction) => {

                    const isIncome =
                      String(transaction.type)
                        .toLowerCase() ===
                      "in";

                    return (
                      <tr key={transaction.id}>

                        <td>
                          {transaction.date
                            ? new Date(
                                transaction.date
                              ).toLocaleDateString()
                            : "—"}
                        </td>

                        <td>
                          <div className="transaction-description">

                            <strong>
                              {transaction.description ||
                                "No description"}
                            </strong>

                          </div>
                        </td>

                        <td>
                          {transaction.category ||
                            "—"}
                        </td>

                        <td>
                          <span className="account-badge">
                            {getAccountName(
                              transaction.bank_accounts_id
                            )}
                          </span>
                        </td>

                        <td>
                          {getBranchName(
                            transaction.branch_id
                          )}
                        </td>

                        <td>

                          <span
                            className={
                              isIncome
                                ? "transaction-type income-type"
                                : "transaction-type expense-type"
                            }
                          >
                            {isIncome
                              ? "↑ IN"
                              : "↓ OUT"}
                          </span>

                        </td>

                        <td
                          className={
                            isIncome
                              ? "amount income-amount"
                              : "amount expense-amount"
                          }
                        >
                          {isIncome
                            ? "+"
                            : "-"}{" "}
                          ETB{" "}
                          {formatMoney(
                            transaction.amount
                          )}
                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>
          )}

        </div>

      </div>


      {/* ===============================================
          ADD TRANSACTION MODAL
          =============================================== */}

      {showAddTransaction && (
        <div
          className="finance-modal-overlay"
          onClick={() =>
            setShowAddTransaction(false)
          }
        >

          <div
            className="finance-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>
                <span>
                  FINANCIAL ENTRY
                </span>

                <h2>
                  Add Transaction
                </h2>

                <p>
                  Record money coming into or leaving
                  the garage.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setShowAddTransaction(false)
                }
              >
                ×
              </button>

            </div>


            <form onSubmit={handleAddTransaction}>

              <div className="transaction-type-selector">

                <button
                  type="button"
                  className={
                    form.type === "in"
                      ? "selected-income"
                      : ""
                  }
                  onClick={() =>
                    setForm({
                      ...form,
                      type: "in",
                    })
                  }
                >
                  ↑ Money In
                </button>

                <button
                  type="button"
                  className={
                    form.type === "out"
                      ? "selected-expense"
                      : ""
                  }
                  onClick={() =>
                    setForm({
                      ...form,
                      type: "out",
                    })
                  }
                >
                  ↓ Money Out
                </button>

              </div>


              <div className="form-grid">

                <div className="form-field">

                  <label>
                    Amount
                  </label>

                  <div className="amount-input">

                    <span>
                      ETB
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          amount: event.target.value,
                        })
                      }
                      required
                    />

                  </div>

                </div>


                <div className="form-field">

                  <label>
                    Date
                  </label>

                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        date: event.target.value,
                      })
                    }
                    required
                  />

                </div>


                <div className="form-field">

                  <label>
                    Account
                  </label>

                  <select
                    value={form.bank_accounts_id}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        bank_accounts_id:
                          event.target.value,
                      })
                    }
                    required
                  >

                    <option value="">
                      Select account
                    </option>

                    {bankAccounts.map(
                      (account) => (
                        <option
                          key={account.id}
                          value={account.id}
                        >
                          {account.name}
                        </option>
                      )
                    )}

                  </select>

                </div>


                <div className="form-field">

                  <label>
                    Branch
                  </label>

                  <select
                    value={form.branch_id}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        branch_id:
                          event.target.value,
                      })
                    }
                    required
                  >

                    <option value="">
                      Select branch
                    </option>

                    {branches.map(
                      (branch) => (
                        <option
                          key={branch.id}
                          value={branch.id}
                        >
                          {branch.name}
                        </option>
                      )
                    )}

                  </select>

                </div>


                <div className="form-field">

                  <label>
                    Category
                  </label>

                  <input
                    type="text"
                    placeholder="e.g. Repair, Payroll, Materials"
                    value={form.category}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        category:
                          event.target.value,
                      })
                    }
                  />

                </div>


                <div className="form-field">

                  <label>
                    Description
                  </label>

                  <input
                    type="text"
                    placeholder="What was this transaction for?"
                    value={form.description}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        description:
                          event.target.value,
                      })
                    }
                  />

                </div>

              </div>


              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() =>
                    setShowAddTransaction(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-transaction-button"
                >
                  Save Transaction
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </DashboardLayout>
  );
}

export default FinancePage;