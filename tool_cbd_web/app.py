from flask import Flask, render_template, request
import pandas as pd

app = Flask(__name__)

@app.route('/')
def home():
    return render_template("home.html")

@app.route('/form/<tool_type>', methods=['GET', 'POST'])
def tool_form(tool_type):
    if tool_type != 'injection':
        return f"<h2>{tool_type.replace('_', ' ').title()} 页面正在开发中，请稍后访问。</h2>"

    # 读取 Excel 文件
    df = pd.read_excel('data/Tool_CBD.xlsx', sheet_name='List')

    # 提取下拉选项
    tool_types = df['Tool type'].dropna().unique().tolist()
    injection_systems = df['Injection system'].dropna().unique().tolist()
    mold_types = df['Mold type'].dropna().unique().tolist()
    hot_runner_systems = df['Hot runner system'].dropna().unique().tolist()
    cold_runner_systems = df['Cold runner system'].dropna().unique().tolist()
    gate_types = df['Gate type'].dropna().unique().tolist()

    # ✅ 新增 gate_type_list 映射到 "Hot runner gate type"
    hot_runner_gate_types = df['Hot runner gate type'].dropna().unique().tolist()

    return render_template(
        "injection_form.html",
        tool_types=tool_types,
        injection_systems=injection_systems,
        mold_types=mold_types,
        hot_runner_systems=hot_runner_systems,
        cold_runner_systems=cold_runner_systems,
        gate_types=gate_types,
        hot_runner_gate_types=hot_runner_gate_types  # ✅ 关键：传给模板的变量名与 HTML 中一致
    )

if __name__ == '__main__':
    app.run(debug=True, port=5000)

