"""
app.py – 统一版后台
────────────────────────────────────────────────────────────
● 保留新的 SQLite 持久化 / 查询 / 删除接口
● 恢复旧版 Excel-驱动的下拉菜单、CSV 上传解析、字段映射
"""

from flask import Flask, render_template, request, jsonify, g
import os, sqlite3, json, pandas as pd, csv, io

app = Flask(__name__)

# ────────────────────────── SQLite helpers ──────────────────────────
DB_DIR  = os.path.join(os.getcwd(), "data")
DB_PATH = os.path.join(DB_DIR, "tool_cost.db")
os.makedirs(DB_DIR, exist_ok=True)

REQUIRED = [
    "tool_type", "program_name", "part_name",
    "part_version", "quotation_date", "supplier_name",
]

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(_):
    db = g.pop("db", None)
    if db:
        db.close()

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS tool_cost (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_type       TEXT NOT NULL,
    program_name    TEXT NOT NULL,
    part_name       TEXT NOT NULL,
    part_version    TEXT NOT NULL,
    quotation_date  TEXT NOT NULL,
    supplier_name   TEXT NOT NULL,
    data_json       TEXT NOT NULL,
    UNIQUE (tool_type, program_name, part_name,
            part_version, quotation_date, supplier_name)
);
"""
_db_done = False
@app.before_request
def init_db_once():
    global _db_done
    if not _db_done:
        con = get_db()
        con.executescript(SCHEMA_SQL)
        con.commit()
        _db_done = True

# ────────────────────────────── UI 路由 ─────────────────────────────
@app.route("/")
def home():
    return render_template("home.html")

@app.route("/form/<tool_type>", methods=["GET", "POST"])
def tool_form(tool_type):
    if tool_type != "injection":
        return f"<h2>{tool_type.replace('_',' ').title()} 页面正在开发中，请稍后访问。</h2>"

    # ① 读取下拉选项（Excel → List 工作表）
    excel_path = os.path.join(DB_DIR, "Tool_CBD.xlsx")
    if os.path.exists(excel_path):
        df = pd.read_excel(excel_path, sheet_name="List")
        tool_types            = df["Tool type"].dropna().unique().tolist()
        injection_systems     = df["Injection system"].dropna().unique().tolist()
        mold_types            = df["Mold type"].dropna().unique().tolist()
        hot_runner_systems    = df["Hot runner system"].dropna().unique().tolist()
        cold_runner_systems   = df["Cold runner system"].dropna().unique().tolist()
        gate_types            = df["Gate type"].dropna().unique().tolist()
        hot_runner_gate_types = df["Hot runner gate type"].dropna().unique().tolist()
    else:  # 本地没 Excel 时给一些演示值，页面仍能渲染
        tool_types            = ["Injection"]
        injection_systems     = ["Hot Runner", "Cold Runner"]
        mold_types            = ["2 Plate", "3 Plate"]
        hot_runner_systems    = ["Synventive", "Husky"]
        cold_runner_systems   = ["Standard"]
        gate_types            = ["Edge", "Submarine"]
        hot_runner_gate_types = ["Direct"]

    return render_template(
        "injection_form.html",
        tool_types=tool_types,
        injection_systems=injection_systems,
        mold_types=mold_types,
        hot_runner_systems=hot_runner_systems,
        cold_runner_systems=cold_runner_systems,
        gate_types=gate_types,
        hot_runner_gate_types=hot_runner_gate_types,
    )

@app.route("/tool_cost_db")
def tool_cost_db():
    return render_template("tool_cost_db.html")

@app.route("/compare")
def compare():
    return render_template("cost_comparison.html")

# ────────────────────── 保存 JSON → SQLite ─────────────────────────
@app.route("/save_data", methods=["POST"])
def save_data():
    data = request.get_json(force=True)
    missing = [k for k in REQUIRED if not data.get(k)]
    if missing:
        return jsonify({"ok": False, "msg": f"以下字段缺失: {', '.join(missing)}"}), 400

    con = get_db()
    try:
        con.execute(
            """INSERT INTO tool_cost
               (tool_type, program_name, part_name, part_version,
                quotation_date, supplier_name, data_json)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [data[k] for k in REQUIRED] + [json.dumps(data, ensure_ascii=False)],
        )
        con.commit()
    except sqlite3.IntegrityError:
        return jsonify({"ok": False, "msg": "记录已存在，不可重复保存"}), 409

    return jsonify({"ok": True, "msg": "保存成功"})

# ────────────────────────── 查询 / 删除 ────────────────────────────
@app.route("/api/tool_cost/options")
def api_options():
    con = get_db()
    result = {}
    for col in REQUIRED:
        rows = con.execute(f"SELECT DISTINCT {col} FROM tool_cost ORDER BY {col}").fetchall()
        result[col] = [r[col] for r in rows if r[col]]
    return jsonify(result)

@app.route("/api/tool_cost/record")
def api_record():
    args = [request.args.get(k) for k in REQUIRED]
    if not all(args):
        return jsonify({"ok": False, "msg": "六个关键字段必须全部提供"}), 400

    con  = get_db()
    row  = con.execute(
        "SELECT * FROM tool_cost WHERE " + " AND ".join(f"{k}=?" for k in REQUIRED),
        args,
    ).fetchone()
    if not row:
        return jsonify({"ok": False, "msg": "未找到记录"}), 404
    return jsonify({"ok": True, "record": dict(row)})

@app.route("/api/tool_cost/delete/<int:rec_id>", methods=["DELETE"])
def api_delete(rec_id):
    con = get_db()
    changed = con.execute("DELETE FROM tool_cost WHERE id = ?", (rec_id,)).rowcount
    con.commit()
    return jsonify({"ok": changed == 1})

# ────────────────────────── CSV 上传解析 ───────────────────────────
@app.route("/upload_csv", methods=["POST"])
def upload_csv():
    try:
        if "csv_file" not in request.files:
            return jsonify({"success": False, "message": "没有文件上传"})
        file = request.files["csv_file"]
        if not file.filename:
            return jsonify({"success": False, "message": "没有选择文件"})
        if not file.filename.lower().endswith(".csv"):
            return jsonify({"success": False, "message": "请上传CSV文件"})

        parsed = parse_csv_data(file.read().decode("utf-8"))
        return jsonify({
            "success": True,
            "data": parsed,
            "message": f"成功解析CSV文件，共找到 {len(parsed)} 个字段",
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"文件解析错误: {e}"})

def parse_csv_data(content: str) -> dict:
    """把 CSV 内容解析成 {字段: 值} 结构。"""
    data = {}
    component_rows = {
        "cavity", "core", "slider", "lifter", "insert",
        "others", "moldbase", "std components", "ejector components",
    }

    for row in csv.reader(io.StringIO(content)):
        if not row:
            continue
        first = row[0].strip('"').strip()
        if first.startswith("#") or first in ("", "组件"):
            continue

        norm = first.lower()
        if norm in component_rows:  # Tool Component 行
            key_base   = norm.replace(" ", "_")
            material   = row[1].strip() if len(row) > 1 else ""
            treatment  = row[2].strip() if len(row) > 2 else ""
            if material:
                data[f"{key_base.capitalize()} Material"]   = material
            if treatment:
                data[f"{key_base.capitalize()} Treatment"] = treatment
            continue

        if len(row) >= 2:  # 普通 “字段,值”
            value = ",".join(row[1:]).strip('"').strip()
            if value and not first.startswith("组件"):
                data[first] = value
    return data

# ────────────────────────── 字段映射表 ────────────────────────────
FIELD_MAPPING = {
    # 1 · Basic Info
    "Tool Type": "tool_type",
    "Program Name": "program_name",
    "Part Name": "part_name",
    "Part Number": "part_num",
    "Part Version": "part_version",
    "Supplier Name": "supplier_name",
    "Quotation Date": "quotation_date",
    "Part Raw Material": "part_raw_material",
    "Resin Type": "resin_type",
    "Resin Manufacturer": "resin_manufacturer",
    "Resin Grade": "resin_grade",
    "Moldbase size(L)/cm": "moldbase_l",
    "Moldbase size(W)/cm": "moldbase_w",
    "Moldbase size(H)/cm": "moldbase_h",
    "Injection System": "injection_system",
    "Mold Type": "mold_type",
    "Hot Runner System": "hot_runner_system",
    "Hot Runner Gate Type": "hot_runner_gate_type",
    "Cold runner System": "cold_runner_system",
    "Gate Type": "gate_type",
    # 2 · Design & Engineering
    "CAE design Hrs": "cae_design_hrs",
    "CAE Rate (RMB/Hrs)": "cae_rate",
    "Tool design Hrs": "tool_design_hrs",
    "Tool design Rate (RMB/Hrs)": "tool_design_rate",
    # 3 · Hot Runner
    "Supplier": "hr_supplier",
    "Hot Drop Qty": "hr_qty",
    "Drop Pitch (X)/mm": "hr_pitch_x",
    "Drop Pitch (Y)/mm": "hr_pitch_y",
    "HR Cost (RMB)": "hr_cost",
    # 5 · Assembly & Fitting
    "Tool Maker Qty": "tool_maker_qty",
    "Tool Assy Hrs": "tool_assy_hrs",
    "Assy Working Rate/hr (RMB)": "assy_rate",
    # 6 · Molding Trial
    "Labor: Trial Pers": "trial_pers",
    "Labor: Trial Rate (RMB/Hrs)": "trial_rate",
    "Labor: Trial Hrs": "trial_hrs_labor",
    "Machine: Machines Used": "machine_qty",
    "Machine: Machine Rate (RMB/Hrs)": "machine_rate",
    "Machine: Trial Hrs": "trial_hrs_machine",
    # 7/8 · Others & Profit
    "Description": "others_description",
    "Cost (RMB)": "others_cost",
    "Profit Cost (RMB)": "profit_cost",
}

for k in [
    "cavity", "core", "slider", "lifter", "insert",
    "others", "moldbase", "std_components", "ejector_components",
]:
    FIELD_MAPPING[f"{k.capitalize()} Material"]   = f"{k}_material"
    FIELD_MAPPING[f"{k.capitalize()} Treatment"] = f"{k}_treatment"

@app.route("/get_field_mapping")
def get_field_mapping():
    return jsonify(FIELD_MAPPING)

# ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # 自动根据 FLASK_ENV 环境变量决定 debug 模式，默认不开启
    env = os.environ.get("FLASK_ENV", "production").lower()
    is_debug = env == "development"

    # 生产部署必须监听 0.0.0.0，开发本地无影响
    app.run(host="0.0.0.0", port=5000, debug=is_debug)
