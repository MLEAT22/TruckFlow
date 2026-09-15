import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import DashboardLayout from "../layouts/DashboardLayout";

function RepairsPage() {
  const [jobs, setJobs] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [branches, setBranches] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);

  const [newTruckId, setNewTruckId] = useState("");
  const [newDriverName, setNewDriverName] = useState("");
  const [newBranchId, setNewBranchId] = useState("");

  const [selectedBranch, setSelectedBranch] = useState("all");
  const [plateSearch, setPlateSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    await Promise.all([
      fetchJobs(),
      fetchTrucks(),
      fetchBranches(),
      fetchMaterialRequests(),
    ]);

    setLoading(false);
  }

  async function fetchJobs() {
    const cutoff = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from("jobs")
      .select("*, trucks(plate_number, make, model)")
      .or(`date_out.is.null,date_out.gte.${cutoff}`)
      .order("date_in", { ascending: false });

    if (error) {
      console.error("Jobs error:", error);
      return;
    }

    setJobs(data || []);
  }

  async function fetchTrucks() {
    const { data, error } = await supabase
      .from("trucks")
      .select("id, plate_number, make, model")
      .order("plate_number");

    if (error) {
      console.error("Error loading trucks:", error);
    }

    setTrucks(data || []);
  }

  async function fetchBranches() {
    const { data, error } = await supabase
      .from("branches")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Error loading branches:", error);
    }

    setBranches(data || []);
  }

  async function fetchMaterialRequests() {
    const { data, error } = await supabase
      .from("material_requests")
      .select(
        "id, job_id, item_name, part_number, quantity, fulfilled_status"
      );

    if (error) {
      console.error("Material request error:", error);
      setMaterialRequests([]);
      return;
    }

    setMaterialRequests(data || []);
  }

  async function handleAddJob(e) {
    e.preventDefault();

    if (!newTruckId || !newDriverName || !newBranchId) {
      alert("Please complete all required fields.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("jobs").insert({
      truck_id: newTruckId,
      driver_name: newDriverName.trim(),
      branch_id: newBranchId,
      date_in: new Date().toISOString(),
      status: "in_progress",
    });

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setNewTruckId("");
    setNewDriverName("");
    setNewBranchId("");

    await fetchJobs();

    setSaving(false);
  }

  async function updateStatus(jobId, newStatus) {
    const updates = {
      status: newStatus,
    };

    if (newStatus === "ready") {
      updates.date_out = new Date().toISOString();
    }

    if (newStatus === "in_progress") {
      updates.date_out = null;
    }

    const { error } = await supabase
      .from("jobs")
      .update(updates)
      .eq("id", jobId);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchJobs();
  }

  function getDaysInGarage(dateIn, dateOut) {
    const start = new Date(dateIn);
    const end = dateOut ? new Date(dateOut) : new Date();

    return Math.max(
      0,
      Math.floor(
        (end - start) / (1000 * 60 * 60 * 24)
      )
    );
  }

  function getAgeClass(days) {
    if (days <= 2) return "fresh";
    if (days <= 5) return "warn";
    return "old";
  }

  function getAgeLabel(days) {
    if (days === 0) return "Arrived today";
    if (days === 1) return "1 day in garage";
    return `${days} days in garage`;
  }

  function getBranchName(branchId) {
    return (
      branches.find((branch) => branch.id === branchId)?.name ||
      "Unknown branch"
    );
  }

  function getJobMaterials(jobId) {
    return materialRequests.filter(
      (request) => request.job_id === jobId
    );
  }

  function hasWaitingMaterials(jobId) {
    return getJobMaterials(jobId).some(
      (request) =>
        request.fulfilled_status !== "fulfilled" &&
        request.fulfilled_status !== "delivered"
    );
  }

  const filteredJobs = jobs.filter((job) => {
    const matchesBranch =
      selectedBranch === "all" ||
      job.branch_id === selectedBranch;

    const search = plateSearch.trim().toLowerCase();

    const matchesPlate =
      !search ||
      job.trucks?.plate_number
        ?.toLowerCase()
        .includes(search);

    return matchesBranch && matchesPlate;
  });

  const inProgressJobs = filteredJobs.filter(
    (job) => job.status !== "ready"
  );

  const readyJobs = filteredJobs.filter(
    (job) => job.status === "ready"
  );

  const waitingPartsJobs = inProgressJobs.filter((job) =>
    hasWaitingMaterials(job.id)
  );

  const today = new Date().toISOString().split("T")[0];

  const completedToday = jobs.filter(
    (job) =>
      job.status === "ready" &&
      job.date_out?.startsWith(today)
  );

  return (
    <DashboardLayout>
      {/* HEADER */}
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">WORKSHOP</span>
          <h1>Repairs & Jobs</h1>
          <p>
            Monitor trucks, repairs and workshop activity.
          </p>
        </div>

        <div className="branch-selector-large">
          <span>Branch</span>

          <select
            value={selectedBranch}
            onChange={(e) =>
              setSelectedBranch(e.target.value)
            }
          >
            <option value="all">All Branches</option>

            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="operation-summary">
        <div className="operation-summary-card">
          <div className="summary-icon red">📦</div>

          <div>
            <span>Waiting for Parts</span>
            <strong>{waitingPartsJobs.length}</strong>
          </div>
        </div>

        <div className="operation-summary-card">
          <div className="summary-icon green">✓</div>

          <div>
            <span>Ready Today</span>
            <strong>{completedToday.length}</strong>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <section className="filter-card">
        <div className="filter-search">
          <span>🔎</span>

          <input
            value={plateSearch}
            onChange={(e) => setPlateSearch(e.target.value)}
            placeholder="Search jobs by plate number..."
          />

          {plateSearch && (
            <button
              type="button"
              className="clear-search"
              onClick={() => setPlateSearch("")}
            >
              ×
            </button>
          )}
        </div>

        <div className="filter-info">
          Showing <strong>{filteredJobs.length}</strong> jobs
        </div>
      </section>

      {/* NEW JOB */}
      <div className="section-title second-section">
        <h2>New Job</h2>
        <p>
          Register a truck when it arrives at the garage.
        </p>
      </div>

      <section className="page-card">
        <form onSubmit={handleAddJob}>
          <div className="form-grid">
            <div className="form-field">
              <label>Truck</label>

              <select
                value={newTruckId}
                onChange={(e) =>
                  setNewTruckId(e.target.value)
                }
                required
              >
                <option value="">Select truck</option>

                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    {truck.plate_number} —{" "}
                    {truck.make || ""}{" "}
                    {truck.model || ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Driver Name</label>

              <input
                value={newDriverName}
                onChange={(e) =>
                  setNewDriverName(e.target.value)
                }
                placeholder="Enter driver's name"
                required
              />
            </div>

            <div className="form-field">
              <label>Branch</label>

              <select
                className="branch-select"
                value={newBranchId}
                onChange={(e) =>
                  setNewBranchId(e.target.value)
                }
                required
              >
                <option value="">Select branch</option>

                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button
              className="btn-primary"
              type="submit"
              disabled={saving}
            >
              {saving ? "Creating Job..." : "＋ Create Job"}
            </button>
          </div>
        </form>
      </section>

      {/* JOB BOARD */}
      <div className="section-title second-section">
        <h2>Workshop Job Board</h2>
        <p>
          Trucks currently being worked on and trucks ready
          for collection.
        </p>
      </div>

      {loading ? (
        <div className="page-card loading-state">
          Loading workshop...
        </div>
      ) : (
        <div className="job-board polished-job-board">
          {/* IN PROGRESS */}
          <div className="job-column">
            <div className="job-column-header enhanced">
              <div>
                <span className="column-eyebrow">CURRENT</span>
                <h3>In Progress</h3>
              </div>

              <span className="column-count">
                {inProgressJobs.length}
              </span>
            </div>

            {inProgressJobs.length === 0 ? (
              <div className="empty-column enhanced-empty">
                <span>🚛</span>
                <strong>No trucks in progress</strong>
                <p>
                  Trucks being worked on will appear here.
                </p>
              </div>
            ) : (
              inProgressJobs.map((job) => {
                const days = getDaysInGarage(
                  job.date_in,
                  null
                );

                const materials = getJobMaterials(job.id);

                const waitingMaterials = materials.filter(
                  (item) =>
                    item.fulfilled_status !== "fulfilled" &&
                    item.fulfilled_status !== "delivered"
                );

                return (
                  <Link
                    to={`/repairs/${job.id}`}
                    className="job-card enhanced-job-card"
                    key={job.id}
                  >
                    <div className="job-card-top">
                      <div>
                        <span className="job-card-label">
                          TRUCK
                        </span>

                        <p className="plate">
                          {job.trucks?.plate_number}
                        </p>

                        <p className="truck-model">
                          {job.trucks?.make}{" "}
                          {job.trucks?.model}
                        </p>
                      </div>

                      <span
                        className={`days-badge ${getAgeClass(
                          days
                        )}`}
                      >
                        {getAgeLabel(days)}
                      </span>
                    </div>

                    <div className="job-card-details">
                      <div>
                        <span>Driver</span>
                        <strong>{job.driver_name}</strong>
                      </div>

                      <div>
                        <span>Branch</span>
                        <strong>
                          {getBranchName(job.branch_id)}
                        </strong>
                      </div>
                    </div>

                    {materials.length > 0 && (
                      <div
                        className={`job-material-status ${
                          waitingMaterials.length
                            ? "waiting"
                            : "fulfilled"
                        }`}
                      >
                        <span>📦</span>

                        {waitingMaterials.length
                          ? `${waitingMaterials.length} material(s) waiting`
                          : "All materials fulfilled"}
                      </div>
                    )}

                    <div className="job-card-footer">
                      <span>Open job details →</span>

                      <select
                        value={job.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          updateStatus(
                            job.id,
                            e.target.value
                          );
                        }}
                      >
                        <option value="in_progress">
                          In Progress
                        </option>

                        <option value="ready">Ready</option>
                      </select>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* READY */}
          <div className="job-column ready-column">
            <div className="job-column-header enhanced">
              <div>
                <span className="column-eyebrow">
                  COMPLETED
                </span>
                <h3>Ready</h3>
              </div>

              <span className="column-count ready-count">
                {readyJobs.length}
              </span>
            </div>

            {readyJobs.length === 0 ? (
              <div className="empty-column enhanced-empty">
                <span>🚛</span>
                <strong>No ready trucks</strong>
                <p>
                  Completed jobs will appear here.
                </p>
              </div>
            ) : (
              readyJobs.map((job) => {
                const days = getDaysInGarage(
                  job.date_in,
                  job.date_out
                );

                return (
                  <Link
                    to={`/repairs/${job.id}`}
                    className="job-card enhanced-job-card ready-job"
                    key={job.id}
                  >
                    <div className="job-card-top">
                      <div>
                        <span className="job-card-label">
                          READY
                        </span>

                        <p className="plate">
                          {job.trucks?.plate_number}
                        </p>

                        <p className="truck-model">
                          {job.trucks?.make}{" "}
                          {job.trucks?.model}
                        </p>
                      </div>

                      <span className="days-badge fresh">
                        ✓ Ready
                      </span>
                    </div>

                    <div className="job-card-details">
                      <div>
                        <span>Driver</span>
                        <strong>
                          {job.driver_name}
                        </strong>
                      </div>

                      <div>
                        <span>Time in garage</span>
                        <strong>
                          {days === 0
                            ? "Less than 1 day"
                            : `${days} day(s)`}
                        </strong>
                      </div>
                    </div>

                    <div className="job-card-footer">
                      <span>Open job details →</span>

                      <select
                        value={job.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          updateStatus(
                            job.id,
                            e.target.value
                          );
                        }}
                      >
                        <option value="ready">Ready</option>

                        <option value="in_progress">
                          In Progress
                        </option>
                      </select>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default RepairsPage;