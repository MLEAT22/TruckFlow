import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

import LoginPage from "./pages/LoginPage";
import OwnerDashboard from "./pages/OwnerDashboard";
import TrucksPage from "./pages/TrucksPage";
import RepairsPage from "./pages/RepairsPage";
import JobDetailPage from './pages/JobDetailPage'
import RepairDetailsPage from './pages/RepairDetailsPage'
import MechanicsPage from "./pages/MechanicsPage";
import FinancePage from "./pages/FinancePage";
import ReportsPage from "./pages/ReportsPage";
import HistoryPage from './pages/HistoryPage'
import HistoryDetailPage from './pages/HistoryDetailPage'
import VehicleHistoryPage from './pages/VehicleHistoryPage'
import HistoryVisitsPage from './pages/HistoryVisitsPage'

import "./App.css";

function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);

      if (session?.user) {
        await getUserRole(session.user.id);
      }

      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      if (session?.user) {
        await getUserRole(session.user.id);
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function getUserRole(authUserId) {
    const { data, error } = await supabase
      .from("staff")
      .select("name, user_role")
      .eq("auth_user_id", authUserId)
      .single();

    if (error) {
      console.error("Could not find staff role:", error);
      setUserRole(null);
      return;
    }

    console.log("Logged in staff member:", data);

    setUserRole(data.user_role);
  }

  if (loading) {
    return <p>Loading...</p>;
  }

  function Protected({ children }) {
    return session ? children : <Navigate to="/login" />;
  }

  function RoleRedirect() {
    if (!session) {
      return <Navigate to="/login" />;
    }

    if (!userRole) {
      return <p>Loading your account...</p>;
    }

    if (userRole === "owner") {
      return <Navigate to="/dashboard" replace />;
    }

    if (userRole === "accountant") {
      return <Navigate to="/finance" replace />;
    }

    if (userRole === "operations_manager") {
      return <Navigate to="/repairs" replace />;
    }

    return <p>Unknown user role: {userRole}</p>;
  }

  return (
    <BrowserRouter>
      <Routes>

        {/* LOGIN */}
        <Route
          path="/login"
          element={
            session ? <RoleRedirect /> : <LoginPage />
          }
        />

        {/* MAIN DASHBOARD */}
        <Route
          path="/dashboard"
          element={
            <Protected>
              <OwnerDashboard />
            </Protected>
          }
        />

        {/* OTHER PAGES */}
        <Route
          path="/trucks"
          element={
            <Protected>
              <TrucksPage />
            </Protected>
          }
        />

        <Route
  path="/repairs"
  element={
    <Protected>
      <RepairsPage />
    </Protected>
  }
/>

<Route
  path="/repairs/:jobId"
  element={
    <Protected>
      <JobDetailPage />
    </Protected>
  }
/>

        <Route
          path="/mechanics"
          element={
            <Protected>
              <MechanicsPage />
            </Protected>
          }
        />

        <Route
          path="/finance"
          element={
            <Protected>
              <FinancePage userRole={userRole} />
            </Protected>
          }
        />
          <Route
  path="/history"
  element={
    <Protected>
      <HistoryPage />
    </Protected>
  }
/>
<Route
  path="/history/:jobId"
  element={
    <Protected>
      <HistoryDetailPage />
    </Protected>
  }
/>
<Route
  path="/history/truck/:plate"
  element={<VehicleHistoryPage />}
/>

        <Route
          path="/reports"
          element={
            <Protected>
              <ReportsPage />
            </Protected>
          }
        />

        {/* DEFAULT */}
        <Route
          path="*"
          element={<RoleRedirect />}
        />
<Route path="/repairs/:jobId" element={<Protected><JobDetailPage /></Protected>} />
<Route path="/history" element={<Protected><HistoryPage /></Protected>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;