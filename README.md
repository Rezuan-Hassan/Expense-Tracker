# AuraFinance — Premium Local-First Personal Wealth & Expense Dashboard

AuraFinance is a beautiful, offline-first personal financial management application designed with a high-fidelity, skeuomorphic "raised glass / glossy plastic" desktop interface. Running fully locally on Windows using a modular Python Flask backend and a clean, offline JSON database storage layer.

---

## 💎 UI/UX Design Aesthetics & Core Style Blueprint

The interface replicates modern, tactile, premium physical panels and glossy plastic capsules:

1. **Curated Matte Palette**: A soft neutral matte background (`#F3EFEA` to `#EFEAE2`) contrasted with deep jewel accents:
   * **Teal Accent (Deep)**: `#0D5D61` (Primary CTA and active states)
   * **Teal Accent (Mint)**: `#29A4A6` (Glowing gradients and spline canvas lines)
   * **Magenta Accent**: `#A81360` (Outflow indicators, metrics, high priorities)
   * **Ochre Gold Accent**: `#D49D43` (Budgets, alerts, warning cues)
2. **3D Specular Molded Glass Cards (`.skeuo-card`)**: Layered drop shadows and double highlights recreate raised physical trays:
   * `box-shadow: 12px 16px 32px rgba(185, 175, 160, 0.35)`
   * `inset 3px 3px 6px rgba(255, 255, 255, 0.95)` (top-left highlights)
   * `inset -4px -4px 8px rgba(160, 150, 135, 0.18)` (bottom-right depth)
3. **Glossy Plastic Embossed Capsules (`.skeuo-button-teal`)**: Highly rounded buttons mimicking embedded capsules:
   * `inset 0 4px 5px rgba(255, 255, 255, 0.42)` (top rim specular glare)
   * `inset 0 -4px 6px rgba(0, 0, 0, 0.35)` (bottom inner creased shadows)
   * `0 8px 20px rgba(13, 93, 97, 0.3)` (saturated glow drop shadow)
4. **Bespoke Spline Canvas Engine ("Sachviers")**: Pure HTML Canvas drawing engine rendering smooth spline cash flow charts, complete with **3D glass spherical beads** that have miniature specular white light reflection points for coordinates.

---

## 🛠️ Complete Feature Matrix

* **Core Financial CRUDs**: Full tracking, creation, editing, and deletion for **Expenses** and **Income Streams** with tags, categories, priority parameters, payment types, and notes.
* **Auto-Duplication & Multi-Faceted Filters**: Instant duplication of transactions, favorite/important parameters toggling, search index matching title/tags/notes, and bulk-deletion.
* **Advanced Undo Recovery**: Persistent transactional Recycle Buffer. Deleting an item prompts an instant floating **Undo Pager** that can reverse deletion.
* **Intelligent Auto-Recurring Daemon**: Spawns subscription billing and salary inflows. Backend automatically checks trigger dates on startup and appends transactions, updating recurring schedules seamlessly.
* **Recessed Budget Alerts**: Visual overspending tracking with split recessed progress tracks and warning alerts when category boundaries are crossed.
* **Savings Targets progress**: Long-term tracking for goals like laptops, setup hardware, or holidays with dynamic percentages.
* **Consolidated Data Portability**: Export entire vaults into standard JSON structures or structured CSV tables. Seamlessly import CSV files from external bank systems.
* **Automatic System Backups**: Creating full database rollback backups on command, including directory management for restoring historical backups.
* **Vault Passcode Security PIN**: Local start-up PIN lock to protect offline files from unauthorized desktop access.
* **System Audit Ledger**: Real-time logging capturing every operation with structured logs for transparency.

---

## 📂 Repository Folder Layout

```
ExpenseTracker/
│
├── backend/
│   ├── app.py                     # Main Python Flask REST API Server
│   ├── requirements.txt           # Dependencies specification
│   ├── expenses.json              # Active Expenses data store
│   ├── income.json                # Active Income streams data store
│   ├── budgets.json               # Budget categories configuration
│   ├── categories.json            # Categories settings (colors, icons)
│   ├── recurring.json             # Recurrent billing rules
│   ├── goals.json                 # Long term savings goals data store
│   ├── settings.json              # Preferences, currencies, security parameters
│   ├── logs.json                  # System operations audit trails
│   ├── undo.json                  # Last-deleted Recycle Buffer
│   ├── backups/                   # Directory housing database recovery files
│   ├── exports/                   # Compiled download files (CSV/JSON)
│   └── logs/                      # Server console logging
│
├── frontend/
│   ├── index.html                 # Grid architecture UI skeleton
│   ├── style.css                  # Beautiful skeuomorphic stylesheet
│   └── script.js                  # Canvas spline engine, DOM interactions, API wrappers
│
├── start_expense_tracker.bat      # Windows automated launcher shell script
│
└── README.md                      # System manual handbook
```

---

## 🚀 Installation & Launch Guide (Windows)

No heavy environment variables, compilation configurations, or online services are required. Simply:

1. **Verify Python**: Ensure **Python 3.8+** is installed on your Windows system and the option "Add Python to PATH" was selected during setup.
2. **Double-click Launch**: Double-click `start_expense_tracker.bat` in the root folder.
3. **Automated Steps**:
   * The script automatically installs Flask.
   * Spawns the Flask API Engine in a quiet background thread.
   * Auto-launches your system default browser to `http://127.0.0.1:8085/`.
4. **Offline Working**: The application remains entirely local. Data is written to `backend/*.json` files.

To stop the server, press `Ctrl+C` inside the command prompt window and close it.

---

## 🔗 Main REST API Endpoint Schemas

All endpoints require the custom security header `X-App-PIN` if startup passcode security is enabled in configurations.

| Endpoint | Method | Action |
| --- | --- | --- |
| `/api/summary` | `GET` | Pulls aggregated statistics: cashflow totals, budget overages, daily/weekly canvas charts vectors |
| `/api/expenses` | `GET` | Fetches, paginates, searches, and filters active expense entries |
| `/api/expenses` | `POST` | Registers a new transaction entry |
| `/api/expenses/<id>` | `PUT`/`DELETE` | Modifies parameters or soft-deletes a specific entry to the recycle buffer |
| `/api/expenses/undo` | `POST` | Pulls back the last deleted transaction from the Recycle Buffer |
| `/api/expenses/bulk-delete` | `POST` | Deletes selected transactions based on ID |
| `/api/expenses/duplicate/<id>` | `POST` | Duplicates transaction details into a new entry |
| `/api/income` | `GET`/`POST` | Fetches or creates passive/salary income streams |
| `/api/categories` | `GET`/`POST` | Pulls custom folders list or creates a custom visual folder |
| `/api/budgets` | `GET`/`POST` | Manages active monthly category limits |
| `/api/recurring` | `GET`/`POST` | Manages recurrent subscriptions and triggers automatic due calculations |
| `/api/goals` | `GET`/`POST` | Updates active savings targets and milestones |
| `/api/settings` | `GET`/`POST` | Reads or writes global parameters, preferred currency symbols, and passcode locks |
| `/api/data/backups` | `GET`/`POST` | Lists historical restore files or compiles an active snapshot backup |
| `/api/data/export/<type>` | `GET` | Compiles and downloads CSV or JSON vault files |
| `/api/data/import` | `POST` | Restores database elements or imports formatted external CSV sheets |
| `/api/logs` | `GET` | Refreshes active audit trail records |

---

## 🛠️ Diagnostics & Troubleshooting

* **Server Port Conflicts**: If port `5000` is already in use by another software process on your system, open `backend/app.py` in an editor and change the port on the last line (e.g. `app.run(port=8080)`), and then update the bat script to point to `http://127.0.0.1:8080/`.
* **Clearing Security Lock**: If you set a security PIN and forget it, simply open the file `backend/settings.json` in a text editor, set `"pin_enabled": false`, `"pin": ""` and restart the application.
* **Corrupt JSON Restoration**: If a system crash or power outage corrupts a JSON file, the backend will automatically detect this on startup, create an entry in the system logs, and attempt to restore from the latest backup in `/backups`.
