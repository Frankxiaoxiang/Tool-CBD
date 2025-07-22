// --- CSV Upload Functionality ------------------------------------------------
let csvData = null;
let fieldMapping = null;

// 获取字段映射表
async function getFieldMapping() {
    try {
        const res = await fetch('/get_field_mapping');
        fieldMapping = await res.json();
    } catch (e) {
        console.error('获取字段映射失败:', e);
    }
}

// 初始化CSV上传功能
function initializeCSVUpload() {
    const csvFileInput = document.getElementById('csv-file-input');
    const csvUploadBtn = document.getElementById('csv-upload-btn');
    const fileName     = document.getElementById('file-name');
    const importBtn    = document.getElementById('import-data-btn');
    const statusText   = document.getElementById('upload-status');
    if (!csvFileInput) return;

    csvUploadBtn.onclick = () => csvFileInput.click();
    csvFileInput.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            fileName.textContent = file.name;
            importBtn.style.display = 'inline-block';
            statusText.innerHTML = '';
        }
    };

    importBtn.onclick = async () => {
        const file = csvFileInput.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('csv_file', file);
        statusText.innerHTML = '<span style="color:#f39c12;">正在解析文件...</span>';

        try {
            const res = await fetch('/upload_csv', { method: 'POST', body: fd });
            const result = await res.json();
            if (result.success) {
                csvData = result.data;
                statusText.innerHTML = `<span style="color:#27ae60;">✓ ${result.message}</span>`;
                await populateFormWithCSVData(csvData);
                setTimeout(()=>statusText.innerHTML =
                    '<span style="color:#27ae60;">✓ 数据导入完成，字符串字段已自动填充</span>', 800);
            } else {
                statusText.innerHTML = `<span style="color:#e74c3c;">✗ ${result.message}</span>`;
            }
        } catch (e) {
            statusText.innerHTML = `<span style="color:#e74c3c;">✗ 上传失败: ${e.message}</span>`;
        }
    };
}

// 判断是否为数字
function isNumericValue(val){
    return (typeof val === 'number') ||
        (typeof val === 'string' && val.trim() !== '' && !isNaN(val));
}

// 用 CSV 数据填充表单（仅字符串）
async function populateFormWithCSVData(data){
    if(!fieldMapping) await getFieldMapping();
    let filled = 0, skipped=[];
    for(const [csvField,val] of Object.entries(data)){
        const id = fieldMapping[csvField];
        if(!id){ skipped.push(`${csvField}(无映射)`); continue; }
        const el = document.getElementById(id) || document.querySelector(`[name="${id}"]`);
        if(!el){ skipped.push(`${csvField}(字段不存在)`); continue; }
        if(el.hasAttribute('readonly')){ skipped.push(`${csvField}(只读)`); continue; }
        if(id.includes('date')||id.includes('time')){ skipped.push(`${csvField}(时间字段)`); continue; }
        if(isNumericValue(val)){ skipped.push(`${csvField}(数字跳过)`); continue; }

        if(el.tagName === 'SELECT'){
            const opt = [...el.options].find(o=>o.value === val);
            if(opt){ el.value = val; filled++; }
            else skipped.push(`${csvField}(选项不存在:${val})`);
        }else{ el.value = val; filled++; }

        el.dispatchEvent(new Event('change'));
        el.dispatchEvent(new Event('input'));
    }
    console.log(`成功填充 ${filled} 个字符串字段`); if(skipped.length) console.log('跳过:',skipped);
}

// ---------------- 2. Design & Engineering -----------------------------------
function updateDesignCost(){
    const caeHrs  = +document.getElementById("cae_design_hrs").value || 0;
    const caeRate = +document.getElementById("cae_rate").value || 0;
    const toolHrs = +document.getElementById("tool_design_hrs").value || 0;
    const toolRate= +document.getElementById("tool_design_rate").value || 0;
    const toolTotal= +document.getElementById("tool_total_cost").value || 0;

    const caeCost = caeHrs * caeRate;
    const toolCost= toolHrs * toolRate;
    const sum     = caeCost + toolCost;

    document.getElementById("cae_cost").value         = caeCost.toFixed(2);
    document.getElementById("tool_design_cost").value = toolCost.toFixed(2);
    document.getElementById("design_sum").value       = sum.toFixed(2);
    document.getElementById("design_percentage").value=
        toolTotal? (sum/toolTotal*100).toFixed(2)+'%':'';

    updateToolTotalCost(); // 计算完小计后刷新总计
}

// ---------------- 3. Hot Runner ---------------------------------------------
function updateHotRunnerSumAndPercentage(){
    const hrCost   = +document.getElementById("hr-cost").value || 0;
    const toolTotal= +document.getElementById("tool_total_cost").value || 0;
    document.getElementById("hot_runner_sum").value = hrCost.toFixed(2);
    document.getElementById("hr-percentage").value  =
        toolTotal? (hrCost/toolTotal*100).toFixed(2)+' %':'';
    updateToolTotalCost();
}

// ---------------- 4. Tool Component -----------------------------------------
const toolComponentKeys=[
    "cavity","core","slider","lifter","insert",
    "others","moldbase","std_components","ejector_components"
];

function updateToolComponentCost(key){
    const qty  = +document.querySelector(`[name="${key}_qty"]`)?.value || 0;
    const unit = +document.querySelector(`[name="${key}_unit_cost"]`)?.value || 0;
    document.querySelector(`[name="${key}_total_cost"]`).value=(qty*unit).toFixed(2);
    updateToolComponentSummary();
}

function updateToolComponentSummary(){
    const sum = toolComponentKeys.reduce((acc,k)=>
        acc + (+document.querySelector(`[name="${k}_total_cost"]`)?.value || 0),0);
    document.getElementById("tool_component_sum").value = sum.toFixed(2);

    const toolTotal = +document.getElementById("tool_total_cost").value || 0;
    document.getElementById("tool_component_percentage").value =
        toolTotal? (sum/toolTotal*100).toFixed(2)+' %':'';
    updateToolTotalCost();
}

// ---------------- 5. Assembly & Fitting -------------------------------------
function updateAssemblyCost(){
    const qty  = +document.getElementById("tool_maker_qty").value || 0;
    const hrs  = +document.getElementById("tool_assy_hrs").value || 0;
    const rate = +document.getElementById("assy_rate").value || 0;
    const cost = qty*hrs*rate;
    document.getElementById("assy_cost").value = cost.toFixed(2);
    document.getElementById("assembly_fitting_sum").value = cost.toFixed(2);

    const toolTotal = +document.getElementById("tool_total_cost").value || 0;
    document.getElementById("assy_percentage").value =
        toolTotal? (cost/toolTotal*100).toFixed(2)+'%':'';
    updateToolTotalCost();
}

// ---------------- 6. Molding Trial ------------------------------------------
function updateMoldingTrialCost(){
    const labor = (+document.getElementById("trial_pers").value||0) *
                  (+document.getElementById("trial_rate").value||0) *
                  (+document.getElementById("trial_hrs_labor").value||0);
    const machine = (+document.getElementById("machine_qty").value||0) *
                    (+document.getElementById("machine_rate").value||0) *
                    (+document.getElementById("trial_hrs_machine").value||0);
    const sum = labor+machine;
    document.getElementById("labor_trial_cost").value   = labor.toFixed(2);
    document.getElementById("machine_trial_cost").value = machine.toFixed(2);
    document.getElementById("molding_trial_sum").value  = sum.toFixed(2);

    const toolTotal = +document.getElementById("tool_total_cost").value || 0;
    document.getElementById("molding_trial_percentage").value =
        toolTotal? (sum/toolTotal*100).toFixed(2)+'%':'';
    updateToolTotalCost();
}

// ---------------- 7. Others & 8. Profit -------------------------------------
function updateOthersCost(){
    const cost = +document.getElementById("others_cost").value || 0;
    document.getElementById("others_sum").value = cost.toFixed(2);
    const toolTotal = +document.getElementById("tool_total_cost").value || 0;
    document.getElementById("others_percentage").value =
        toolTotal? (cost/toolTotal*100).toFixed(2)+'%':'';
    updateToolTotalCost();
}

function updateProfitFields(){
    const cost = +document.getElementById("profit_cost").value || 0;
    document.getElementById("profit_sum").value = cost.toFixed(2);
    const toolTotal = +document.getElementById("tool_total_cost").value || 0;
    document.getElementById("profit_percentage").value =
        toolTotal? (cost/toolTotal*100).toFixed(2)+'%':'';
    updateToolTotalCost();
}

// ---------------- 9. Tool Total Cost & Percentage ---------------------------
function updateAllPercentages(){
    const toolTotal = +document.getElementById("tool_total_cost").value || 0;
    if(!toolTotal) return;
    const map = [
        ["design_sum","design_percentage"],
        ["hot_runner_sum","hr-percentage"],
        ["tool_component_sum","tool_component_percentage"],
        ["assembly_fitting_sum","assy_percentage"],
        ["molding_trial_sum","molding_trial_percentage"],
        ["others_sum","others_percentage"],
        ["profit_sum","profit_percentage"]
    ];
    map.forEach(([sumId,pctId])=>{
        const sum = +document.getElementById(sumId)?.value || 0;
        document.getElementById(pctId).value = (sum/toolTotal*100).toFixed(2)+' %';
    });
}

function updateToolTotalCost(){
    // ★★ 修改点 ① —— 只做汇总，不再回调任何小计函数 ★★
    const ids = ['design_sum','hot_runner_sum','tool_component_sum',
                 'assembly_fitting_sum','molding_trial_sum','others_sum','profit_sum'];
    const total = ids.reduce((acc,id)=> acc + (+document.getElementById(id)?.value || 0),0);
    document.getElementById("tool_total_cost").value = total.toFixed(2);
    updateAllPercentages();
    // ★★ 结束 ★★
}

// ---- 自动事件注册 ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', ()=>{
    initializeCSVUpload();
    getFieldMapping();

    // Design
    ["cae_design_hrs","cae_rate","tool_design_hrs","tool_design_rate"]
        .forEach(id=>document.getElementById(id).onchange = updateDesignCost);

    // Hot Runner
    ["hr-qty","hr-cost"].forEach(id=>document.getElementById(id).oninput=updateHotRunnerSumAndPercentage);

    // Tool Component
    toolComponentKeys.forEach(k=>{
        document.querySelector(`[name="${k}_qty"]`).onchange      = ()=>updateToolComponentCost(k);
        document.querySelector(`[name="${k}_unit_cost"]`).onchange= ()=>updateToolComponentCost(k);
    });

    // Assembly
    ["tool_maker_qty","tool_assy_hrs","assy_rate"]
        .forEach(id=>document.getElementById(id).onchange=updateAssemblyCost);

    // Molding Trial
    ["trial_pers","trial_rate","trial_hrs_labor",
     "machine_qty","machine_rate","trial_hrs_machine"]
        .forEach(id=>document.getElementById(id).onchange=updateMoldingTrialCost);

    // Others / Profit
    document.getElementById("others_cost").onchange  = updateOthersCost;
    document.getElementById("profit_cost").onchange  = updateProfitFields;

    // 初始化
    updateProfitFields();
    updateToolTotalCost();
});


// --- 导出CSV辅助函数 ---
function escapeCSV(val) {
    if (typeof val !== "string") val = (val == null ? "" : String(val));
    if (val.indexOf(",") > -1 || val.indexOf('"') > -1 || val.indexOf("\n") > -1) {
        val = '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
}

// 1. 按网页结构收集数据
function collectFormData() {
    // 你可以完善下面每个模块要导出的字段
    const modules = [
        {
            name: "1. Basic Info",
            fields: [
                ["Tool Type", document.getElementById("tool_type").value],
                ["Program Name", document.getElementById("program_name").value],
                ["Part Name", document.getElementById("part_name").value],
                ["Part Number", document.getElementById("part_num").value],
                ["Part Version", document.getElementById("part_version").value],
                ["Supplier Name", document.getElementById("supplier_name").value],
                ["Quotation Date", document.getElementById("quotation_date").value],
                ["Part Raw Material", document.getElementById("part_raw_material").value],
                ["Resin Type", document.getElementById("resin_type").value],
                ["Resin Manufacturer", document.getElementById("resin_manufacturer").value],
                ["Resin Grade", document.getElementById("resin_grade").value],
                ["Moldbase size(L)/cm", document.getElementById("moldbase_l").value],
                ["Moldbase size(W)/cm", document.getElementById("moldbase_w").value],
                ["Moldbase size(H)/cm", document.getElementById("moldbase_h").value],
                ["Injection System", document.getElementById("injection_system").value],
                ["Mold Type", document.getElementById("mold_type").value],
                ["Hot Runner System", document.getElementById("hot_runner_system").value],
                ["Hot Runner Gate Type", document.getElementById("hot_runner_gate_type").value],
                ["Cold runner System", document.getElementById("cold_runner_system").value],
                ["Gate Type", document.getElementById("gate_type").value]
            ]
        },
        {
            name: "2. Design & Engineering",
            fields: [
                ["CAE design Hrs", document.getElementById("cae_design_hrs").value],
                ["CAE Rate (RMB/Hrs)", document.getElementById("cae_rate").value],
                ["CAE Cost", document.getElementById("cae_cost").value],
                ["Tool design Hrs", document.getElementById("tool_design_hrs").value],
                ["Tool design Rate (RMB/Hrs)", document.getElementById("tool_design_rate").value],
                ["Tool Design Cost", document.getElementById("tool_design_cost").value],
                ["Total Design Cost (Sum)", document.getElementById("design_sum").value],
                ["Percentage of Tool Total Cost", document.getElementById("design_percentage").value]
            ]
        },
        {
            name: "3. Hot Runner",
            fields: [
                ["Supplier", document.querySelector('[name="hr_supplier"]').value],
                ["Hot Drop Qty", document.getElementById("hr-qty").value],
                ["Hot Runner Gate Type", document.querySelector('[name="hr_gate_type"]').value],
                ["Drop Pitch (X)/mm", document.querySelector('[name="hr_pitch_x"]').value],
                ["Drop Pitch (Y)/mm", document.querySelector('[name="hr_pitch_y"]').value],
                ["HR Cost (RMB)", document.getElementById("hr-cost").value],
                ["HR Sum (RMB)", document.getElementById("hot_runner_sum").value],
                ["Percentage (%)", document.getElementById("hr-percentage").value]
            ]
        },
        // ...后续模块依次填写（Tool Component/Assembly/Molding Trial/Others/Profit/Total）
        // 这里只给示例，实际要全部覆盖
    ];

    // Tool Component 动态模块
    const compNames = [
        "Cavity", "Core", "Slider", "Lifter", "Insert", "Others", "Moldbase", "Std components", "Ejector components"
    ];
    const compKeys = [
        "cavity", "core", "slider", "lifter", "insert", "others", "moldbase", "std_components", "ejector_components"
    ];
    let componentRows = [["组件", "Material", "Treatment", "Qty/Set", "Unit Cost(RMB)", "Total Cost(RMB)"]];
    for (let i = 0; i < compKeys.length; i++) {
        componentRows.push([
            compNames[i],
            document.querySelector(`[name="${compKeys[i]}_material"]`).value,
            document.querySelector(`[name="${compKeys[i]}_treatment"]`).value,
            document.querySelector(`[name="${compKeys[i]}_qty"]`).value,
            document.querySelector(`[name="${compKeys[i]}_unit_cost"]`).value,
            document.querySelector(`[name="${compKeys[i]}_total_cost"]`).value
        ]);
    }
    modules.push({
        name: "4. Tool Component",
        fields: [
            ["Tool Component Sum (RMB)", document.getElementById("tool_component_sum").value],
            ["Percentage (%)", document.getElementById("tool_component_percentage").value]
        ],
        table: componentRows
    });

    // 5. Assembly & Fitting
    modules.push({
        name: "5. Assembly & Fitting",
        fields: [
            ["Tool Maker Qty", document.getElementById("tool_maker_qty").value],
            ["Tool Assy Hrs", document.getElementById("tool_assy_hrs").value],
            ["Assy Working Rate/hr (RMB)", document.getElementById("assy_rate").value],
            ["Assy Cost (RMB)", document.getElementById("assy_cost").value],
            ["Assembly & Fitting Sum (RMB)", document.getElementById("assembly_fitting_sum").value],
            ["Percentage (%)", document.getElementById("assy_percentage").value]
        ]
    });

    // 6. Molding Trial
    modules.push({
        name: "6. Molding Trial",
        fields: [
            ["Labor: Trial Pers", document.getElementById("trial_pers").value],
            ["Labor: Trial Rate (RMB/Hrs)", document.getElementById("trial_rate").value],
            ["Labor: Trial Hrs", document.getElementById("trial_hrs_labor").value],
            ["Labor Trial Cost (RMB)", document.getElementById("labor_trial_cost").value],
            ["Machine: Machines Used", document.getElementById("machine_qty").value],
            ["Machine: Machine Rate (RMB/Hrs)", document.getElementById("machine_rate").value],
            ["Machine: Trial Hrs", document.getElementById("trial_hrs_machine").value],
            ["Machine Trial Cost (RMB)", document.getElementById("machine_trial_cost").value],
            ["Molding Trial Sum (RMB)", document.getElementById("molding_trial_sum").value],
            ["Percentage (%)", document.getElementById("molding_trial_percentage").value]
        ]
    });

    // 7. Others
    modules.push({
        name: "7. Others",
        fields: [
            ["Description", document.getElementById("others_description").value],
            ["Cost (RMB)", document.getElementById("others_cost").value],
            ["Others Sum (RMB)", document.getElementById("others_sum").value],
            ["Percentage (%)", document.getElementById("others_percentage").value]
        ]
    });

    // 8. Profit
    modules.push({
        name: "8. Profit",
        fields: [
            ["Profit Cost (RMB)", document.getElementById("profit_cost").value],
            ["Profit Sum (RMB)", document.getElementById("profit_sum").value],
            ["Percentage (%)", document.getElementById("profit_percentage").value]
        ]
    });

    // 9. Tool Total Cost
    modules.push({
        name: "9. Tool Total Cost",
        fields: [
            ["Tool Total Cost (RMB)", document.getElementById("tool_total_cost").value]
        ]
    });

    return modules;
}

// 2. 校验所有字段是否已填写（只要页面内所有input和select都已填）
function validateAllFields() {
    const inputs = document.querySelectorAll('input:not([type="button"]):not([type="submit"]):not([type="file"]):not([readonly]), select');
    for (let input of inputs) {
        if (!input.value) {
            input.focus();
            return false;
        }
    }
    return true;
}

// 3. 生成CSV内容
function generateCSV(modules) {
    let lines = [];
    for (const mod of modules) {
        lines.push('');
        lines.push(`# ${mod.name}`);
        if (mod.fields && mod.fields.length) {
            for (const [k, v] of mod.fields) {
                lines.push(escapeCSV(k) + ',' + escapeCSV(v));
            }
        }
        if (mod.table) {
            for (const row of mod.table) {
                lines.push(row.map(escapeCSV).join(','));
            }
        }
    }
    return lines.join('\r\n');
}

// 4. 监听导出按钮
document.addEventListener('DOMContentLoaded', function () {
    const exportBtn = document.getElementById('export-report');
    if (exportBtn) {
        exportBtn.onclick = function () {
            if (!validateAllFields()) {
                alert('请完成所有输入');
                return;
            }
            let filename = prompt('请输入导出的CSV文件名（不含扩展名）：', 'tool_cbd_report');
            if (!filename) return;
            filename = filename.replace(/[\\/:"*?<>|]+/g, '').trim();
            if (!filename) {
                alert('文件名不合法！');
                return;
            }
            const modules = collectFormData();
            const csvContent = generateCSV(modules);
            // 下载
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename + '.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    }
});

// 阻止"计算成本"按钮的默认提交行为，只做js计算，不刷新页面
document.addEventListener('DOMContentLoaded', function () {
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            // 这里可以调用你的 updateToolTotalCost() 或其它计算逻辑
            updateToolTotalCost && updateToolTotalCost();
            // 如果有其它想做的事可以加在这里
        });
    }
});

// ============================================================
//  Save to Database  – collects ALL inputs & POSTS to /save_data
// ============================================================
async function saveToDatabase() {
    const form   = document.querySelector('form');
    const inputs = [...form.querySelectorAll('input, select, textarea')];
    const payload = {};

    // collect values & detect empties
    for (const el of inputs) {
        const key = el.name || el.id;
        const val = (el.type === 'checkbox') ? el.checked : el.value.trim();
        payload[key] = val;
    }

    // six‑key validation
    const REQUIRED = [
        'tool_type', 'program_name', 'part_name',
        'part_version', 'quotation_date', 'supplier_name'
    ];
    const missing = REQUIRED.filter(k => !payload[k]);
    if (missing.length) {
        alert('请先填写以下字段: ' + missing.join(', '));
        return;
    }

    try {
        const res = await fetch('/save_data', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
            alert('已保存到数据库!');
        } else {
            alert('保存失败: ' + data.msg);
        }
    } catch (err) {
        console.error(err);
        alert('网络或服务器错误，保存失败');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('saveBtn');
    if (btn) btn.addEventListener('click', saveToDatabase);
});