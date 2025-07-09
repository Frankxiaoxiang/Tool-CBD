from flask import Flask, render_template, request, jsonify
import pandas as pd
import csv, io

app = Flask(__name__)

# ────────────────────────── 主页 & 表单 ──────────────────────────
@app.route('/')
def home():
    return render_template("home.html")

@app.route('/form/<tool_type>', methods=['GET', 'POST'])
def tool_form(tool_type):
    if tool_type != 'injection':
        return f"<h2>{tool_type.replace('_', ' ').title()} 页面正在开发中，请稍后访问。</h2>"

    # 读取 Excel，提取下拉选项
    df = pd.read_excel('data/Tool_CBD.xlsx', sheet_name='List')
    tool_types            = df['Tool type'].dropna().unique().tolist()
    injection_systems     = df['Injection system'].dropna().unique().tolist()
    mold_types            = df['Mold type'].dropna().unique().tolist()
    hot_runner_systems    = df['Hot runner system'].dropna().unique().tolist()
    cold_runner_systems   = df['Cold runner system'].dropna().unique().tolist()
    gate_types            = df['Gate type'].dropna().unique().tolist()
    hot_runner_gate_types = df['Hot runner gate type'].dropna().unique().tolist()

    return render_template(
        "injection_form.html",
        tool_types=tool_types,
        injection_systems=injection_systems,
        mold_types=mold_types,
        hot_runner_systems=hot_runner_systems,
        cold_runner_systems=cold_runner_systems,
        gate_types=gate_types,
        hot_runner_gate_types=hot_runner_gate_types
    )

# ────────────────────────── CSV 上传解析 ──────────────────────────
@app.route('/upload_csv', methods=['POST'])
def upload_csv():
    try:
        if 'csv_file' not in request.files:
            return jsonify({'success': False, 'message': '没有文件上传'})

        file = request.files['csv_file']
        if not file.filename:
            return jsonify({'success': False, 'message': '没有选择文件'})
        if not file.filename.lower().endswith('.csv'):
            return jsonify({'success': False, 'message': '请上传CSV文件'})

        content = file.read().decode('utf-8')           # 读取 CSV
        parsed_data = parse_csv_data(content)           # 解析为 dict

        return jsonify({
            'success': True,
            'data': parsed_data,
            'message': f'成功解析CSV文件，共找到 {len(parsed_data)} 个字段'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'文件解析错误: {str(e)}'})

def parse_csv_data(content: str) -> dict:
    """
    把 CSV 转成 {字段: 值}：
    1. 普通 “字段,值” 行直接解析。
    2. #4 Tool Component 表格行（Cavity/Core/...）：
       提取第 2 列 Material、第 3 列 Treatment，
       生成 'Cavity Material', 'Cavity Treatment' 等键值。
    """
    data = {}

    # 所有组件行（统一转小写以便匹配）
    component_rows = {
        "cavity", "core", "slider", "lifter", "insert",
        "others", "moldbase", "std components", "ejector components"
    }

    reader = csv.reader(io.StringIO(content))
    for row in reader:
        if not row:
            continue

        first_col = row[0].strip().strip('"')
        if first_col.startswith('#') or first_col in ("", "组件"):
            continue

        # ── ① Tool Component 行 ─────────────────────────────
        norm_first = first_col.lower().replace(' ', ' ').strip()
        if norm_first in component_rows:
            comp_key = norm_first.replace(' ', '_')     # cavity / std_components
            material  = row[1].strip() if len(row) > 1 else ""
            treatment = row[2].strip() if len(row) > 2 else ""
            if material:
                data[f"{comp_key.capitalize()} Material"] = material
            if treatment:
                data[f"{comp_key.capitalize()} Treatment"] = treatment
            continue  # 数值列忽略

        # ── ② 普通 "字段,值" 行 ─────────────────────────────
        if len(row) >= 2:
            key   = first_col
            value = ",".join(row[1:]).strip().strip('"')
            if value and not key.startswith('组件'):
                data[key] = value
    return data

# ────────────────────────── 字段映射表 ──────────────────────────
FIELD_MAPPING: dict = {
    # 1. Basic Info
    'Tool Type': 'tool_type',
    'Program Name': 'program_name',
    'Part Name': 'part_name',
    'Part Number': 'part_num',
    'Part Version': 'part_version',
    'Supplier Name': 'supplier_name',
    'Quotation Date': 'quotation_date',
    'Part Raw Material': 'part_raw_material',
    'Resin Type': 'resin_type',
    'Resin Manufacturer': 'resin_manufacturer',
    'Resin Grade': 'resin_grade',
    'Moldbase size(L)/cm': 'moldbase_l',
    'Moldbase size(W)/cm': 'moldbase_w',
    'Moldbase size(H)/cm': 'moldbase_h',
    'Injection System': 'injection_system',
    'Mold Type': 'mold_type',
    'Hot Runner System': 'hot_runner_system',
    'Hot Runner Gate Type': 'hot_runner_gate_type',
    'Cold runner System': 'cold_runner_system',
    'Gate Type': 'gate_type',

    # 2. Design & Engineering
    'CAE design Hrs': 'cae_design_hrs',
    'CAE Rate (RMB/Hrs)': 'cae_rate',
    'Tool design Hrs': 'tool_design_hrs',
    'Tool design Rate (RMB/Hrs)': 'tool_design_rate',

    # 3. Hot Runner
    'Supplier': 'hr_supplier',
    'Hot Drop Qty': 'hr-qty',
    'Drop Pitch (X)/mm': 'hr_pitch_x',
    'Drop Pitch (Y)/mm': 'hr_pitch_y',
    'HR Cost (RMB)': 'hr-cost',

    # 5. Assembly & Fitting
    'Tool Maker Qty': 'tool_maker_qty',
    'Tool Assy Hrs': 'tool_assy_hrs',
    'Assy Working Rate/hr (RMB)': 'assy_rate',

    # 6. Molding Trial
    'Labor: Trial Pers': 'trial_pers',
    'Labor: Trial Rate (RMB/Hrs)': 'trial_rate',
    'Labor: Trial Hrs': 'trial_hrs_labor',
    'Machine: Machines Used': 'machine_qty',
    'Machine: Machine Rate (RMB/Hrs)': 'machine_rate',
    'Machine: Trial Hrs': 'trial_hrs_machine',

    # 7 & 8 Others / Profit
    'Description': 'others_description',
    'Cost (RMB)': 'others_cost',
    'Profit Cost (RMB)': 'profit_cost',
}

# 4. Tool Component —— 自动补充 Material / Treatment 映射
component_keys = [
    "cavity", "core", "slider", "lifter", "insert",
    "others", "moldbase", "std_components", "ejector_components"
]
for k in component_keys:
    FIELD_MAPPING[f"{k.capitalize()} Material"]   = f"{k}_material"
    FIELD_MAPPING[f"{k.capitalize()} Treatment"] = f"{k}_treatment"

@app.route('/get_field_mapping', methods=['GET'])
def get_field_mapping():
    """前端 JS 调用，获取完整字段映射"""
    return jsonify(FIELD_MAPPING)

# ────────────────────────── 运行 ──────────────────────────
if __name__ == '__main__':
    app.run(debug=True, port=5000)
