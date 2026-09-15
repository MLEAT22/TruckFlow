import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import DashboardLayout from "../layouts/DashboardLayout";

function TrucksPage() {
  const [trucks, setTrucks] = useState([]);
  

  const [plateSearch, setPlateSearch] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  const [newPlate, setNewPlate] = useState("");
  const [newMake, setNewMake] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCompanyName, setNewCompanyName] = useState('')

  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
  fetchTrucks()
}, [])

  async function fetchTrucks() {
    setLoading(true);

    const { data, error } = await supabase
      .from("trucks")
      .select("*, customers(name, phone)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading trucks:", error);
    }

    setTrucks(data || []);
    setLoading(false);
  }

  async function fetchCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone")
      .order("name");

    if (error) {
      console.error("Error loading customers:", error);
    }

    setCustomers(data || []);
  }

  async function handleAddTruck(e) {
  e.preventDefault()

  if (!newCustomerName.trim()) {
    alert('Please enter the customer/owner name.')
    return
  }

  // Check if this customer already exists
  const { data: existingCustomer, error: customerSearchError } =
    await supabase
      .from('customers')
      .select('id')
      .eq('name', newCustomerName.trim())
      .maybeSingle()

  if (customerSearchError) {
    alert(customerSearchError.message)
    return
  }

  let customerId = existingCustomer?.id

  // Create customer if they don't already exist
  if (!customerId) {
    const { data: newCustomer, error: customerError } =
      await supabase
        .from('customers')
        .insert({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
          company_name: newCompanyName.trim() || null,
        })
        .select('id')
        .single()

    if (customerError) {
      alert(customerError.message)
      return
    }

    customerId = newCustomer.id
  }

  // Add the truck
  const { error: truckError } = await supabase
    .from('trucks')
    .insert({
      plate_number: newPlate.trim(),
      make: newMake.trim() || null,
      model: newModel.trim() || null,
      customer_id: customerId,
    })

  if (truckError) {
    alert(truckError.message)
    return
  }

  // Clear form
  setNewPlate('')
  setNewMake('')
  setNewModel('')
  setNewCustomerName('')
  setNewCustomerPhone('')
  setNewCompanyName('')

  fetchTrucks()
}

  async function handleSearch() {
    const plate = plateSearch.trim();

    setSearchError("");
    setSearchResult(null);

    if (!plate) {
      setSearchError("Please enter a plate number.");
      return;
    }

    setSearching(true);

    const { data: truck, error } = await supabase
      .from("trucks")
      .select(`
        *,
        customers(name, phone),
        jobs(
          *,
          job_items(*),
          invoices(*)
        )
      `)
      .ilike("plate_number", plate)
      .maybeSingle();

    if (error) {
      console.error("Truck search error:", error);
      setSearchError("Something went wrong while searching.");
      setSearching(false);
      return;
    }

    if (!truck) {
      setSearchError("No truck found with that plate number.");
      setSearching(false);
      return;
    }

    setSearchResult(truck);
    setSearching(false);
  }

  function clearSearch() {
    setPlateSearch("");
    setSearchResult(null);
    setSearchError("");
  }

  function startEdit(truck) {
    setEditingId(truck.id);

    setEditValues({
      plate_number: truck.plate_number || "",
      make: truck.make || "",
      model: truck.model || "",
      customer_id: truck.customer_id || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues({});
  }

  async function saveEdit(id) {
    const { error } = await supabase
      .from("trucks")
      .update({
        plate_number: editValues.plate_number.trim().toUpperCase(),
        make: editValues.make.trim(),
        model: editValues.model.trim(),
        customer_id: editValues.customer_id || null,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingId(null);
    setEditValues({});
    fetchTrucks();

    if (
      searchResult &&
      searchResult.id === id
    ) {
      handleSearch();
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm(
      "Delete this truck?\n\nThis can affect its historical records and cannot be undone."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("trucks")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchTrucks();

    if (searchResult?.id === id) {
      clearSearch();
    }
  }

  function formatDate(date) {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getJobStatusLabel(status) {
    const labels = {
      in_progress: "In Progress",
      ready: "Ready",
    };

    return labels[status] || status || "Unknown";
  }

  function getStatusClass(status) {
    if (status === "ready") return "status-ready";
    if (status === "in_progress") return "status-progress";
    return "status-neutral";
  }

  const totalJobs = searchResult?.jobs?.length || 0;

  const totalInvoiced =
    searchResult?.jobs?.reduce((sum, job) => {
      const invoiceTotal =
        job.invoices?.reduce(
          (invoiceSum, invoice) =>
            invoiceSum + Number(invoice.amount || 0),
          0
        ) || 0;

      return sum + invoiceTotal;
    }, 0) || 0;

  return (
    <DashboardLayout>
      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">OPERATIONS</span>
          <h1>Trucks</h1>
          <p>
            Manage vehicles, customers and complete truck history.
          </p>
        </div>

        <div className="page-heading-stat">
          <span>Total Trucks</span>
          <strong>{trucks.length}</strong>
        </div>
      </div>

      {/* PLATE SEARCH */}
      <section className="feature-card truck-search-panel">
        <div className="feature-card-header">
          <div>
            <span className="feature-icon">🔎</span>
            <div>
              <h2>Find a Truck</h2>
              <p>
                Search by plate number to see the truck's history.
              </p>
            </div>
          </div>
        </div>

        <div className="truck-search-bar">
          <div className="search-input-wrapper">
            <span>🔍</span>

            <input
              value={plateSearch}
              onChange={(e) => setPlateSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              placeholder="Enter plate number e.g. AA-12345"
            />

            {plateSearch && (
              <button
                type="button"
                className="clear-search"
                onClick={clearSearch}
              >
                ×
              </button>
            )}
          </div>

          <button
            className="btn-primary search-button"
            onClick={handleSearch}
            disabled={searching}
          >
            {searching ? "Searching..." : "Search Truck"}
          </button>
        </div>

        {searchError && (
          <div className="message message-error">
            <span>!</span>
            {searchError}
          </div>
        )}

        {/* SEARCH RESULT */}
        {searchResult && (
          <div className="truck-profile">
            <div className="truck-profile-header">
              <div className="truck-avatar">🚛</div>

              <div className="truck-profile-title">
                <span className="profile-label">TRUCK PROFILE</span>
                <h2>{searchResult.plate_number}</h2>
                <p>
                  {searchResult.make || "Unknown make"}{" "}
                  {searchResult.model || ""}
                </p>
              </div>

              <div className="truck-profile-owner">
                <span>Customer</span>
                <strong>
                  {searchResult.customers?.name || "Not assigned"}
                </strong>

                {searchResult.customers?.phone && (
                  <small>{searchResult.customers.phone}</small>
                )}
              </div>
            </div>

            <div className="truck-stat-grid">
              <div className="truck-stat">
                <span>Job Visits</span>
                <strong>{totalJobs}</strong>
              </div>

              <div className="truck-stat">
                <span>Total Invoiced</span>
                <strong>
                  ETB {totalInvoiced.toLocaleString()}
                </strong>
              </div>

              <div className="truck-stat">
                <span>Last Visit</span>
                <strong>
                  {searchResult.jobs?.length
                    ? formatDate(
                        searchResult.jobs[0]?.date_in
                      )
                    : "No visits"}
                </strong>
              </div>
            </div>

            <div className="profile-section">
              <div className="profile-section-heading">
                <div>
                  <h3>Job History</h3>
                  <p>
                    Previous and current work performed on this truck.
                  </p>
                </div>
              </div>

              {!searchResult.jobs?.length ? (
                <div className="empty-state compact">
                  <span>📋</span>
                  <strong>No job history yet</strong>
                  <p>
                    This truck has not been registered for a repair job.
                  </p>
                </div>
              ) : (
                <div className="history-list">
                  {searchResult.jobs.map((job) => (
                    <div className="history-item" key={job.id}>
                      <div className="history-date">
                        <strong>
                          {formatDate(job.date_in)}
                        </strong>

                        <span>
                          {job.date_out
                            ? `Out ${formatDate(job.date_out)}`
                            : "Currently in garage"}
                        </span>
                      </div>

                      <div className="history-main">
                        <div className="history-top-row">
                          <span
                            className={`status-pill ${getStatusClass(
                              job.status
                            )}`}
                          >
                            {getJobStatusLabel(job.status)}
                          </span>

                          <span className="history-driver">
                            Driver: {job.driver_name || "—"}
                          </span>
                        </div>

                        {job.job_items?.length > 0 && (
                          <div className="history-items">
                            {job.job_items.map((item) => (
                              <div
                                className="history-line"
                                key={item.id}
                              >
                                <span>
                                  {item.description}
                                </span>

                                <span>
                                  {item.quantity} ×{" "}
                                  {Number(
                                    item.unit_price || 0
                                  ).toLocaleString()}{" "}
                                  ={" "}
                                  <strong>
                                    ETB{" "}
                                    {Number(
                                      item.total_price || 0
                                    ).toLocaleString()}
                                  </strong>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {job.invoices?.length > 0 && (
                          <div className="invoice-history">
                            {job.invoices.map((invoice) => (
                              <div
                                className="invoice-row"
                                key={invoice.id}
                              >
                                <span>Invoice</span>

                                <strong>
                                  ETB{" "}
                                  {Number(
                                    invoice.amount || 0
                                  ).toLocaleString()}
                                </strong>

                                <span
                                  className={`invoice-status ${
                                    invoice.status === "paid"
                                      ? "paid"
                                      : "unpaid"
                                  }`}
                                >
                                  {invoice.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ADD TRUCK */}
      <div className="section-title second-section">
        <h2>Add a Truck</h2>
        <p>Register a new vehicle in TruckFlow.</p>
      </div>

      <section className="page-card">
        <form onSubmit={handleAddTruck}>
          <div className="form-grid">
            <div className="form-field">
              <label>Plate Number</label>
              <input
                value={newPlate}
                onChange={(e) => setNewPlate(e.target.value)}
                placeholder="e.g. AA-12345"
                required
              />
            </div>

            <div className="form-field">
              <label>Make</label>
              <input
                value={newMake}
                onChange={(e) => setNewMake(e.target.value)}
                placeholder="e.g. IVECO"
              />
            </div>

            <div className="form-field">
              <label>Model</label>
              <input
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                placeholder="e.g. Stralis"
              />
            </div>

            <div className="form-field">
              <label>Customer / Owner</label>

             <input
  value={newCustomerName}
  onChange={(e) => setNewCustomerName(e.target.value)}
  placeholder="Customer / Owner name"
  required
/>

<input
  value={newCustomerPhone}
  onChange={(e) => setNewCustomerPhone(e.target.value)}
  placeholder="Phone number"
/>

<input
  value={newCompanyName}
  onChange={(e) => setNewCompanyName(e.target.value)}
  placeholder="Company name (optional)"
/>
            </div>
          </div>

          <div className="form-actions">
            <button
              className="btn-primary"
              type="submit"
              disabled={saving}
            >
              {saving ? "Adding Truck..." : "＋ Add Truck"}
            </button>
          </div>
        </form>
      </section>

      {/* ALL TRUCKS */}
      <div className="section-title second-section">
        <div>
          <h2>All Trucks</h2>
          <p>Every vehicle registered in TruckFlow.</p>
        </div>
      </div>

      <section className="page-card table-card">
        {loading ? (
          <div className="loading-state">
            Loading trucks...
          </div>
        ) : trucks.length === 0 ? (
          <div className="empty-state">
            <span>🚛</span>
            <strong>No trucks registered yet</strong>
            <p>Add your first truck above.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table polished-table">
              <thead>
                <tr>
                  <th>Truck</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {trucks.map((truck) => (
                  <tr key={truck.id}>
                    {editingId === truck.id ? (
                      <>
                        <td>
                          <div className="inline-edit-fields">
                            <input
                              value={
                                editValues.plate_number
                              }
                              onChange={(e) =>
                                setEditValues({
                                  ...editValues,
                                  plate_number:
                                    e.target.value,
                                })
                              }
                            />

                            <input
                              value={editValues.make}
                              onChange={(e) =>
                                setEditValues({
                                  ...editValues,
                                  make: e.target.value,
                                })
                              }
                            />

                            <input
                              value={editValues.model}
                              onChange={(e) =>
                                setEditValues({
                                  ...editValues,
                                  model: e.target.value,
                                })
                              }
                            />
                          </div>
                        </td>

                        <td>
                          <select
                            value={
                              editValues.customer_id
                            }
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                customer_id:
                                  e.target.value,
                              })
                            }
                          >
                            <option value="">
                              No customer
                            </option>

                            {customers.map((customer) => (
                              <option
                                key={customer.id}
                                value={customer.id}
                              >
                                {customer.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>—</td>

                        <td className="actions-cell">
                          <button
                            className="btn-save"
                            onClick={() =>
                              saveEdit(truck.id)
                            }
                          >
                            Save
                          </button>

                          <button
                            className="btn-cancel"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <div className="truck-table-name">
                            <span className="mini-truck-icon">
                              🚛
                            </span>

                            <div>
                              <strong>
                                {truck.plate_number}
                              </strong>

                              <span>
                                {truck.make || "—"}{" "}
                                {truck.model || ""}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {truck.customers?.name || "—"}
                        </td>

                        <td>
                          {truck.customers?.phone || "—"}
                        </td>

                        <td className="actions-cell">
                          <button
                            className="btn-edit"
                            onClick={() =>
                              startEdit(truck)
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="btn-delete"
                            onClick={() =>
                              handleDelete(truck.id)
                            }
                          >
                            Delete
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}

export default TrucksPage;