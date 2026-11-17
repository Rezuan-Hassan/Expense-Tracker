import os
import json
import csv
import datetime
import uuid
import shutil
from flask import Flask, request, jsonify, send_from_directory, make_response
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Constants & Paths
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_DIR = os.path.dirname(BACKEND_DIR)
FRONTEND_DIR = os.path.join(WORKSPACE_DIR, "frontend")

BACKUP_DIR = os.path.join(BACKEND_DIR, "backups")
EXPORT_DIR = os.path.join(BACKEND_DIR, "exports")
LOG_DIR = os.path.join(BACKEND_DIR, "logs")

FILES = {
    "expenses": os.path.join(BACKEND_DIR, "expenses.json"),
    "income": os.path.join(BACKEND_DIR, "income.json"),
    "budgets": os.path.join(BACKEND_DIR, "budgets.json"),
    "recurring": os.path.join(BACKEND_DIR, "recurring.json"),
    "categories": os.path.join(BACKEND_DIR, "categories.json"),
    "settings": os.path.join(BACKEND_DIR, "settings.json"),
    "goals": os.path.join(BACKEND_DIR, "goals.json"),
    "logs": os.path.join(BACKEND_DIR, "logs.json"),
    "undo": os.path.join(BACKEND_DIR, "undo.json")
}

# Ensure directory structures
for path in [BACKUP_DIR, EXPORT_DIR, LOG_DIR]:
    os.makedirs(path, exist_ok=True)

# -------------------------------------------------------------
# CORE LOGGING & DATA HANDLING HELPERS
# -------------------------------------------------------------

def write_log(action, details):
    """Log an activity with timestamp."""
    log_file = FILES["logs"]
    logs = []
    if os.path.exists(log_file):
        try:
            with open(log_file, "r", encoding="utf-8") as f:
                logs = json.load(f)
        except Exception:
            logs = []
    
    logs.insert(0, {
        "timestamp": datetime.datetime.now().isoformat(),
        "action": action,
        "details": details
    })
    
    # Keep last 500 logs to prevent unbounded file size
    logs = logs[:500]
    
    try:
        with open(log_file, "w", encoding="utf-8") as f:
            json.dump(logs, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Logging error: {e}")

def read_json_file(file_key, default_val=None):
    """Generic JSON read helper with recovery options."""
    if default_val is None:
        default_val = []
    file_path = FILES.get(file_key)
    if not file_path:
        return default_val
        
    if not os.path.exists(file_path):
        write_json_file(file_key, default_val)
        return default_val
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return default_val
            return json.loads(content)
    except Exception as e:
        print(f"Error reading {file_key}: {e}. Initializing default and attempting backup recovery.")
        # Attempt recovery if a backup exists
        recover_corrupted_file(file_key)
        # Re-read or return default
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default_val

def write_json_file(file_key, data):
    """Generic JSON write helper."""
    file_path = FILES.get(file_key)
    if not file_path:
        return False
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error writing {file_key}: {e}")
        return False

def recover_corrupted_file(file_key):
    """Placeholder for corrupted file recovery. Attemps to find the latest valid backup."""
    file_path = FILES.get(file_key)
    if not file_path:
        return
    filename = os.path.basename(file_path)
    
    # Look in backups
    backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.endswith(".json")], reverse=True)
    for backup_name in backups:
        # Check if this backup contains the file key
        backup_path = os.path.join(BACKUP_DIR, backup_name)
        try:
            with open(backup_path, "r", encoding="utf-8") as f:
                backup_data = json.load(f)
                if file_key in backup_data:
                    # Restore from backup
                    print(f"Recovering {file_key} from backup {backup_name}")
                    write_json_file(file_key, backup_data[file_key])
                    write_log("RECOVERY", f"Recovered {file_key} from backup {backup_name}")
                    return
        except Exception:
            continue
            
    # If no backup found, just write default
    write_json_file(file_key, [] if file_key != "settings" else default_settings())

# -------------------------------------------------------------
# DEFAULT / MOCK DATA GENERATORS FOR A "WOW" EXPERIENCE
# -------------------------------------------------------------

def default_settings():
    return {
        "currency": "USD",
        "currency_symbol": "$",
        "date_format": "YYYY-MM-DD",
        "pin": "",
        "pin_enabled": False,
        "theme": "warm-matte",
        "language": "en"
    }

def init_default_data():
    """Seed files with beautiful premium defaults if empty."""
    # 1. Settings
    if not os.path.exists(FILES["settings"]):
        write_json_file("settings", default_settings())
        
    # 2. Categories
    if not os.path.exists(FILES["categories"]):
        categories = [
            {"id": "cat_salary", "name": "Salary & Wages", "color": "#0D5D61", "icon": "briefcase", "parent": None},
            {"id": "cat_side", "name": "Side Hustle", "color": "#29A4A6", "icon": "laptop-code", "parent": None},
            {"id": "cat_passive", "name": "Passive Income", "color": "#D49D43", "icon": "chart-line", "parent": None},
            {"id": "cat_housing", "name": "Housing & Rent", "color": "#A81360", "icon": "home", "parent": None},
            {"id": "cat_groceries", "name": "Groceries", "color": "#0D5D61", "icon": "shopping-basket", "parent": None},
            {"id": "cat_dining", "name": "Dining Out", "color": "#29A4A6", "icon": "utensils", "parent": "cat_groceries"},
            {"id": "cat_transport", "name": "Transportation", "color": "#D49D43", "icon": "car", "parent": None},
            {"id": "cat_utilities", "name": "Utilities & Bills", "color": "#A81360", "icon": "bolt", "parent": None},
            {"id": "cat_entertainment", "name": "Entertainment", "color": "#0D5D61", "icon": "film", "parent": None},
            {"id": "cat_savings", "name": "Savings & Investments", "color": "#D49D43", "icon": "piggy-bank", "parent": None}
        ]
        write_json_file("categories", categories)
        
    # 3. Budgets
    if not os.path.exists(FILES["budgets"]):
        budgets = [
            {"id": "bud_1", "category": "Groceries", "limit": 400.0, "period": "monthly", "created_at": datetime.datetime.now().isoformat()},
            {"id": "bud_2", "category": "Dining Out", "limit": 200.0, "period": "monthly", "created_at": datetime.datetime.now().isoformat()},
            {"id": "bud_3", "category": "Entertainment", "limit": 150.0, "period": "monthly", "created_at": datetime.datetime.now().isoformat()}
        ]
        write_json_file("budgets", budgets)

    # 4. Savings Goals
    if not os.path.exists(FILES["goals"]):
        goals = [
            {"id": "goal_1", "title": "Emergency Fund", "target_amount": 10000.0, "current_amount": 5500.0, "target_date": "2026-12-31", "category": "Savings & Investments"},
            {"id": "goal_2", "title": "Premium Web Design Course", "target_amount": 1500.0, "current_amount": 750.0, "target_date": "2026-08-15", "category": "Side Hustle"},
            {"id": "goal_3", "title": "New Designer Desk Setup", "target_amount": 3000.0, "current_amount": 1200.0, "target_date": "2026-10-30", "category": "Housing & Rent"}
        ]
        write_json_file("goals", goals)

    # 5. Income
    if not os.path.exists(FILES["income"]):
        today = datetime.date.today()
        prev_month = today - datetime.timedelta(days=30)
        income = [
            {
                "id": "inc_1",
                "title": "Corporate Tech Salary",
                "amount": 5400.0,
                "category": "Salary & Wages",
                "date": prev_month.strftime("%Y-%m-01"),
                "note": "Primary employment salary payout",
                "source_type": "salary",
                "recurring": True,
                "created_at": datetime.datetime.now().isoformat()
            },
            {
                "id": "inc_2",
                "title": "SaaS Product Dividends",
                "amount": 1200.0,
                "category": "Passive Income",
                "date": prev_month.strftime("%Y-%m-15"),
                "note": "Quarterly automated payout",
                "source_type": "passive",
                "recurring": False,
                "created_at": datetime.datetime.now().isoformat()
            },
            {
                "id": "inc_3",
                "title": "Corporate Tech Salary",
                "amount": 5400.0,
                "category": "Salary & Wages",
                "date": today.strftime("%Y-%m-01"),
                "note": "Primary employment salary payout",
                "source_type": "salary",
                "recurring": True,
                "created_at": datetime.datetime.now().isoformat()
            },
            {
                "id": "inc_4",
                "title": "Freelance Landing Page Contract",
                "amount": 950.0,
                "category": "Side Hustle",
                "date": today.strftime("%Y-%m-10"),
                "note": "Clean portfolio build",
                "source_type": "side",
                "recurring": False,
                "created_at": datetime.datetime.now().isoformat()
            }
        ]
        write_json_file("income", income)

    # 6. Expenses
    if not os.path.exists(FILES["expenses"]):
        today = datetime.date.today()
        prev_month = today - datetime.timedelta(days=30)
        expenses = [
            {
                "id": "exp_1",
                "title": "Cozy Modern Apartment Rent",
                "amount": 1500.0,
                "category": "Housing & Rent",
                "date": prev_month.strftime("%Y-%m-02"),
                "note": "Automatic monthly transfer",
                "tags": ["rent", "housing"],
                "priority": "high",
                "payment_method": "Bank Transfer",
                "status": "completed",
                "favorite": True,
                "important": True,
                "created_at": datetime.datetime.now().isoformat()
            },
            {
                "id": "exp_2",
                "title": "Organic Farm Box Groceries",
                "amount": 145.20,
                "category": "Groceries",
                "date": prev_month.strftime("%Y-%m-05"),
                "note": "Fresh local produce",
                "tags": ["organic", "weekly"],
                "priority": "medium",
                "payment_method": "Credit Card",
                "status": "completed",
                "favorite": False,
                "important": False,
                "created_at": datetime.datetime.now().isoformat()
            },
            {
                "id": "exp_3",
                "title": "Michelin Star Tasting Menu",
                "amount": 280.0,
                "category": "Dining Out",
                "date": prev_month.strftime("%Y-%m-12"),
                "note": "Anniversary celebration",
                "tags": ["special-occasion", "gourmet"],
                "priority": "low",
                "payment_method": "Debit Card",
                "status": "completed",
                "favorite": True,
                "important": False,
                "created_at": datetime.datetime.now().isoformat()
            },
            {
                "id": "exp_4",
                "title": "Cozy Modern Apartment Rent",
                "amount": 1500.0,
                "category": "Housing & Rent",
                "date": today.strftime("%Y-%m-02"),
                "note": "Automatic monthly transfer",
                "tags": ["rent", "housing"],
                "priority": "high",
                "payment_method": "Bank Transfer",
                "status": "completed",
                "favorite": True,
                "important": True,
                "created_at": datetime.datetime.now().isoformat()
            },
            {
                "id": "exp_5",
                "title": "Weekly Grocery Restock",
                "amount": 112.50,
                "category": "Groceries",
                "date": today.strftime("%Y-%m-04"),
                "note": "Pantry essentials and milk",
                "tags": ["essentials"],
                "priority": "medium",
                "payment_method": "Credit Card",
                "status": "completed",
                "favorite": False,
                "important": False,
                "created_at": datetime.datetime.now().isoformat()
            },
            {
                "id": "exp_6",
                "title": "Acoustic Concert Ticket",
                "amount": 85.00,
                "category": "Entertainment",
                "date": today.strftime("%Y-%m-08"),
                "note": "Live performance at the garden",
                "tags": ["music", "concert"],
                "priority": "low",
                "payment_method": "Credit Card",
                "status": "completed",
                "favorite": False,
                "important": False,
                "created_at": datetime.datetime.now().isoformat()
            },
            {
                "id": "exp_7",
                "title": "Premium Coffee Beans",
                "amount": 24.00,
                "category": "Dining Out",
                "date": today.strftime("%Y-%m-12"),
                "note": "Single-origin Ethiopian roast",
                "tags": ["coffee", "daily"],
                "priority": "low",
                "payment_method": "Credit Card",
                "status": "completed",
                "favorite": True,
                "important": False,
                "created_at": datetime.datetime.now().isoformat()
            },
            {
                "id": "exp_8",
                "title": "Fibre Internet Bill",
                "amount": 79.99,
                "category": "Utilities & Bills",
                "date": today.strftime("%Y-%m-15"),
                "note": "1Gbps stable connection",
                "tags": ["internet", "bills"],
                "priority": "high",
                "payment_method": "Credit Card",
                "status": "completed",
                "favorite": False,
                "important": True,
                "created_at": datetime.datetime.now().isoformat()
            }
        ]
        write_json_file("expenses", expenses)

    # 7. Recurring schedules
    if not os.path.exists(FILES["recurring"]):
        recurring = [
            {
                "id": "rec_1",
                "title": "Cozy Modern Apartment Rent",
                "amount": 1500.0,
                "type": "expense",
                "category": "Housing & Rent",
                "frequency": "monthly",
                "next_date": (datetime.date.today() + datetime.timedelta(days=10)).strftime("%Y-%m-%d"),
                "last_generated": datetime.date.today().strftime("%Y-%m-02"),
                "priority": "high",
                "payment_method": "Bank Transfer",
                "note": "Monthly apartment rental"
            },
            {
                "id": "rec_2",
                "title": "SaaS Subscription (Design Tool)",
                "amount": 15.99,
                "type": "expense",
                "category": "Entertainment",
                "frequency": "monthly",
                "next_date": (datetime.date.today() + datetime.timedelta(days=2)).strftime("%Y-%m-%d"),
                "last_generated": "",
                "priority": "medium",
                "payment_method": "Credit Card",
                "note": "Interactive mockups app"
            },
            {
                "id": "rec_3",
                "title": "SaaS Product Dividends",
                "amount": 1200.0,
                "type": "income",
                "category": "Passive Income",
                "frequency": "monthly",
                "next_date": (datetime.date.today() + datetime.timedelta(days=19)).strftime("%Y-%m-%d"),
                "last_generated": "",
                "priority": "medium",
                "payment_method": "Direct Deposit",
                "note": "SaaS dividends"
            }
        ]
        write_json_file("recurring", recurring)

    # 8. Logs
    logs = read_json_file("logs")
    if not logs:
        write_log("SYSTEM_INIT", "Premium Expense Tracker initialized with seed database records.")

# Initialize default data immediately on boot
init_default_data()

# -------------------------------------------------------------
# AUTO GENERATION LOGIC FOR RECURRING TRANSACTIONS
# -------------------------------------------------------------

def process_recurring_due():
    """Automatically parses and spawns recurring income/expense records if past or on due date."""
    recurring_items = read_json_file("recurring")
    expenses = read_json_file("expenses")
    income = read_json_file("income")
    today = datetime.date.today()
    updated = False
    
    for item in recurring_items:
        next_dt_str = item.get("next_date")
        if not next_dt_str:
            continue
        try:
            next_date = datetime.datetime.strptime(next_dt_str, "%Y-%m-%d").date()
        except Exception:
            continue
            
        # If due today or already in the past
        if next_date <= today:
            # Generate the transaction
            tx_id = f"{'exp' if item['type'] == 'expense' else 'inc'}_{uuid.uuid4().hex[:8]}"
            transaction = {
                "id": tx_id,
                "title": item["title"],
                "amount": float(item["amount"]),
                "category": item["category"],
                "date": next_date.strftime("%Y-%m-%d"),
                "note": f"Auto-generated: {item.get('note', '')}".strip(),
                "created_at": datetime.datetime.now().isoformat()
            }
            
            if item["type"] == "expense":
                transaction.update({
                    "tags": ["recurring"],
                    "priority": item.get("priority", "medium"),
                    "payment_method": item.get("payment_method", "Credit Card"),
                    "status": "completed",
                    "favorite": False,
                    "important": False
                })
                expenses.insert(0, transaction)
                write_log("AUTO_RECURRING_EXPENSE", f"Spawned recurring expense: {item['title']} (${item['amount']})")
            else:
                transaction.update({
                    "source_type": "passive",
                    "recurring": True
                })
                income.insert(0, transaction)
                write_log("AUTO_RECURRING_INCOME", f"Spawned recurring income: {item['title']} (${item['amount']})")
            
            # Calculate next run date based on frequency
            freq = item.get("frequency", "monthly")
            if freq == "daily":
                new_next_date = next_date + datetime.timedelta(days=1)
            elif freq == "weekly":
                new_next_date = next_date + datetime.timedelta(weeks=1)
            else:  # monthly
                # Shift by roughly 30 days
                # A robust month increment
                year = next_date.year
                month = next_date.month + 1
                if month > 12:
                    month = 1
                    year += 1
                day = min(next_date.day, 28)  # safe day clamp
                new_next_date = datetime.date(year, month, day)
                
            item["last_generated"] = next_date.strftime("%Y-%m-%d")
            item["next_date"] = new_next_date.strftime("%Y-%m-%d")
            updated = True
            
    if updated:
        write_json_file("recurring", recurring_items)
        write_json_file("expenses", expenses)
        write_json_file("income", income)

# Run once during Flask startup
process_recurring_due()

# -------------------------------------------------------------
# FLASK ROUTING: ASSETS & FRONTEND SERVING
# -------------------------------------------------------------

@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/<path:path>")
def serve_frontend_assets(path):
    return send_from_directory(FRONTEND_DIR, path)

# -------------------------------------------------------------
# SECURITY PIN MIDDLEWARE DECORATORS
# -------------------------------------------------------------

def pin_secured(f):
    """Simple wrapper to enforce local PIN protection if active."""
    # We will verify security headers on all API requests if PIN is enabled
    # The client must send a custom X-App-PIN header if enabled.
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        settings = read_json_file("settings", default_settings())
        if settings.get("pin_enabled") and settings.get("pin"):
            provided_pin = request.headers.get("X-App-PIN")
            if provided_pin != settings.get("pin"):
                return jsonify({"error": "Unauthorized: Security PIN required or incorrect.", "locked": True}), 401
        return f(*args, **kwargs)
    return decorated_function

# -------------------------------------------------------------
# API ROUTES: SECURITY & SETTINGS
# -------------------------------------------------------------

@app.route("/api/security/verify", methods=["POST"])
def verify_pin():
    data = request.json or {}
    pin = data.get("pin", "")
    settings = read_json_file("settings", default_settings())
    
    if not settings.get("pin_enabled"):
        return jsonify({"valid": True, "message": "No PIN enabled"})
        
    if settings.get("pin") == pin:
        write_log("SECURITY", "Correct PIN entered. Session unlocked.")
        return jsonify({"valid": True})
    else:
        write_log("SECURITY_WARN", "Failed passcode entry attempt.")
        return jsonify({"valid": False, "message": "Incorrect PIN code"}), 401

@app.route("/api/settings", methods=["GET", "POST"])
def manage_settings():
    settings = read_json_file("settings", default_settings())
    if request.method == "POST":
        data = request.json or {}
        
        # Protect PIN update if existing PIN is active
        if settings.get("pin_enabled") and settings.get("pin"):
            # Requires current PIN validation to make any changes
            current_pin = request.headers.get("X-App-PIN")
            if current_pin != settings.get("pin"):
                return jsonify({"error": "Auth failed. Correct PIN header needed to alter settings."}), 401
                
        settings["currency"] = data.get("currency", settings.get("currency", "USD"))
        settings["currency_symbol"] = data.get("currency_symbol", settings.get("currency_symbol", "$"))
        settings["date_format"] = data.get("date_format", settings.get("date_format", "YYYY-MM-DD"))
        
        # PIN handling
        new_pin = data.get("pin", "")
        if "pin_enabled" in data:
            settings["pin_enabled"] = bool(data["pin_enabled"])
            if settings["pin_enabled"] and new_pin:
                settings["pin"] = new_pin
            elif not settings["pin_enabled"]:
                settings["pin"] = "" # Clear PIN
                
        write_json_file("settings", settings)
        write_log("SETTINGS_UPDATE", "System configuration preferences adjusted.")
        return jsonify(settings)
        
    return jsonify(settings)

# -------------------------------------------------------------
# API ROUTES: TRANSACTION SUMMARY & ANALYTICS
# -------------------------------------------------------------

@app.route("/api/summary", methods=["GET"])
@pin_secured
def get_summary():
    """Generates the deep dashboard analysis stats."""
    expenses = read_json_file("expenses")
    income = read_json_file("income")
    budgets = read_json_file("budgets")
    goals = read_json_file("goals")
    categories = read_json_file("categories")
    
    # Calculate totals
    total_expenses = sum(float(item["amount"]) for item in expenses)
    total_income = sum(float(item["amount"]) for item in income)
    net_balance = total_income - total_expenses
    
    # Highest & Lowest category expenses
    cat_expenses = {}
    for item in expenses:
        cat = item.get("category", "Uncategorized")
        cat_expenses[cat] = cat_expenses.get(cat, 0.0) + float(item["amount"])
        
    highest_cat = "None"
    highest_amount = 0.0
    lowest_cat = "None"
    lowest_amount = float('inf')
    
    for cat, amt in cat_expenses.items():
        if amt > highest_amount:
            highest_amount = amt
            highest_cat = cat
        if amt < lowest_amount:
            lowest_amount = amt
            lowest_cat = cat
            
    if lowest_amount == float('inf'):
        lowest_cat = "None"
        lowest_amount = 0.0
        
    avg_expense = total_expenses / len(expenses) if expenses else 0.0
    
    # Budget overspending detection
    budget_alerts = []
    # Map category names to expenses
    for bud in budgets:
        bud_cat = bud.get("category", "")
        # Aggregate expenses matching this category in the current month
        # Simple current month match (YYYY-MM)
        now_prefix = datetime.date.today().strftime("%Y-%m")
        cat_spent = sum(
            float(item["amount"]) for item in expenses 
            if item.get("category") == bud_cat and item.get("date", "").startswith(now_prefix)
        )
        
        overspent = cat_spent > float(bud["limit"])
        remaining = float(bud["limit"]) - cat_spent
        
        if overspent:
            budget_alerts.append({
                "category": bud_cat,
                "limit": float(bud["limit"]),
                "spent": cat_spent,
                "overage": abs(remaining)
            })
            
    # Weekly/Monthly cashflow aggregates (last 30 days daily trends)
    # Group past 30 days
    today = datetime.date.today()
    daily_history = {}
    for i in range(29, -1, -1):
        day = today - datetime.timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        daily_history[day_str] = {"expenses": 0.0, "income": 0.0}
        
    for item in expenses:
        dt = item.get("date")
        if dt in daily_history:
            daily_history[dt]["expenses"] += float(item["amount"])
            
    for item in income:
        dt = item.get("date")
        if dt in daily_history:
            daily_history[dt]["income"] += float(item["amount"])
            
    daily_trends = [{"date": k, "expenses": v["expenses"], "income": v["income"]} for k, v in sorted(daily_history.items())]
    
    summary = {
        "total_expenses": total_expenses,
        "total_income": total_income,
        "net_balance": net_balance,
        "average_spending": avg_expense,
        "highest_spending_category": {"category": highest_cat, "amount": highest_amount},
        "lowest_spending_category": {"category": lowest_cat, "amount": lowest_amount},
        "budget_alerts": budget_alerts,
        "daily_trends": daily_trends,
        "total_goals_active": len(goals),
        "recent_activities_count": len(read_json_file("logs"))
    }
    return jsonify(summary)

def parse_year_month(date_str):
    if not date_str or len(date_str) < 7:
        return None, None
    try:
        parts = date_str.split("-")
        return int(parts[0]), int(parts[1])
    except Exception:
        return None, None

def parse_year(date_str):
    if not date_str or len(date_str) < 4:
        return None
    try:
        return int(date_str[:4])
    except Exception:
        return None

def safe_float(val):
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0

@app.route("/api/overview", methods=["GET"])
@pin_secured
def get_overview():
    expenses = read_json_file("expenses")
    income = read_json_file("income")
    
    today = datetime.date.today()
    curr_year = today.year
    curr_month = today.month
    
    # Calculate previous month and its year
    if curr_month == 1:
        prev_month = 12
        prev_month_year = curr_year - 1
    else:
        prev_month = curr_month - 1
        prev_month_year = curr_year
        
    prev_year = curr_year - 1
    
    # Helper to calculate month stats
    def calculate_month_stats(y, m):
        m_expenses = [x for x in expenses if parse_year_month(x.get("date")) == (y, m)]
        m_income = [x for x in income if parse_year_month(x.get("date")) == (y, m)]
        
        tot_inc = sum(safe_float(x.get("amount")) for x in m_income)
        tot_exp = sum(safe_float(x.get("amount")) for x in m_expenses)
        net_bal = tot_inc - tot_exp
        savings = net_bal
        
        cat_map = {}
        for exp in m_expenses:
            cat = exp.get("category", "Uncategorized")
            cat_map[cat] = cat_map.get(cat, 0.0) + safe_float(exp.get("amount"))
            
        top_cat = "None"
        top_amt = 0.0
        for cat, amt in cat_map.items():
            if amt > top_amt:
                top_amt = amt
                top_cat = cat
                
        return {
            "income": tot_inc,
            "expenses": tot_exp,
            "net_balance": net_bal,
            "savings": savings,
            "top_category": top_cat,
            "top_category_amount": top_amt,
            "transactions": len(m_expenses) + len(m_income)
        }
        
    # Helper to calculate year stats
    def calculate_year_stats(y):
        y_expenses = [x for x in expenses if parse_year(x.get("date")) == y]
        y_income = [x for x in income if parse_year(x.get("date")) == y]
        
        tot_inc = sum(safe_float(x.get("amount")) for x in y_income)
        tot_exp = sum(safe_float(x.get("amount")) for x in y_expenses)
        net_bal = tot_inc - tot_exp
        savings = net_bal
        
        cat_map = {}
        for exp in y_expenses:
            cat = exp.get("category", "Uncategorized")
            cat_map[cat] = cat_map.get(cat, 0.0) + safe_float(exp.get("amount"))
            
        top_cat = "None"
        top_amt = 0.0
        for cat, amt in cat_map.items():
            if amt > top_amt:
                top_amt = amt
                top_cat = cat
                
        return {
            "income": tot_inc,
            "expenses": tot_exp,
            "net_balance": net_bal,
            "savings": savings,
            "top_category": top_cat,
            "top_category_amount": top_amt,
            "transactions": len(y_expenses) + len(y_income)
        }
        
    def get_comparison_metrics(curr_val, prev_val):
        diff = curr_val - prev_val
        if prev_val == 0:
            pct = 100.0 if curr_val > 0 else (-100.0 if curr_val < 0 else 0.0)
        else:
            pct = (diff / prev_val) * 100.0
        return {
            "diff": diff,
            "pct": pct
        }

    # Calculations
    curr_month_stats = calculate_month_stats(curr_year, curr_month)
    prev_month_stats = calculate_month_stats(prev_month_year, prev_month)
    
    curr_year_stats = calculate_year_stats(curr_year)
    prev_year_stats = calculate_year_stats(prev_year)
    
    monthly_comparison = {
        "income": get_comparison_metrics(curr_month_stats["income"], prev_month_stats["income"]),
        "expenses": get_comparison_metrics(curr_month_stats["expenses"], prev_month_stats["expenses"]),
        "net_balance": get_comparison_metrics(curr_month_stats["net_balance"], prev_month_stats["net_balance"]),
        "savings": get_comparison_metrics(curr_month_stats["savings"], prev_month_stats["savings"])
    }
    
    yearly_comparison = {
        "income": get_comparison_metrics(curr_year_stats["income"], prev_year_stats["income"]),
        "expenses": get_comparison_metrics(curr_year_stats["expenses"], prev_year_stats["expenses"]),
        "net_balance": get_comparison_metrics(curr_year_stats["net_balance"], prev_year_stats["net_balance"]),
        "savings": get_comparison_metrics(curr_year_stats["savings"], prev_year_stats["savings"])
    }
    
    # Trends Data
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_spending_trend = [0.0] * 12
    monthly_income_trend = [0.0] * 12
    
    for exp in expenses:
        y, m = parse_year_month(exp.get("date"))
        if y == curr_year and m is not None and 1 <= m <= 12:
            monthly_spending_trend[m-1] += safe_float(exp.get("amount"))
            
    for inc in income:
        y, m = parse_year_month(inc.get("date"))
        if y == curr_year and m is not None and 1 <= m <= 12:
            monthly_income_trend[m-1] += safe_float(inc.get("amount"))
            
    monthly_trends = []
    for i in range(12):
        monthly_trends.append({
            "month": month_names[i],
            "spending": monthly_spending_trend[i],
            "income": monthly_income_trend[i]
        })
        
    # Yearly trend (last 3 years)
    yearly_trends = []
    for y in range(curr_year - 2, curr_year + 1):
        y_inc = sum(safe_float(x.get("amount")) for x in income if parse_year(x.get("date")) == y)
        y_exp = sum(safe_float(x.get("amount")) for x in expenses if parse_year(x.get("date")) == y)
        yearly_trends.append({
            "year": y,
            "income": y_inc,
            "expenses": y_exp
        })
        
    # Category breakdowns for current month & current year
    month_expenses = [x for x in expenses if parse_year_month(x.get("date")) == (curr_year, curr_month)]
    month_cat_spend = {}
    for exp in month_expenses:
        cat = exp.get("category", "Uncategorized")
        month_cat_spend[cat] = month_cat_spend.get(cat, 0.0) + safe_float(exp.get("amount"))
    month_breakdown = [{"category": k, "amount": v} for k, v in sorted(month_cat_spend.items(), key=lambda x: x[1], reverse=True)]
    
    year_expenses = [x for x in expenses if parse_year(x.get("date")) == curr_year]
    year_cat_spend = {}
    for exp in year_expenses:
        cat = exp.get("category", "Uncategorized")
        year_cat_spend[cat] = year_cat_spend.get(cat, 0.0) + safe_float(exp.get("amount"))
    year_breakdown = [{"category": k, "amount": v} for k, v in sorted(year_cat_spend.items(), key=lambda x: x[1], reverse=True)]
    
    result = {
        "monthly": {
            "income": curr_month_stats["income"],
            "expenses": curr_month_stats["expenses"],
            "net_balance": curr_month_stats["net_balance"],
            "savings": curr_month_stats["savings"],
            "top_category": curr_month_stats["top_category"],
            "top_category_amount": curr_month_stats["top_category_amount"],
            "transactions": curr_month_stats["transactions"],
            "comparison": monthly_comparison
        },
        "yearly": {
            "income": curr_year_stats["income"],
            "expenses": curr_year_stats["expenses"],
            "net_balance": curr_year_stats["net_balance"],
            "savings": curr_year_stats["savings"],
            "top_category": curr_year_stats["top_category"],
            "top_category_amount": curr_year_stats["top_category_amount"],
            "transactions": curr_year_stats["transactions"],
            "comparison": yearly_comparison
        },
        "analytics": {
            "monthly_trends": monthly_trends,
            "yearly_trends": yearly_trends,
            "category_breakdown": {
                "month": month_breakdown,
                "year": year_breakdown
            }
        }
    }
    return jsonify(result)

# -------------------------------------------------------------
# API ROUTES: EXPENSE MANAGEMENT
# -------------------------------------------------------------

@app.route("/api/expenses", methods=["GET"])
@pin_secured
def get_expenses():
    expenses = read_json_file("expenses")
    
    # Process queries & filters
    search = request.args.get("search", "").lower()
    category = request.args.get("category", "")
    priority = request.args.get("priority", "")
    status = request.args.get("status", "")
    favorite = request.args.get("favorite", "")
    important = request.args.get("important", "")
    start_date = request.args.get("start_date", "")
    end_date = request.args.get("end_date", "")
    sort_by = request.args.get("sort_by", "date") # date, amount, title
    sort_order = request.args.get("sort_order", "desc") # asc, desc
    
    filtered = []
    for item in expenses:
        # Search match (title, note, category, tags)
        if search:
            tags_str = " ".join(item.get("tags", []))
            in_title = search in item.get("title", "").lower()
            in_note = search in item.get("note", "").lower()
            in_cat = search in item.get("category", "").lower()
            in_tags = search in tags_str.lower()
            if not (in_title or in_note or in_cat or in_tags):
                continue
                
        # Category filter
        if category and item.get("category") != category:
            continue
            
        # Priority filter
        if priority and item.get("priority") != priority:
            continue
            
        # Status filter
        if status and item.get("status") != status:
            continue
            
        # Favorite filter
        if favorite and str(item.get("favorite", "")).lower() != favorite.lower():
            continue
            
        # Important filter
        if important and str(item.get("important", "")).lower() != important.lower():
            continue
            
        # Date boundaries
        item_date = item.get("date", "")
        if start_date and item_date < start_date:
            continue
        if end_date and item_date > end_date:
            continue
            
        filtered.append(item)
        
    # Sorting logic
    reverse = (sort_order == "desc")
    if sort_by == "amount":
        filtered.sort(key=lambda x: float(x.get("amount", 0.0)), reverse=reverse)
    elif sort_by == "title":
        filtered.sort(key=lambda x: x.get("title", "").lower(), reverse=reverse)
    else:  # Date sorting default
        filtered.sort(key=lambda x: x.get("date", ""), reverse=reverse)
        
    # Pagination
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 15))
    except ValueError:
        page = 1
        limit = 15
        
    total_count = len(filtered)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_items = filtered[start_idx:end_idx]
    
    return jsonify({
        "expenses": paginated_items,
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "pages": (total_count + limit - 1) // limit
    })

@app.route("/api/expenses", methods=["POST"])
@pin_secured
def add_expense():
    data = request.json or {}
    title = data.get("title", "").strip()
    amount = data.get("amount", 0.0)
    category = data.get("category", "").strip()
    date_str = data.get("date", "").strip() or datetime.date.today().strftime("%Y-%m-%d")
    
    if not title or not amount:
        return jsonify({"error": "Title and valid Amount are required arguments"}), 400
        
    expenses = read_json_file("expenses")
    new_expense = {
        "id": f"exp_{uuid.uuid4().hex[:8]}",
        "title": title,
        "amount": float(amount),
        "category": category or "Uncategorized",
        "date": date_str,
        "note": data.get("note", "").strip(),
        "tags": data.get("tags", []),
        "priority": data.get("priority", "medium"),
        "payment_method": data.get("payment_method", "Credit Card"),
        "status": data.get("status", "completed"),
        "favorite": bool(data.get("favorite", False)),
        "important": bool(data.get("important", False)),
        "created_at": datetime.datetime.now().isoformat()
    }
    
    expenses.insert(0, new_expense)
    write_json_file("expenses", expenses)
    write_log("CREATE_EXPENSE", f"Added expense '{title}' of amount {amount} to category '{category}'")
    return jsonify(new_expense), 213

@app.route("/api/expenses/<id>", methods=["PUT", "DELETE"])
@pin_secured
def manage_expense(id):
    expenses = read_json_file("expenses")
    item_idx = next((i for i, x in enumerate(expenses) if x["id"] == id), None)
    
    if item_idx is None:
        return jsonify({"error": "Expense record not found"}), 404
        
    if request.method == "DELETE":
        removed_item = expenses.pop(item_idx)
        write_json_file("expenses", expenses)
        # Store in undo stack
        write_json_file("undo", {"type": "expense", "item": removed_item})
        write_log("DELETE_EXPENSE", f"Deleted expense '{removed_item['title']}' (${removed_item['amount']}). Undo available.")
        return jsonify({"success": True, "message": "Expense deleted", "item": removed_item})
        
    elif request.method == "PUT":
        data = request.json or {}
        item = expenses[item_idx]
        
        item["title"] = data.get("title", item["title"]).strip()
        item["amount"] = float(data.get("amount", item["amount"]))
        item["category"] = data.get("category", item["category"]).strip()
        item["date"] = data.get("date", item["date"]).strip()
        item["note"] = data.get("note", item["note"]).strip()
        item["tags"] = data.get("tags", item["tags"])
        item["priority"] = data.get("priority", item["priority"])
        item["payment_method"] = data.get("payment_method", item["payment_method"])
        item["status"] = data.get("status", item["status"])
        item["favorite"] = bool(data.get("favorite", item.get("favorite", False)))
        item["important"] = bool(data.get("important", item.get("important", False)))
        
        write_json_file("expenses", expenses)
        write_log("UPDATE_EXPENSE", f"Updated expense '{item['title']}' details.")
        return jsonify(item)

@app.route("/api/expenses/undo", methods=["POST"])
@pin_secured
def undo_delete_expense():
    """Allows pulling back the last deleted record from undo.json."""
    undo_data = read_json_file("undo", {})
    if not undo_data or not undo_data.get("item"):
        return jsonify({"error": "Nothing to undo"}), 400
        
    item = undo_data["item"]
    if undo_data["type"] == "expense":
        expenses = read_json_file("expenses")
        expenses.insert(0, item)
        write_json_file("expenses", expenses)
        write_log("UNDO_EXPENSE", f"Restored expense '{item['title']}' (${item['amount']})")
    elif undo_data["type"] == "income":
        income = read_json_file("income")
        income.insert(0, item)
        write_json_file("income", income)
        write_log("UNDO_INCOME", f"Restored income '{item['title']}' (${item['amount']})")
    else:
        return jsonify({"error": "Invalid undo action type"}), 400
        
    # Clear undo stack
    write_json_file("undo", {})
    return jsonify({"success": True, "restored": item})

@app.route("/api/expenses/bulk-delete", methods=["POST"])
@pin_secured
def bulk_delete_expenses():
    data = request.json or {}
    ids = data.get("ids", [])
    if not ids:
        return jsonify({"error": "No IDs provided"}), 400
        
    expenses = read_json_file("expenses")
    original_count = len(expenses)
    expenses = [x for x in expenses if x["id"] not in ids]
    deleted_count = original_count - len(expenses)
    
    write_json_file("expenses", expenses)
    write_log("BULK_DELETE_EXPENSES", f"Perform bulk-deletion of {deleted_count} expenses.")
    return jsonify({"success": True, "deleted_count": deleted_count})

@app.route("/api/expenses/duplicate/<id>", methods=["POST"])
@pin_secured
def duplicate_expense(id):
    expenses = read_json_file("expenses")
    item = next((x for x in expenses if x["id"] == id), None)
    if not item:
        return jsonify({"error": "Expense to duplicate not found"}), 404
        
    duplicated = item.copy()
    duplicated["id"] = f"exp_{uuid.uuid4().hex[:8]}"
    duplicated["title"] = f"{duplicated['title']} (Copy)"
    duplicated["created_at"] = datetime.datetime.now().isoformat()
    
    expenses.insert(0, duplicated)
    write_json_file("expenses", expenses)
    write_log("DUPLICATE_EXPENSE", f"Duplicated expense record '{item['title']}'")
    return jsonify(duplicated), 213

# -------------------------------------------------------------
# API ROUTES: INCOME MANAGEMENT
# -------------------------------------------------------------

@app.route("/api/income", methods=["GET"])
@pin_secured
def get_income():
    income = read_json_file("income")
    # Basic filters
    search = request.args.get("search", "").lower()
    category = request.args.get("category", "")
    source_type = request.args.get("source_type", "") # salary, passive, side
    
    filtered = []
    for item in income:
        if search and (search not in item.get("title", "").lower() and search not in item.get("note", "").lower()):
            continue
        if category and item.get("category") != category:
            continue
        if source_type and item.get("source_type") != source_type:
            continue
        filtered.append(item)
        
    filtered.sort(key=lambda x: x.get("date", ""), reverse=True)
    return jsonify(filtered)

@app.route("/api/income", methods=["POST"])
@pin_secured
def add_income():
    data = request.json or {}
    title = data.get("title", "").strip()
    amount = data.get("amount", 0.0)
    category = data.get("category", "").strip()
    date_str = data.get("date", "").strip() or datetime.date.today().strftime("%Y-%m-%d")
    
    if not title or not amount:
        return jsonify({"error": "Title and valid Amount are required arguments"}), 400
        
    income = read_json_file("income")
    new_income = {
        "id": f"inc_{uuid.uuid4().hex[:8]}",
        "title": title,
        "amount": float(amount),
        "category": category or "Uncategorized",
        "date": date_str,
        "note": data.get("note", "").strip(),
        "source_type": data.get("source_type", "salary"),
        "recurring": bool(data.get("recurring", False)),
        "created_at": datetime.datetime.now().isoformat()
    }
    
    income.insert(0, new_income)
    write_json_file("income", income)
    write_log("CREATE_INCOME", f"Registered income '{title}' of amount {amount}")
    return jsonify(new_income), 213

@app.route("/api/income/<id>", methods=["PUT", "DELETE"])
@pin_secured
def manage_income(id):
    income = read_json_file("income")
    item_idx = next((i for i, x in enumerate(income) if x["id"] == id), None)
    
    if item_idx is None:
        return jsonify({"error": "Income record not found"}), 404
        
    if request.method == "DELETE":
        removed_item = income.pop(item_idx)
        write_json_file("income", income)
        # Store in undo stack
        write_json_file("undo", {"type": "income", "item": removed_item})
        write_log("DELETE_INCOME", f"Deleted income '{removed_item['title']}' (${removed_item['amount']})")
        return jsonify({"success": True, "message": "Income record removed"})
        
    elif request.method == "PUT":
        data = request.json or {}
        item = income[item_idx]
        
        item["title"] = data.get("title", item["title"]).strip()
        item["amount"] = float(data.get("amount", item["amount"]))
        item["category"] = data.get("category", item["category"]).strip()
        item["date"] = data.get("date", item["date"]).strip()
        item["note"] = data.get("note", item["note"]).strip()
        item["source_type"] = data.get("source_type", item["source_type"])
        item["recurring"] = bool(data.get("recurring", item.get("recurring", False)))
        
        write_json_file("income", income)
        write_log("UPDATE_INCOME", f"Updated income '{item['title']}' values")
        return jsonify(item)

# -------------------------------------------------------------
# API ROUTES: CATEGORY SYSTEM
# -------------------------------------------------------------

@app.route("/api/categories", methods=["GET", "POST"])
@pin_secured
def manage_categories():
    categories = read_json_file("categories")
    if request.method == "POST":
        data = request.json or {}
        name = data.get("name", "").strip()
        color = data.get("color", "#0D5D61").strip()
        icon = data.get("icon", "tag").strip()
        
        if not name:
            return jsonify({"error": "Category name is mandatory"}), 400
            
        # Unique check
        if any(x["name"].lower() == name.lower() for x in categories):
            return jsonify({"error": "Category already exists"}), 409
            
        new_cat = {
            "id": f"cat_{uuid.uuid4().hex[:8]}",
            "name": name,
            "color": color,
            "icon": icon,
            "parent": data.get("parent", None) # Parent subcategories
        }
        categories.append(new_cat)
        write_json_file("categories", categories)
        write_log("CREATE_CATEGORY", f"Created sub-category: {name}")
        return jsonify(new_cat), 213
        
    return jsonify(categories)

@app.route("/api/categories/<id>", methods=["PUT", "DELETE"])
@pin_secured
def edit_category(id):
    categories = read_json_file("categories")
    item_idx = next((i for i, x in enumerate(categories) if x["id"] == id), None)
    
    if item_idx is None:
        return jsonify({"error": "Category not found"}), 404
        
    if request.method == "DELETE":
        removed = categories.pop(item_idx)
        # Update any expenses matching this category to "Uncategorized"
        expenses = read_json_file("expenses")
        for item in expenses:
            if item.get("category") == removed["name"]:
                item["category"] = "Uncategorized"
        write_json_file("expenses", expenses)
        write_json_file("categories", categories)
        write_log("DELETE_CATEGORY", f"Removed category '{removed['name']}'")
        return jsonify({"success": True, "message": "Category deleted successfully"})
        
    elif request.method == "PUT":
        data = request.json or {}
        item = categories[item_idx]
        
        old_name = item["name"]
        item["name"] = data.get("name", item["name"]).strip()
        item["color"] = data.get("color", item["color"]).strip()
        item["icon"] = data.get("icon", item["icon"]).strip()
        item["parent"] = data.get("parent", item.get("parent", None))
        
        # Cascading updates to active expenses
        if old_name != item["name"]:
            expenses = read_json_file("expenses")
            for exp in expenses:
                if exp.get("category") == old_name:
                    exp["category"] = item["name"]
            write_json_file("expenses", expenses)
            
        write_json_file("categories", categories)
        write_log("UPDATE_CATEGORY", f"Modified category details for '{item['name']}'")
        return jsonify(item)

# -------------------------------------------------------------
# API ROUTES: BUDGET MANAGEMENT
# -------------------------------------------------------------

@app.route("/api/budgets", methods=["GET", "POST"])
@pin_secured
def manage_budgets():
    budgets = read_json_file("budgets")
    if request.method == "POST":
        data = request.json or {}
        category = data.get("category", "").strip()
        limit = data.get("limit", 0.0)
        period = data.get("period", "monthly")
        
        if not category or not limit:
            return jsonify({"error": "Category and limit are required fields"}), 400
            
        new_budget = {
            "id": f"bud_{uuid.uuid4().hex[:8]}",
            "category": category,
            "limit": float(limit),
            "period": period,
            "created_at": datetime.datetime.now().isoformat()
        }
        budgets.append(new_budget)
        write_json_file("budgets", budgets)
        write_log("CREATE_BUDGET", f"Set budget for '{category}' at {limit}")
        return jsonify(new_budget), 213
        
    return jsonify(budgets)

@app.route("/api/budgets/<id>", methods=["PUT", "DELETE"])
@pin_secured
def edit_budget(id):
    budgets = read_json_file("budgets")
    item_idx = next((i for i, x in enumerate(budgets) if x["id"] == id), None)
    
    if item_idx is None:
        return jsonify({"error": "Budget limit not found"}), 404
        
    if request.method == "DELETE":
        removed = budgets.pop(item_idx)
        write_json_file("budgets", budgets)
        write_log("DELETE_BUDGET", f"Cleared budget settings for '{removed['category']}'")
        return jsonify({"success": True})
        
    elif request.method == "PUT":
        data = request.json or {}
        item = budgets[item_idx]
        item["limit"] = float(data.get("limit", item["limit"]))
        item["period"] = data.get("period", item["period"])
        item["category"] = data.get("category", item["category"])
        
        write_json_file("budgets", budgets)
        write_log("UPDATE_BUDGET", f"Modified budget limit of '{item['category']}' to {item['limit']}")
        return jsonify(item)

# -------------------------------------------------------------
# API ROUTES: RECURRING SCHEDULES & SAVINGS GOALS
# -------------------------------------------------------------

@app.route("/api/recurring", methods=["GET", "POST"])
@pin_secured
def manage_recurring():
    # Process auto due triggers on list request to ensure sync
    process_recurring_due()
    recurring = read_json_file("recurring")
    
    if request.method == "POST":
        data = request.json or {}
        title = data.get("title", "").strip()
        amount = data.get("amount", 0.0)
        type_ = data.get("type", "expense")
        frequency = data.get("frequency", "monthly")
        next_date = data.get("next_date", "").strip()
        
        if not title or not amount or not next_date:
            return jsonify({"error": "Missing recurring setup fields (title, amount, next_date)"}), 400
            
        new_item = {
            "id": f"rec_{uuid.uuid4().hex[:8]}",
            "title": title,
            "amount": float(amount),
            "type": type_,
            "category": data.get("category", "Uncategorized"),
            "frequency": frequency,
            "next_date": next_date,
            "last_generated": "",
            "priority": data.get("priority", "medium"),
            "payment_method": data.get("payment_method", "Credit Card"),
            "note": data.get("note", "").strip()
        }
        recurring.append(new_item)
        write_json_file("recurring", recurring)
        write_log("CREATE_RECURRING", f"Created recurring {type_} schedule for '{title}'")
        return jsonify(new_item), 213
        
    return jsonify(recurring)

@app.route("/api/recurring/<id>", methods=["PUT", "DELETE"])
@pin_secured
def edit_recurring(id):
    recurring = read_json_file("recurring")
    item_idx = next((i for i, x in enumerate(recurring) if x["id"] == id), None)
    
    if item_idx is None:
        return jsonify({"error": "Recurring rule not found"}), 404
        
    if request.method == "DELETE":
        removed = recurring.pop(item_idx)
        write_json_file("recurring", recurring)
        write_log("DELETE_RECURRING", f"Removed recurring rule for '{removed['title']}'")
        return jsonify({"success": True})
        
    elif request.method == "PUT":
        data = request.json or {}
        item = recurring[item_idx]
        
        item["title"] = data.get("title", item["title"]).strip()
        item["amount"] = float(data.get("amount", item["amount"]))
        item["type"] = data.get("type", item["type"])
        item["category"] = data.get("category", item["category"])
        item["frequency"] = data.get("frequency", item["frequency"])
        item["next_date"] = data.get("next_date", item["next_date"])
        item["priority"] = data.get("priority", item["priority"])
        item["payment_method"] = data.get("payment_method", item["payment_method"])
        item["note"] = data.get("note", item["note"]).strip()
        
        write_json_file("recurring", recurring)
        write_log("UPDATE_RECURRING", f"Updated recurring schedule for '{item['title']}'")
        return jsonify(item)

@app.route("/api/goals", methods=["GET", "POST"])
@pin_secured
def manage_goals():
    goals = read_json_file("goals")
    if request.method == "POST":
        data = request.json or {}
        title = data.get("title", "").strip()
        target_amount = data.get("target_amount", 0.0)
        current_amount = data.get("current_amount", 0.0)
        target_date = data.get("target_date", "")
        
        if not title or not target_amount:
            return jsonify({"error": "Title and target amount are required fields"}), 400
            
        new_goal = {
            "id": f"goal_{uuid.uuid4().hex[:8]}",
            "title": title,
            "target_amount": float(target_amount),
            "current_amount": float(current_amount),
            "target_date": target_date,
            "category": data.get("category", "Savings & Investments")
        }
        goals.append(new_goal)
        write_json_file("goals", goals)
        write_log("CREATE_GOAL", f"Added savings target '{title}' of amount {target_amount}")
        return jsonify(new_goal), 213
        
    return jsonify(goals)

@app.route("/api/goals/<id>", methods=["PUT", "DELETE"])
@pin_secured
def edit_goal(id):
    goals = read_json_file("goals")
    item_idx = next((i for i, x in enumerate(goals) if x["id"] == id), None)
    
    if item_idx is None:
        return jsonify({"error": "Goal detail not found"}), 404
        
    if request.method == "DELETE":
        removed = goals.pop(item_idx)
        write_json_file("goals", goals)
        write_log("DELETE_GOAL", f"Deleted savings target '{removed['title']}'")
        return jsonify({"success": True})
        
    elif request.method == "PUT":
        data = request.json or {}
        item = goals[item_idx]
        item["title"] = data.get("title", item["title"]).strip()
        item["target_amount"] = float(data.get("target_amount", item["target_amount"]))
        item["current_amount"] = float(data.get("current_amount", item["current_amount"]))
        item["target_date"] = data.get("target_date", item["target_date"])
        item["category"] = data.get("category", item["category"])
        
        write_json_file("goals", goals)
        write_log("UPDATE_GOAL", f"Updated details for savings target '{item['title']}'")
        return jsonify(item)

# -------------------------------------------------------------
# API ROUTES: BACKUP & DATA RESTORATION / CSV EXPORTS
# -------------------------------------------------------------

@app.route("/api/data/export/<format_type>", methods=["GET"])
@pin_secured
def export_data(format_type):
    """Generates down-loadable data exports of either JSON or CSV files."""
    expenses = read_json_file("expenses")
    
    if format_type.lower() == "json":
        # Package everything together
        unified_db = {
            "expenses": expenses,
            "income": read_json_file("income"),
            "budgets": read_json_file("budgets"),
            "categories": read_json_file("categories"),
            "recurring": read_json_file("recurring"),
            "goals": read_json_file("goals"),
            "settings": read_json_file("settings")
        }
        export_filename = f"expense_tracker_export_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        export_path = os.path.join(EXPORT_DIR, export_filename)
        
        with open(export_path, "w", encoding="utf-8") as f:
            json.dump(unified_db, f, indent=4, ensure_ascii=False)
            
        write_log("EXPORT", f"Data exported to JSON file: {export_filename}")
        return send_from_directory(EXPORT_DIR, export_filename, as_attachment=True)
        
    elif format_type.lower() == "csv":
        # Export expenses CSV
        export_filename = f"expenses_export_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        export_path = os.path.join(EXPORT_DIR, export_filename)
        
        fields = ["id", "title", "amount", "category", "date", "priority", "payment_method", "status", "note", "tags"]
        try:
            with open(export_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fields)
                writer.writeheader()
                for exp in expenses:
                    row = {k: exp.get(k, "") for k in fields}
                    # Flatten tags to simple comma-string
                    if isinstance(row["tags"], list):
                        row["tags"] = ",".join(row["tags"])
                    writer.writerow(row)
            write_log("EXPORT", f"Data exported to CSV file: {export_filename}")
            return send_from_directory(EXPORT_DIR, export_filename, as_attachment=True)
        except Exception as e:
            return jsonify({"error": f"Failed CSV compilation: {str(e)}"}), 500
            
    return jsonify({"error": "Unsupported export format"}), 400

@app.route("/api/data/import", methods=["POST"])
@pin_secured
def import_data():
    """Allows uploading exports and parsing CSV/JSON data into files."""
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    filename = secure_filename(file.filename)
    
    if filename.endswith(".json"):
        try:
            data = json.load(file)
            imported_counts = {}
            for key, filepath in FILES.items():
                if key in data and isinstance(data[key], (list, dict)):
                    # Merge or overwrite. Let's merge lists, override dicts
                    existing = read_json_file(key, [] if isinstance(data[key], list) else {})
                    if isinstance(data[key], list):
                        # Merge list items ensuring ID uniqueness
                        existing_ids = {x.get("id") for x in existing if isinstance(x, dict)}
                        merged = existing.copy()
                        count = 0
                        for item in data[key]:
                            if isinstance(item, dict) and item.get("id") not in existing_ids:
                                merged.append(item)
                                count += 1
                        write_json_file(key, merged)
                        imported_counts[key] = count
                    else:
                        # Overwrite settings
                        write_json_file(key, data[key])
                        imported_counts[key] = "overwritten"
            write_log("IMPORT", "Data JSON export file imported and merged.")
            return jsonify({"success": True, "details": imported_counts})
        except Exception as e:
            return jsonify({"error": f"Invalid JSON format structure: {e}"}), 400
            
    elif filename.endswith(".csv"):
        # Import expenses
        try:
            stream = file.stream.read().decode("utf-8").splitlines()
            reader = csv.DictReader(stream)
            expenses = read_json_file("expenses")
            existing_ids = {x["id"] for x in expenses}
            
            count = 0
            for row in reader:
                tx_id = row.get("id") or f"exp_{uuid.uuid4().hex[:8]}"
                if tx_id in existing_ids:
                    continue # avoid duplicates
                    
                tags = row.get("tags", "")
                tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
                
                new_item = {
                    "id": tx_id,
                    "title": row.get("title", "Imported Item"),
                    "amount": float(row.get("amount", 0.0)),
                    "category": row.get("category", "Uncategorized"),
                    "date": row.get("date") or datetime.date.today().strftime("%Y-%m-%d"),
                    "note": row.get("note", "").strip(),
                    "tags": tag_list,
                    "priority": row.get("priority", "medium"),
                    "payment_method": row.get("payment_method", "Credit Card"),
                    "status": row.get("status", "completed"),
                    "favorite": False,
                    "important": False,
                    "created_at": datetime.datetime.now().isoformat()
                }
                expenses.insert(0, new_item)
                count += 1
                
            write_json_file("expenses", expenses)
            write_log("IMPORT", f"Imported {count} expenses from uploaded CSV file.")
            return jsonify({"success": True, "imported_count": count})
        except Exception as e:
            return jsonify({"error": f"Failed parsing CSV: {e}"}), 400
            
    return jsonify({"error": "Unsupported file format. Upload .json or .csv files."}), 400

@app.route("/api/data/backups", methods=["GET", "POST"])
@pin_secured
def manage_backups():
    """Backup system: handles list and create operations."""
    if request.method == "POST":
        # Create a backup
        backup_name = f"backup_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        backup_path = os.path.join(BACKUP_DIR, backup_name)
        
        # Consolidate all database files
        backup_db = {}
        for key, filepath in FILES.items():
            if key != "undo" and os.path.exists(filepath):
                backup_db[key] = read_json_file(key)
                
        try:
            with open(backup_path, "w", encoding="utf-8") as f:
                json.dump(backup_db, f, indent=4, ensure_ascii=False)
            write_log("BACKUP_CREATE", f"Manual backup created: {backup_name}")
            return jsonify({"success": True, "filename": backup_name})
        except Exception as e:
            return jsonify({"error": f"Failed backup compile: {e}"}), 500
            
    # List backups
    files = sorted([f for f in os.listdir(BACKUP_DIR) if f.endswith(".json")], reverse=True)
    backup_list = []
    for f in files:
        fpath = os.path.join(BACKUP_DIR, f)
        stats = os.stat(fpath)
        backup_list.append({
            "filename": f,
            "size": stats.st_size,
            "created_at": datetime.datetime.fromtimestamp(stats.st_mtime).isoformat()
        })
    return jsonify(backup_list)

@app.route("/api/data/backups/restore", methods=["POST"])
@pin_secured
def restore_backup():
    """Backup restoration handler."""
    data = request.json or {}
    filename = data.get("filename", "")
    if not filename:
        return jsonify({"error": "No backup file specified"}), 400
        
    backup_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(backup_path):
        return jsonify({"error": "Backup file not found"}), 404
        
    try:
        with open(backup_path, "r", encoding="utf-8") as f:
            backup_db = json.load(f)
            
        for key, filepath in FILES.items():
            if key in backup_db:
                write_json_file(key, backup_db[key])
                
        write_log("BACKUP_RESTORE", f"Database successfully restored from: {filename}")
        return jsonify({"success": True, "message": f"Successfully restored to {filename}"})
    except Exception as e:
        return jsonify({"error": f"Restoration process failed: {e}"}), 500

@app.route("/api/logs", methods=["GET"])
@pin_secured
def get_logs():
    logs = read_json_file("logs")
    return jsonify(logs)

# -------------------------------------------------------------
# APPLICATION RUNTIME INITIALIZATION
# -------------------------------------------------------------

if __name__ == "__main__":
    # Start the server locally
    # debug=False and use_reloader=False prevent Flask from spawning a child
    # watcher process that crashes on Windows paths containing spaces.
    print("=" * 60)
    print("  AuraFinance Backend Running on http://127.0.0.1:8085/")
    print("  Press CTRL+C to stop the server.")
    print("=" * 60)
    app.run(host="127.0.0.1", port=8085, debug=False, use_reloader=False)

