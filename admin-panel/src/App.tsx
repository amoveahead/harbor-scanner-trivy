import { useEffect, useState, type FormEvent } from "react";
import { getToken, setToken } from "./api";
import { Api } from "./Api";
import { DBs } from "./DBs";
import { Icon } from "./icons";
import { Overview } from "./Overview";
import { ScanDetail } from "./ScanDetail";
import { Scans } from "./Scans";

// Pages are kept in the URL hash (#/overview, #/dbs, #/scans, #/scans/<id>), so
// the static build needs no server-side routes.
function currentRoute(): string[] {
  return window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
}

// The theme is the hospital app's: body[data-theme], dark by default, kept in
// localStorage under "theme".
export function savedTheme(): string {
  try {
    return localStorage.getItem("theme") ?? "dark";
  } catch {
    return "dark";
  }
}

// Below this width the sidebar covers the page, as in the hospital app.
const narrow = () => window.innerWidth <= 992;

const pages = [
  { path: "overview", label: "Overview", icon: "activity", title: "Overview", note: "GET /api/v2/health of the replica that answered, every 10 s" },
  { path: "scans", label: "Scans", icon: "list", title: "Scans", note: "GET /api/v2/scans, newest first" },
  { path: "dbs", label: "Vulnerability DBs", icon: "database", title: "Vulnerability DBs", note: "GET /api/v2/db: every instance's Trivy DB and Java DB" },
  { path: "api", label: "API", icon: "terminal", title: "API", note: "Endpoints, probes and a console to call them" },
];

export function App() {
  const [token, setTokenState] = useState(getToken());
  const [route, setRoute] = useState(currentRoute());
  const [theme, setTheme] = useState(savedTheme());
  const [collapsed, setCollapsed] = useState(narrow());

  useEffect(() => {
    const onChange = () => {
      setRoute(currentRoute());
      if (narrow()) {
        setCollapsed(true);
      }
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // private window: the theme just is not remembered
    }
  }, [theme]);

  function signOut() {
    setToken("");
    setTokenState("");
  }

  if (!token) {
    return <SignIn onSignIn={(value) => (setToken(value), setTokenState(value))} />;
  }

  const page = route[0] ?? "overview";
  const go = (path: string) => {
    window.location.hash = `#/${path}`;
  };
  const current = pages.find((item) => item.path === page) ?? pages[0];
  let title = current.title;
  let note = current.note;
  let content;
  if (page === "dbs") {
    content = <DBs onUnauthorized={signOut} />;
  } else if (page === "scans" && route[1]) {
    title = "Scan";
    note = `GET /api/v2/scans/${route[1]}`;
    content = <ScanDetail id={route[1]} onBack={() => go("scans")} onUnauthorized={signOut} />;
  } else if (page === "scans") {
    content = <Scans onOpen={(id) => go(`scans/${id}`)} onUnauthorized={signOut} />;
  } else if (page === "api") {
    content = <Api />;
  } else {
    content = <Overview onUnauthorized={signOut} />;
  }

  return (
    <>
      <div className={collapsed ? "app-layout sidebar-collapsed" : "app-layout"}>
        <aside className="app-sidebar">
          <div className="sidebar-logo-organization-box">
            <button id="sidebar-close-button" type="button" title="Close menu" onClick={() => setCollapsed(true)}>
              <Icon name="x" />
            </button>
            <a href="#/overview" className="logo-org-link">
              <Brand />
            </a>
          </div>
          <ul className="sidebar-menu">
            {pages.map((item) => (
              <li key={item.path}>
                <a href={`#/${item.path}`} className={page === item.path ? "active" : ""}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="sidebar-footer">
            <div className="user-profile-box">
              <span>Signed in with the API token</span>
              <button type="button" className="btn btn-secondary" onClick={signOut}>
                <Icon name="log-out" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </aside>
        <main className="app-content">
          <header className="app-header">
            <button id="sidebar-toggle" type="button" title="Toggle menu" onClick={() => setCollapsed(!collapsed)}>
              <Icon name="menu" />
            </button>
            <h1>Scanner admin</h1>
            <div className="header-actions">
              <button
                id="theme-toggle-button"
                type="button"
                className="fab-button"
                title="Toggle theme"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Icon name={theme === "dark" ? "sun" : "moon"} />
              </button>
              <button type="button" className="fab-button" title="Sign out" onClick={signOut}>
                <Icon name="log-out" />
              </button>
            </div>
          </header>
          <div className="main-content-area">
            <div className="page-header">
              <div className="page-title-group">
                <h2>{title}</h2>
                <p>{note}</p>
              </div>
            </div>
            {content}
          </div>
        </main>
      </div>
    </>
  );
}

function Brand() {
  return (
    <div className="brand">
      <Icon name="shield" />
      <div>
        <p className="brand-name">Scanner</p>
        <p className="brand-sub">direct scan API</p>
      </div>
    </div>
  );
}

// SignIn takes the API token (SCANNER_V2_AUTH_TOKEN). It is kept in this
// browser tab's session storage only. Laid out as the hospital login page.
function SignIn({ onSignIn }: { onSignIn: (token: string) => void }) {
  const [value, setValue] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (value.trim()) {
      onSignIn(value.trim());
    }
  }
  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="logo-organization-box">
              <Brand />
            </div>
            <h4>Sign in</h4>
            <p>with the scanner's API token</p>
          </div>
          <form onSubmit={submit}>
            <div className="login-form-group">
              <label className="login-label" htmlFor="token">
                API token
              </label>
              <div className="custom-input-wrapper">
                <input
                  id="token"
                  className="custom-input-field"
                  type="password"
                  autoComplete="off"
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="btn-login">
              Sign in
            </button>
          </form>
          <p className="login-note">SCANNER_V2_AUTH_TOKEN. Kept in this browser tab only.</p>
        </div>
      </div>
    </div>
  );
}
