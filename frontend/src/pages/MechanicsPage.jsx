import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import DashboardLayout from '../layouts/DashboardLayout'

function MechanicsPage() {
  const [employees, setEmployees] = useState([])
  const [branches, setBranches] = useState([])
  const [payroll, setPayroll] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [activeSection, setActiveSection] = useState('mechanic')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')

  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [editingId, setEditingId] = useState(null)

  const emptyForm = {
    name: '',
    employee_type: 'mechanic',
    phone: '',
    email: '',
    address: '',
    gender: '',
    date_of_birth: '',
    hire_date: '',
    branch_id: '',
    position: '',
    weekly_salary: '',
    salary_frequency: 'weekly',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    employment_status: 'active',
    notes: '',
    photo: null,
  }

  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    fetchEmployees()
    fetchBranches()
  }, [])

  async function fetchEmployees() {
    setLoading(true)

    const { data, error } = await supabase
      .from('mechanics')
      .select(`
        *,
        branches(id, name),
        job_items(
          id,
          description,
          quantity,
          total_price,
          job_id,
          jobs(
            status,
            trucks(plate_number)
          )
        )
      `)
      .order('name')

    if (error) {
      console.error('Employees error:', error)
      setEmployees([])
    } else {
      setEmployees(data || [])
    }

    setLoading(false)
  }

  async function fetchBranches() {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name')
      .order('name')

    if (!error) {
      setBranches(data || [])
    }
  }

  async function fetchPayroll(employeeId) {
    const { data, error } = await supabase
      .from('payroll')
      .select('*')
      .eq('mechanic_id', employeeId)
      .order('pay_start', { ascending: false })
      .limit(8)

    if (!error) {
      setPayroll(data || [])
    } else {
      setPayroll([])
    }
  }

  function openEmployee(employee) {
    setSelectedEmployee(employee)

    if (employee.employee_type === 'mechanic') {
      fetchPayroll(employee.id)
    } else {
      setPayroll([])
    }
  }

  function closeDetails() {
    setSelectedEmployee(null)
    setPayroll([])
  }

  function updateForm(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  function openAddModal() {
    setEditingId(null)

    setForm({
      ...emptyForm,
      employee_type: activeSection,
    })

    setShowAddModal(true)
  }

  function closeAddModal() {
    if (saving) return

    setShowAddModal(false)
    setEditingId(null)
    setForm(emptyForm)
  }
function getActiveJobCount(employee) {
  return (
    employee?.job_items?.filter(
      (item) => item.jobs?.status !== 'ready'
    ).length || 0
  )
}
  function startEdit(employee) {
    setEditingId(employee.id)

    setForm({
      name: employee.name || '',
      employee_type: employee.employee_type || 'mechanic',
      phone: employee.phone || '',
      email: employee.email || '',
      address: employee.address || '',
      gender: employee.gender || '',
      date_of_birth: employee.date_of_birth || '',
      hire_date: employee.hire_date || '',
      branch_id: employee.branch_id || '',
      position: employee.position || '',
      weekly_salary: employee.weekly_salary || '',
      salary_frequency: employee.salary_frequency || 'weekly',
      emergency_contact_name: employee.emergency_contact_name || '',
      emergency_contact_phone: employee.emergency_contact_phone || '',
      employment_status: employee.employment_status || 'active',
      notes: employee.notes || '',
      photo: null,
    })

    setShowAddModal(true)
  }

  async function uploadEmployeePhoto(file, employeeId) {
    if (!file) return null

    const extension = file.name.split('.').pop()
    const filePath = `${employeeId}-${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('employee-photos')
      .upload(filePath, file, {
        upsert: true,
      })

    if (uploadError) {
      console.error('Photo upload error:', uploadError)
      throw new Error(
        'Employee was saved, but the photo could not be uploaded.'
      )
    }

    const { data } = supabase.storage
      .from('employee-photos')
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  async function handleSaveEmployee(e) {
    e.preventDefault()

    if (!form.name.trim()) {
      alert('Please enter the employee name.')
      return
    }

    setSaving(true)

    try {
      const employeeData = {
        name: form.name.trim(),
        employee_type: form.employee_type,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        hire_date: form.hire_date || null,
        branch_id: form.branch_id || null,
        position: form.position.trim() || null,
        weekly_salary: Number(form.weekly_salary || 0),
        salary_frequency: form.salary_frequency || 'weekly',
        emergency_contact_name:
          form.emergency_contact_name.trim() || null,
        emergency_contact_phone:
          form.emergency_contact_phone.trim() || null,
        employment_status: form.employment_status || 'active',
        notes: form.notes.trim() || null,
      }

      let employeeId = editingId

      if (editingId) {
        const { error } = await supabase
          .from('mechanics')
          .update(employeeData)
          .eq('id', editingId)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('mechanics')
          .insert(employeeData)
          .select()
          .single()

        if (error) throw error

        employeeId = data.id
      }

      if (form.photo) {
        const photoUrl = await uploadEmployeePhoto(
          form.photo,
          employeeId
        )

        const { error: photoError } = await supabase
          .from('mechanics')
          .update({
            photo_url: photoUrl,
          })
          .eq('id', employeeId)

        if (photoError) throw photoError
      }

      closeAddModal()
      await fetchEmployees()

      alert(
        editingId
          ? 'Employee information updated successfully.'
          : 'Employee added successfully.'
      )
    } catch (error) {
      console.error('Save employee error:', error)
      alert(error.message || 'Could not save employee.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
  const confirmed = window.confirm(
    "Are you sure you want to delete this employee?"
  );

  if (!confirmed) return;

  try {
    const { error } = await supabase
      .from("mechanics")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete employee error:", error);
      alert("Failed to delete employee.");
      return;
    }

    // Remove the employee from the page immediately
    setEmployees((currentEmployees) =>
      currentEmployees.filter((employee) => employee.id !== id)
    );

    // Close the details panel if this employee was selected
    if (selectedEmployee?.id === id) {
      closeDetails();
    }

    alert("Employee deleted successfully.");
  } catch (error) {
    console.error("Unexpected delete error:", error);
    alert("Something went wrong while deleting the employee.");
  }
};

  const sectionEmployees = useMemo(() => {
    return employees.filter(
      (employee) =>
        (employee.employee_type || 'mechanic') === activeSection
    )
  }, [employees, activeSection])

  const filteredEmployees = useMemo(() => {
    return sectionEmployees.filter((employee) => {
      const searchValue = search.trim().toLowerCase()

      const matchesSearch =
        !searchValue ||
        employee.name?.toLowerCase().includes(searchValue) ||
        employee.phone?.toLowerCase().includes(searchValue) ||
        employee.position?.toLowerCase().includes(searchValue)

      const matchesBranch =
        branchFilter === 'all' ||
        String(employee.branch_id) === String(branchFilter)

      return matchesSearch && matchesBranch
    })
  }, [
    sectionEmployees,
    search,
    branchFilter,
  ])

  const sectionCounts = {
    contract: employees.filter(
      (employee) => employee.employee_type === 'contract'
    ).length,

    permanent: employees.filter(
      (employee) => employee.employee_type === 'permanent'
    ).length,

    mechanic: employees.filter(
      (employee) =>
        !employee.employee_type ||
        employee.employee_type === 'mechanic'
    ).length,
  }

  const activeEmployeeCount = employees.filter(
    (employee) => employee.employment_status === 'active'
  ).length

  return (
    <DashboardLayout>
      <div className="employee-page">

        {/* HEADER */}
        <div className="employee-page-header">
          <div>
            <span className="employee-eyebrow">
              PEOPLE & STAFF
            </span>

            <h2>Employee Management</h2>

            <p>
              Manage your mechanics and employees, their
              information, assignments and payroll.
            </p>
          </div>

          <div className="employee-header-stat">
            <strong>{activeEmployeeCount}</strong>
            <span>active employees</span>
          </div>
        </div>

        {/* EMPLOYEE SECTIONS */}
        <div className="employee-sections">

          <button
            className={`employee-section-tab ${
              activeSection === 'contract' ? 'active' : ''
            }`}
            onClick={() => {
              setActiveSection('contract')
              setSearch('')
              setBranchFilter('all')
              closeDetails()
            }}
          >
            <div className="employee-section-icon">
              ◈
            </div>

            <div>
              <strong>Contract Employees</strong>
              <span>
                Temporary & contract staff
              </span>
            </div>

            <b>{sectionCounts.contract}</b>
          </button>

          <button
            className={`employee-section-tab ${
              activeSection === 'permanent' ? 'active' : ''
            }`}
            onClick={() => {
              setActiveSection('permanent')
              setSearch('')
              setBranchFilter('all')
              closeDetails()
            }}
          >
            <div className="employee-section-icon">
              ◉
            </div>

            <div>
              <strong>Permanent Employees</strong>
              <span>
                Full-time permanent staff
              </span>
            </div>

            <b>{sectionCounts.permanent}</b>
          </button>

          <button
            className={`employee-section-tab ${
              activeSection === 'mechanic' ? 'active' : ''
            }`}
            onClick={() => {
              setActiveSection('mechanic')
              setSearch('')
              setBranchFilter('all')
              closeDetails()
            }}
          >
            <div className="employee-section-icon">
              ⚙
            </div>

            <div>
              <strong>Mechanics</strong>
              <span>
                Garage repair specialists
              </span>
            </div>

            <b>{sectionCounts.mechanic}</b>
          </button>

        </div>

        {/* TOOLBAR */}
        <div className="employee-toolbar">

          <div className="employee-search">
            <span>⌕</span>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${
                activeSection === 'mechanic'
                  ? 'mechanics'
                  : 'employees'
              }...`}
            />
          </div>

          <select
            value={branchFilter}
            onChange={(e) =>
              setBranchFilter(e.target.value)
            }
          >
            <option value="all">All branches</option>

            {branches.map((branch) => (
              <option
                key={branch.id}
                value={branch.id}
              >
                {branch.name}
              </option>
            ))}
          </select>

          <button
            className="employee-add-button"
            onClick={openAddModal}
          >
            <span>＋</span>
            Add Employee
          </button>

        </div>

        {/* SECTION TITLE */}
        <div className="employee-list-heading">
          <div>
            <h3>
              {activeSection === 'contract'
                ? 'Contract Employees'
                : activeSection === 'permanent'
                ? 'Permanent Employees'
                : 'Mechanics'}
            </h3>

            <p>
              {filteredEmployees.length}{' '}
              {filteredEmployees.length === 1
                ? 'person'
                : 'people'}{' '}
              in this section
            </p>
          </div>
        </div>

        {/* EMPLOYEE TABLE */}
        {loading ? (
          <div className="employee-empty-card">
            <div className="employee-loading-spinner" />
            <h3>Loading employees...</h3>
            <p>Getting employee information from the system.</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="employee-empty-card">
            <div className="employee-empty-icon">
              {activeSection === 'mechanic' ? '⚙' : '♙'}
            </div>
            <h3>
              No {activeSection === 'contract' ? 'contract employees' : activeSection === 'permanent' ? 'permanent employees' : 'mechanics'} yet
            </h3>
            <p>Add your first employee to start building your staff directory.</p>
            <button className="employee-add-button" onClick={openAddModal}>
              ＋ Add Employee
            </button>
          </div>
        ) : (
          <div className="employee-table-wrapper">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Position</th>
                  <th>Phone</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="employee-table-row"
                    onClick={() => openEmployee(employee)}
                  >
                    <td>
                      <div className="employee-table-person">
                        <div className="employee-table-photo">
                          {employee.photo_url ? (
                            <img src={employee.photo_url} alt={employee.name} />
                          ) : (
                            <span>{employee.name?.charAt(0)?.toUpperCase() || '?'}</span>
                          )}
                        </div>
                        <div>
                          <strong>{employee.name}</strong>
                          <small>
                            {employee.employee_type === 'contract'
                              ? 'Contract Employee'
                              : employee.employee_type === 'permanent'
                              ? 'Permanent Employee'
                              : 'Mechanic'}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {employee.position ||
                        (employee.employee_type === 'mechanic' ? 'Mechanic' : 'Employee')}
                    </td>
                    <td>{employee.phone || 'Not provided'}</td>
                    <td>{employee.branches?.name || 'No branch assigned'}</td>
                    <td>
                      <span
                        className={
                          employee.employment_status === 'active'
                            ? 'employee-status-active'
                            : 'employee-status-inactive'
                        }
                      >
                        {employee.employment_status || 'active'}
                      </span>
                    </td>
                    <td>
                      <div className="employee-table-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="employee-edit-button"
                          onClick={() => startEdit(employee)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="employee-delete-button"
                          onClick={() => handleDelete(employee.id)}
                        >
                          Delete
                        </button>
                        <span className="employee-table-arrow">→</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* EMPLOYEE DETAILS */}
        {selectedEmployee && (
          <div className="employee-details-card">

            <div className="employee-details-header">

              <div className="employee-details-person">

                <div className="employee-photo large">

                  {selectedEmployee.photo_url ? (
                    <img
                      src={selectedEmployee.photo_url}
                      alt={selectedEmployee.name}
                    />
                  ) : (
                    <span>
                      {selectedEmployee.name
                        ?.charAt(0)
                        ?.toUpperCase()}
                    </span>
                  )}

                </div>

                <div>
                  <span className="employee-detail-eyebrow">
                    {selectedEmployee.employee_type ===
                    'contract'
                      ? 'CONTRACT EMPLOYEE'
                      : selectedEmployee.employee_type ===
                        'permanent'
                      ? 'PERMANENT EMPLOYEE'
                      : 'MECHANIC'}
                  </span>

                  <h2>
                    {selectedEmployee.name}
                  </h2>

                  <p>
                    {selectedEmployee.position ||
                      'Employee'}
                    {' · '}
                    {selectedEmployee.branches?.name ||
                      'No branch assigned'}
                  </p>
                </div>

              </div>

              <button
                className="employee-details-close"
                onClick={closeDetails}
              >
                ×
              </button>

            </div>

            {/* PERSONAL INFORMATION */}
            <div className="employee-detail-section">

              <div className="employee-detail-section-title">
                <div>
                  <span>01</span>
                  <h3>Personal Information</h3>
                </div>
              </div>

              <div className="employee-info-grid">

                <div>
                  <span>Full name</span>
                  <strong>
                    {selectedEmployee.name ||
                      'Not provided'}
                  </strong>
                </div>

                <div>
                  <span>Phone number</span>
                  <strong>
                    {selectedEmployee.phone ||
                      'Not provided'}
                  </strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>
                    {selectedEmployee.email ||
                      'Not provided'}
                  </strong>
                </div>

                <div>
                  <span>Gender</span>
                  <strong>
                    {selectedEmployee.gender ||
                      'Not provided'}
                  </strong>
                </div>

                <div>
                  <span>Date of birth</span>
                  <strong>
                    {selectedEmployee.date_of_birth ||
                      'Not provided'}
                  </strong>
                </div>

                <div className="employee-info-wide">
                  <span>Address</span>
                  <strong>
                    {selectedEmployee.address ||
                      'Not provided'}
                  </strong>
                </div>

              </div>

            </div>

            {/* EMPLOYMENT INFORMATION */}
            <div className="employee-detail-section">

              <div className="employee-detail-section-title">
                <div>
                  <span>02</span>
                  <h3>Employment Information</h3>
                </div>
              </div>

              <div className="employee-info-grid">

                <div>
                  <span>Position</span>
                  <strong>
                    {selectedEmployee.position ||
                      'Not provided'}
                  </strong>
                </div>

                <div>
                  <span>Branch</span>
                  <strong>
                    {selectedEmployee.branches?.name ||
                      'Not assigned'}
                  </strong>
                </div>

                <div>
                  <span>Hire date</span>
                  <strong>
                    {selectedEmployee.hire_date ||
                      'Not provided'}
                  </strong>
                </div>

                <div>
                  <span>Employment status</span>
                  <strong>
                    {selectedEmployee.employment_status ||
                      'active'}
                  </strong>
                </div>

                <div>
                  <span>Salary</span>
                  <strong>
                    ETB{' '}
                    {Number(
                      selectedEmployee.weekly_salary ||
                        0
                    ).toLocaleString()}
                  </strong>
                  <small>
                    /{' '}
                    {selectedEmployee.salary_frequency ||
                      'weekly'}
                  </small>
                </div>

              </div>

            </div>

            {/* EMERGENCY CONTACT */}
            <div className="employee-detail-section">

              <div className="employee-detail-section-title">
                <div>
                  <span>03</span>
                  <h3>Emergency Contact</h3>
                </div>
              </div>

              <div className="employee-info-grid">

                <div>
                  <span>Name</span>
                  <strong>
                    {selectedEmployee.emergency_contact_name ||
                      'Not provided'}
                  </strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>
                    {selectedEmployee.emergency_contact_phone ||
                      'Not provided'}
                  </strong>
                </div>

              </div>

            </div>

            {/* MECHANIC WORK HISTORY */}
            {selectedEmployee.employee_type ===
              'mechanic' && (
              <>
                <div className="employee-detail-section">

                  <div className="employee-detail-section-title">
                    <div>
                      <span>04</span>
                      <h3>Mechanic Work History</h3>
                    </div>
                  </div>

                  <div className="employee-detail-summary">
                    <div>
                      <span>Active assignments</span>
                      <strong>
                        {getActiveJobCount(
                          selectedEmployee
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Weekly salary</span>
                      <strong>
                        ETB{' '}
                        {Number(
                          selectedEmployee.weekly_salary ||
                            0
                        ).toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  {!selectedEmployee.job_items ||
                  selectedEmployee.job_items.length ===
                    0 ? (
                    <p className="employee-detail-empty">
                      No work recorded for this mechanic
                      yet.
                    </p>
                  ) : (
                    <div className="employee-history-table">

                      <div className="employee-history-head">
                        <span>Description</span>
                        <span>Quantity</span>
                        <span>Truck</span>
                        <span>Total</span>
                      </div>

                      {selectedEmployee.job_items.map(
                        (item) => (
                          <div
                            className="employee-history-row"
                            key={item.id}
                          >
                            <span>
                              {item.description}
                            </span>

                            <span>
                              {item.quantity}
                            </span>

                            <span>
                              {item.jobs?.trucks
                                ?.plate_number ||
                                '—'}
                            </span>

                            <strong>
                              ETB{' '}
                              {Number(
                                item.total_price || 0
                              ).toLocaleString()}
                            </strong>
                          </div>
                        )
                      )}

                    </div>
                  )}

                </div>

                {/* PAYROLL */}
                <div className="employee-detail-section">

                  <div className="employee-detail-section-title">
                    <div>
                      <span>05</span>
                      <h3>Recent Payroll</h3>
                    </div>
                  </div>

                  {payroll.length === 0 ? (
                    <p className="employee-detail-empty">
                      No payroll recorded for this
                      mechanic yet.
                    </p>
                  ) : (
                    <div className="employee-history-table">

                      <div className="employee-history-head">
                        <span>Period</span>
                        <span>Type</span>
                        <span>Status</span>
                        <span>Amount</span>
                      </div>

                      {payroll.map((item) => (
                        <div
                          className="employee-history-row"
                          key={item.id}
                        >
                          <span>
                            {item.pay_start} →{' '}
                            {item.pay_end}
                          </span>

                          <span>
                            {item.pay_period}
                          </span>

                          <span>
                            <span
                              className={`employee-payroll-status ${
                                item.paid_status ===
                                'paid'
                                  ? 'paid'
                                  : 'unpaid'
                              }`}
                            >
                              {item.paid_status}
                            </span>
                          </span>

                          <strong>
                            ETB{' '}
                            {Number(
                              item.amount || 0
                            ).toLocaleString()}
                          </strong>
                        </div>
                      ))}

                    </div>
                  )}

                </div>
              </>
            )}

            {/* NOTES */}
            {selectedEmployee.notes && (
              <div className="employee-detail-section">

                <div className="employee-detail-section-title">
                  <div>
                    <span>06</span>
                    <h3>Notes</h3>
                  </div>
                </div>

                <p className="employee-notes">
                  {selectedEmployee.notes}
                </p>

              </div>
            )}

            <div className="employee-details-actions">

              <button
                className="employee-edit-button"
                onClick={() =>
                  startEdit(selectedEmployee)
                }
              >
                Edit Employee
              </button>

              <button
                className="employee-delete-button"
                onClick={() =>
                  handleDelete(selectedEmployee.id)
                }
              >
                Delete Employee
              </button>

            </div>

          </div>
        )}

        {/* ADD / EDIT MODAL */}
        {showAddModal && (
          <div
            className="employee-modal-overlay"
            onMouseDown={(e) => {
              if (
                e.target === e.currentTarget &&
                !saving
              ) {
                closeAddModal()
              }
            }}
          >

            <div className="employee-modal">

              <div className="employee-modal-header">

                <div>
                  <span className="employee-eyebrow">
                    {editingId
                      ? 'UPDATE RECORD'
                      : 'NEW STAFF MEMBER'}
                  </span>

                  <h2>
                    {editingId
                      ? 'Edit Employee'
                      : 'Add Employee'}
                  </h2>

                  <p>
                    Add the employee's important
                    information to their staff profile.
                  </p>
                </div>

                <button
                  className="employee-details-close"
                  onClick={closeAddModal}
                  disabled={saving}
                >
                  ×
                </button>

              </div>

              <form
                className="employee-form"
                onSubmit={handleSaveEmployee}
              >

                {/* PHOTO */}
                <div className="employee-photo-upload">

                  <div className="employee-photo preview">

                    {form.photo ? (
                      <img
                        src={URL.createObjectURL(
                          form.photo
                        )}
                        alt="Preview"
                      />
                    ) : (
                      <span>＋</span>
                    )}

                  </div>

                  <div>
                    <label>
                      Employee photo
                    </label>

                    <p>
                      Use a clear profile photo.
                    </p>

                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) =>
                        updateForm(
                          'photo',
                          e.target.files?.[0] ||
                            null
                        )
                      }
                    />
                  </div>

                </div>

                {/* EMPLOYMENT TYPE */}
                <div className="employee-form-section">

                  <div className="employee-form-section-title">
                    Employment type
                  </div>

                  <div className="employee-type-options">

                    <button
                      type="button"
                      className={
                        form.employee_type ===
                        'contract'
                          ? 'selected'
                          : ''
                      }
                      onClick={() =>
                        updateForm(
                          'employee_type',
                          'contract'
                        )
                      }
                    >
                      Contract
                    </button>

                    <button
                      type="button"
                      className={
                        form.employee_type ===
                        'permanent'
                          ? 'selected'
                          : ''
                      }
                      onClick={() =>
                        updateForm(
                          'employee_type',
                          'permanent'
                        )
                      }
                    >
                      Permanent
                    </button>

                    <button
                      type="button"
                      className={
                        form.employee_type ===
                        'mechanic'
                          ? 'selected'
                          : ''
                      }
                      onClick={() =>
                        updateForm(
                          'employee_type',
                          'mechanic'
                        )
                      }
                    >
                      Mechanic
                    </button>

                  </div>

                </div>

                {/* PERSONAL DETAILS */}
                <div className="employee-form-section">

                  <div className="employee-form-section-title">
                    Personal information
                  </div>

                  <div className="employee-form-grid">

                    <label>
                      Full name *
                      <input
                        value={form.name}
                        onChange={(e) =>
                          updateForm(
                            'name',
                            e.target.value
                          )
                        }
                        placeholder="Full name"
                        required
                      />
                    </label>

                    <label>
                      Phone number
                      <input
                        value={form.phone}
                        onChange={(e) =>
                          updateForm(
                            'phone',
                            e.target.value
                          )
                        }
                        placeholder="+251..."
                      />
                    </label>

                    <label>
                      Email
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          updateForm(
                            'email',
                            e.target.value
                          )
                        }
                        placeholder="employee@email.com"
                      />
                    </label>

                    <label>
                      Gender
                      <select
                        value={form.gender}
                        onChange={(e) =>
                          updateForm(
                            'gender',
                            e.target.value
                          )
                        }
                      >
                        <option value="">
                          Select gender
                        </option>
                        <option value="male">
                          Male
                        </option>
                        <option value="female">
                          Female
                        </option>
                      </select>
                    </label>

                    <label>
                      Date of birth
                      <input
                        type="date"
                        value={form.date_of_birth}
                        onChange={(e) =>
                          updateForm(
                            'date_of_birth',
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label className="wide">
                      Address
                      <input
                        value={form.address}
                        onChange={(e) =>
                          updateForm(
                            'address',
                            e.target.value
                          )
                        }
                        placeholder="Full residential address"
                      />
                    </label>

                  </div>

                </div>

                {/* WORK DETAILS */}
                <div className="employee-form-section">

                  <div className="employee-form-section-title">
                    Employment information
                  </div>

                  <div className="employee-form-grid">

                    <label>
                      Position / job title
                      <input
                        value={form.position}
                        onChange={(e) =>
                          updateForm(
                            'position',
                            e.target.value
                          )
                        }
                        placeholder={
                          form.employee_type ===
                          'mechanic'
                            ? 'e.g. Senior Mechanic'
                            : 'e.g. Accountant'
                        }
                      />
                    </label>

                    <label>
                      Branch
                      <select
                        value={form.branch_id}
                        onChange={(e) =>
                          updateForm(
                            'branch_id',
                            e.target.value
                          )
                        }
                      >
                        <option value="">
                          Select branch
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
                    </label>

                    <label>
                      Salary
                      <input
                        type="number"
                        min="0"
                        value={form.weekly_salary}
                        onChange={(e) =>
                          updateForm(
                            'weekly_salary',
                            e.target.value
                          )
                        }
                        placeholder="0"
                      />
                    </label>

                    <label>
                      Salary frequency
                      <select
                        value={form.salary_frequency}
                        onChange={(e) =>
                          updateForm(
                            'salary_frequency',
                            e.target.value
                          )
                        }
                      >
                        <option value="weekly">
                          Weekly
                        </option>
                        <option value="monthly">
                          Monthly
                        </option>
                        <option value="daily">
                          Daily
                        </option>
                      </select>
                    </label>

                    <label>
                      Hire date
                      <input
                        type="date"
                        value={form.hire_date}
                        onChange={(e) =>
                          updateForm(
                            'hire_date',
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Employment status
                      <select
                        value={form.employment_status}
                        onChange={(e) =>
                          updateForm(
                            'employment_status',
                            e.target.value
                          )
                        }
                      >
                        <option value="active">
                          Active
                        </option>
                        <option value="inactive">
                          Inactive
                        </option>
                        <option value="on_leave">
                          On leave
                        </option>
                      </select>
                    </label>

                  </div>

                </div>

                {/* EMERGENCY CONTACT */}
                <div className="employee-form-section">

                  <div className="employee-form-section-title">
                    Emergency contact
                  </div>

                  <div className="employee-form-grid">

                    <label>
                      Contact name
                      <input
                        value={
                          form.emergency_contact_name
                        }
                        onChange={(e) =>
                          updateForm(
                            'emergency_contact_name',
                            e.target.value
                          )
                        }
                        placeholder="Full name"
                      />
                    </label>

                    <label>
                      Contact phone
                      <input
                        value={
                          form.emergency_contact_phone
                        }
                        onChange={(e) =>
                          updateForm(
                            'emergency_contact_phone',
                            e.target.value
                          )
                        }
                        placeholder="+251..."
                      />
                    </label>

                  </div>

                </div>

                {/* NOTES */}
                <div className="employee-form-section">

                  <div className="employee-form-section-title">
                    Additional notes
                  </div>

                  <label>
                    Notes
                    <textarea
                      value={form.notes}
                      onChange={(e) =>
                        updateForm(
                          'notes',
                          e.target.value
                        )
                      }
                      placeholder="Anything else you want to record about this employee..."
                      rows="4"
                    />
                  </label>

                </div>

                {/* ACTIONS */}
                <div className="employee-form-actions">

                  <button
                    type="button"
                    className="employee-cancel-button"
                    onClick={closeAddModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="employee-save-button"
                    disabled={saving}
                  >
                    {saving
                      ? 'Saving...'
                      : editingId
                      ? 'Save Changes'
                      : 'Add Employee'}
                  </button>

                </div>

              </form>

            </div>

          </div>
        )}

      </div>
    </DashboardLayout>
  )
}

export default MechanicsPage