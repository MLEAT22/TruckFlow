import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

function DashboardLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: "▦" },
  { path: "/trucks", label: "Trucks", icon: "🚛" },
  { path: "/repairs", label: "Repairs", icon: "🔧" },
  { path: "/mechanics", label: "Mechanics", icon: "👷" },
  { path: "/history", label: "History", icon: "🕘" },
  { path: "/finance", label: "Finance", icon: "💰" },
  { path: "/reports", label: "Reports", icon: "📊" },
];

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">🚛</div>
          <h1>TruckFlow</h1>
        </div>
        <nav className="sidebar-navigation">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item">
            <span>⚙</span>
            Settings
          </button>
          <button className="nav-item logout" onClick={handleSignOut}>
            <span>↪</span>
            Sign Out
          </button>
        </div>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h2>Dashboard</h2>
            <p>Welcome to TruckFlow</p>
          </div>
          <div className="user-info">
            <div className="user-avatar">T</div>
            <div>
              <strong>Test User</strong>
              <span>Administrator</span>
            </div>
          </div>
        </header>
        <section className="dashboard-content">{children}</section>
      </main>
    </div>
  );
}

export default DashboardLayout;