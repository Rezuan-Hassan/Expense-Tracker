# 💎 AuraFinance — Premium Local-First Personal Wealth & Expense Dashboard

[![Python Version](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/)
[![Flask Backend](https://img.shields.io/badge/backend-Flask-black.svg)](https://flask.palletsprojects.com/)
[![Frontend](https://img.shields.io/badge/frontend-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS-orange.svg)](#)
[![Storage](https://img.shields.io/badge/storage-Local%20JSON%20Vault-success.svg)](#)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20Offline%20%26%20Local--First-brightgreen.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**AuraFinance** is a high-fidelity, local-first personal financial management application designed with a tactile, skeuomorphic "raised glass and glossy plastic" desktop interface. Running fully offline on Windows with a modular Python Flask backend and an atomic JSON storage engine, your financial data remains completely private, secure, and under your control.

---

## ✨ Key Highlights

- **🔒 100% Local-First & Private**: No cloud sync, no telemetry, no third-party tracking. All financial records stay in your local JSON database.
- **🎨 Tactile Skeuomorphic Aesthetic**: Specular double-highlighted molded glass cards, glossy embossed pill buttons, and a warm neutral matte backdrop.
- **📈 Bespoke Spline Canvas Engine ("Sachviers")**: Pure HTML5 canvas drawing engine that plots cash flow trajectories with interactive 3D glass spherical coordinates and glow reflections.
- **🔁 Intelligent Auto-Recurring Daemon**: Automated subscription tracking and recurring salary inflows executed seamlessly on application boot.
- **🛡️ Disaster Recovery & Undo Buffer**: Persistent transactional recycle buffer with single-click instant undo, alongside automated scheduled database rollbacks.
- **🔐 Vault Passcode Protection**: Optional startup PIN lock to secure your financial vault from unauthorized desktop access.

---

## 🎨 UI/UX Design Aesthetics & Core Style Blueprint

The interface replicates modern, tactile, premium physical desktop panels:

1. **Curated Matte Palette**:
   * **Background**: Soft neutral matte (`#F3EFEA` to `#EFEAE2`)
   * **Teal Accent (Deep)**: `#0D5D61` (Primary CTA and active states)
   * **Teal Accent (Mint)**: `#29A4A6` (Glowing gradients and spline canvas lines)
   * **Magenta Accent**: `#A81360` (Outflow indicators, metrics, high priorities)
   * **Ochre Gold Accent**: `#D49D43` (Budgets, alerts, warning cues)
2. **3D Specular Molded Glass Cards (`.skeuo-card`)**:
   * Layered drop shadows with dual light sources:
     * `box-shadow: 12px 16px 32px rgba(185, 175, 160, 0.35)`
     * `inset 3px 3px 6px rgba(255, 255, 255, 0.95)` (top-left specular highlight)
     * `inset -4px -4px 8px rgba(160, 150, 135, 0.18)` (bottom-right depth shading)
3. **Glossy Plastic Embossed Capsules (`.skeuo-button-teal`)**:
   * Embedded button capsules with tactile feedback:
     * `inset 0 4px 5px rgba(255, 255, 255, 0.42)` (top rim glare)
     * `inset 0 -4px 6px rgba(0, 0, 0, 0.35)` (bottom creased shadow)
     * `0 8px 20px rgba(13, 93, 97, 0.3)` (saturated ambient glow)
4. **Interactive Spline Canvas Engine**:
   * Pure HTML Canvas drawing smooth Bezier curve cash flow charts with 3D spherical glass coordinate beads.

---

## 🛠️ Complete Feature Matrix

* **Comprehensive Financial Tracking**: Full CRUD management for Expenses and Income streams with tags, categories, priority rankings, payment methods, and notes.
* **Smart Filtering & Search**: Instant full-text search across titles, notes, and tags; filter by priority, date range, or favorite status.
* **One-Click Transaction Duplication**: Clone recurring or frequent transactions in a single click.
* **Safety Net Undo System**: Accidental deletions are captured into an active Recycle Buffer, enabling instant restoration via a floating undo notification.
* **Recessed Budget Progress Tracks**: Visual monthly budget tracking with split recessed bars and real-time warnings when category thresholds are crossed.
* **Savings Milestones**: Target goals for devices, trips, or emergency funds with dynamic completion percentages and remaining amounts.
* **Complete Data Portability**: Export your full vault or individual tables to standard JSON or structured CSV. Seamlessly import CSV transaction files from external banks.
* **Snapshot Backups**: On-demand and automated full-database backups with easy point-in-time restoration.
* **Audit Trail**: Real-time structured system event logging tracking all modifications.

---

## 📂 Repository Layout

```
Expense Tracker/
│
├── .gitignore                     # Git exclusion rules (cache, venv, runtime logs)
├── README.md                      # Comprehensive project documentation
├── start_expense_tracker.bat      # One-click Windows desktop launcher
│
├── backend/                       # Python Flask API & Database
│   ├── app.py                     # Main Flask REST server & routing engine
│   ├── requirements.txt           # Python dependency declarations
│   ├── budgets.json               # Category budget allocations & thresholds
│   ├── categories.json            # Categories definitions (icons, themes)
│   ├── expenses.json              # Active expense transactions store
│   ├── goals.json                 # Long-term savings targets store
│   ├── income.json                # Active income sources store
│   ├── logs.json                  # System audit and error logs
│   ├── recurring.json             # Recurring subscription and income schedules
│   ├── settings.json              # User preferences, currency, PIN configuration
│   ├── undo.json                  # Persistent deletion recycle buffer
│   ├── backups/                   # Snapshot database rollback archive
│   ├── exports/                   # Generated CSV & JSON exports
│   └── logs/                      # Server runtime logs
│
└── frontend/                      # Client Application
    ├── index.html                 # Semantic dashboard layout & modals
    ├── style.css                  # Skeuomorphic styling & animations
    └── script.js                  # Spline canvas renderer, state management, API client
```

---

## 🚀 Quick Start & Installation

### Option 1: One-Click Launch (Windows)

1. Ensure **Python 3.8+** is installed on your computer and added to your system `PATH`.
2. Double-click `start_expense_tracker.bat` in the root directory.
3. The launcher will automatically:
   - Verify Python.
   - Install required dependencies (`Flask`, `Werkzeug`).
   - Start the server on `http://127.0.0.1:8085/`.
   - Open your default web browser to the dashboard.

### Option 2: Manual Terminal Setup

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/<repo-name>.git
cd "Expense Tracker"

# 2. (Optional) Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate       # On Windows
# source venv/bin/activate  # On Linux/macOS

# 3. Install dependencies
pip install -r backend/requirements.txt

# 4. Run the Flask backend
python backend/app.py

# 5. Open your browser
# Navigate to http://127.0.0.1:8085/
```

---

## 🔗 REST API Endpoints

All secured routes validate the optional custom header `X-App-PIN` when PIN lock security is enabled.

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/summary` | `GET` | Aggregated statistics, cash flow vectors, budget health |
| `/api/overview` | `GET` | High-level monthly analytics and comparison data |
| `/api/expenses` | `GET`, `POST` | Query paginated/filtered expenses or record a new transaction |
| `/api/expenses/<id>` | `PUT`, `DELETE` | Update transaction details or soft-delete to recycle buffer |
| `/api/expenses/undo` | `POST` | Restore the most recently deleted transaction |
| `/api/expenses/bulk-delete` | `POST` | Delete multiple transactions by ID array |
| `/api/expenses/duplicate/<id>` | `POST` | Duplicate an existing transaction entry |
| `/api/income` | `GET`, `POST` | Retrieve or record income streams |
| `/api/categories` | `GET`, `POST` | List or create custom expense/income categories |
| `/api/budgets` | `GET`, `POST` | Set and inspect category spending limits |
| `/api/recurring` | `GET`, `POST` | Manage subscription schedules and trigger runs |
| `/api/goals` | `GET`, `POST` | Manage savings goals and track milestone completion |
| `/api/settings` | `GET`, `POST` | Read or update currency, theme, and PIN security preferences |
| `/api/data/backups` | `GET`, `POST` | List existing restore points or generate a new snapshot backup |
| `/api/data/export/<type>` | `GET` | Download full vault data as `json` or `csv` |
| `/api/data/import` | `POST` | Import external CSV transactions or restore JSON data |
| `/api/logs` | `GET` | Retrieve system operational logs |

---

## 🛠️ Diagnostics & Troubleshooting

- **Port Conflict (8085)**: If port `8085` is in use, modify the port at the bottom of `backend/app.py` (`app.run(port=...)`) and update the URL in `start_expense_tracker.bat`.
- **Resetting Forgotten PIN**: Open `backend/settings.json` in any text editor, set `"pin_enabled": false` and `"pin": ""`, then save and restart the server.
- **Corrupted Data Protection**: The backend verifies database integrity on startup. If a file is malformed, it automatically creates a log entry and can restore from the latest snapshot in `backend/backups/`.

---

## 📄 License

This project is open-source and distributed under the [MIT License](LICENSE).
