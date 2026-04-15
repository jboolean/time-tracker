import { Routes, Route, NavLink } from "react-router-dom";
import CalendarPage from "./pages/CalendarPage";
import CategoriesPage from "./pages/CategoriesPage";
import ProjectsPage from "./pages/ProjectsPage";
import BottomBar from "./components/BottomBar";
import styles from "./styles/App.module.css";

export default function App() {
  return (
    <div className={styles.root}>
      <nav className={`${styles.nav} surface`}>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
          }
        >
          Calendar
        </NavLink>
        <NavLink
          to="/categories"
          className={({ isActive }) =>
            `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
          }
        >
          Categories
        </NavLink>
        <NavLink
          to="/projects"
          className={({ isActive }) =>
            `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
          }
        >
          Projects
        </NavLink>
      </nav>
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<CalendarPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
        </Routes>
      </main>
      <BottomBar />
    </div>
  );
}
