/**
 * Cost Comparison Tool - JavaScript
 * Handles CSV file upload, parsing, and comparison functionality
 */

class CostComparison {
    constructor() {
        this.uploadedFiles = [];
        this.parsedData = [];
        this.maxFiles = 5;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeUI();
    }

    setupEventListeners() {
        // File upload handler
        const fileInput = document.getElementById('csv-files');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // Start comparison button
        const compareBtn = document.getElementById('start-compare-btn');
        if (compareBtn) {
            compareBtn.addEventListener('click', () => this.startComparison());
        }

        // Make remove file function globally accessible
        window.removeFile = (index) => this.removeFile(index);
    }

    initializeUI() {
        // Initialize any UI elements that need setup
        this.updateCompareButtonVisibility();
    }

    /**
     * Handle file upload event
     */
    handleFileUpload(event) {
        const files = Array.from(event.target.files);

        // Filter and add valid CSV files
        files.forEach(file => {
            if (this.isValidCSVFile(file) && this.uploadedFiles.length < this.maxFiles) {
                // Check for duplicate files
                if (!this.uploadedFiles.some(f => f.name === file.name)) {
                    this.uploadedFiles.push(file);
                }
            }
        });

        this.updateFileList();
        this.updateCompareButtonVisibility();

        // Clear the file input to allow re-uploading the same file
        event.target.value = '';
    }

    /**
     * Validate if the file is a CSV
     */
    isValidCSVFile(file) {
        return file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv');
    }

    /**
     * Update the file list display
     */
    updateFileList() {
        const fileList = document.getElementById('file-list');
        if (!fileList) return;

        fileList.innerHTML = '';

        this.uploadedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-name">
                    <span>📄</span>
                    <span>${file.name}</span>
                    <span style="color: #6c757d; font-size: 12px;">(${this.formatFileSize(file.size)})</span>
                </div>
                <button class="remove-file" onclick="removeFile(${index})">Remove</button>
            `;
            fileList.appendChild(fileItem);
        });
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Remove a file from the upload list
     */
    removeFile(index) {
        this.uploadedFiles.splice(index, 1);
        this.updateFileList();
        this.updateCompareButtonVisibility();
        this.hideStatus();
    }

    /**
     * Update compare button visibility
     */
    updateCompareButtonVisibility() {
        const compareBtn = document.getElementById('start-compare-btn');
        if (compareBtn) {
            compareBtn.style.display = this.uploadedFiles.length >= 2 ? 'inline-block' : 'none';
        }
    }

    /**
     * Show status message
     */
    showStatus(message, isError = false) {
        const statusDiv = document.getElementById('status-message');
        if (!statusDiv) return;

        statusDiv.innerHTML = isError ?
            `❌ ${message}` :
            `<span class="loading"></span> ${message}`;
        statusDiv.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
        statusDiv.style.display = 'block';
    }

    /**
     * Hide status message
     */
    hideStatus() {
        const statusDiv = document.getElementById('status-message');
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
    }

    /**
     * Start the comparison process
     */
    async startComparison() {
        if (this.uploadedFiles.length < 2) {
            this.showStatus('Please upload at least 2 CSV files to compare', true);
            return;
        }

        this.showStatus('Processing files...');
        this.parsedData = [];

        try {
            // Process each file
            for (let i = 0; i < this.uploadedFiles.length; i++) {
                const file = this.uploadedFiles[i];
                this.showStatus(`Processing file ${i + 1}/${this.uploadedFiles.length}: ${file.name}`);

                const content = await this.readFileContent(file);
                const data = this.parseCSV(content);

                this.parsedData.push({
                    filename: file.name,
                    data: data
                });
            }

            // Generate comparison table
            this.generateComparisonTable();
            this.showStatus(`✅ Successfully compared ${this.parsedData.length} files`);

            // Show comparison section
            const comparisonSection = document.getElementById('comparison-section');
            if (comparisonSection) {
                comparisonSection.style.display = 'block';
                setTimeout(() => {
                    comparisonSection.scrollIntoView({ behavior: 'smooth' });
                }, 500);
            }

        } catch (error) {
            console.error('Comparison error:', error);
            this.showStatus(`Error processing files: ${error.message}`, true);
        }
    }

    /**
     * Read file content as text
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsText(file);
        });
    }

    /**
     * Parse CSV content into structured data
     */
    parseCSV(content) {
        const lines = content.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const data = {};
        let currentModule = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check for module header (starts with #)
            if (line.startsWith('#')) {
                currentModule = line.substring(1).trim();
                data[currentModule] = {
                    fields: {},
                    table: [],
                    summary: {}
                };
                continue;
            }

            // Skip table headers
            if (line.includes('组件,Material,Treatment,Qty/Set,Unit Cost(RMB),Total Cost(RMB)')) {
                continue;
            }

            // Parse the line
            const parts = this.parseCSVLine(line);
            if (parts.length >= 2) {
                const key = parts[0].trim();

                // Check if this is a component row
                const componentNames = [
                    'Cavity', 'Core', 'Slider', 'Lifter', 'Insert', 'Others',
                    'Moldbase', 'Std components', 'Ejector components'
                ];

                if (
                    componentNames.includes(key) &&
                    parts.length >= 6 &&
                    key !== "" &&
                    key.toLowerCase() !== "组件"
                ) {
                    // 只处理标准component名，且首列不为空，也不是“组件”表头
                    data[currentModule].table.push({
                        component: key,
                        material: parts[1] || '',
                        treatment: parts[2] || '',
                        qty: parts[3] || '',
                        unitCost: parts[4] || '',
                        totalCost: parts[5] || ''
                    });
                } else if (
                    key === "" ||
                    line.replace(/"/g, '').trim().toLowerCase().startsWith("material") ||
                    line.replace(/"/g, '').trim().toLowerCase().startsWith("组件") ||
                    line.replace(/"/g, '').trim().toLowerCase().includes("material,treatment")
                ) {
                    // 跳过任何空component名、或者是表头的行（无视分隔符/引号/空格）
                    continue;
                } else {
                    // This is a regular field
                    const value = parts.slice(1).join(',').trim();
                    data[currentModule].fields[key] = value;

                    // Check if this is a summary field
                    if (key.toLowerCase().includes('total') ||
                        key.toLowerCase().includes('sum') ||
                        key.toLowerCase().includes('percentage')) {
                        data[currentModule].summary[key] = value;
                    }
                }
            }
        }

        return data;
    }

    /**
     * Parse a single CSV line, handling quotes and commas
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    /**
     * Generate the comparison table
     */
    generateComparisonTable() {
        const comparisonContent = document.getElementById('comparison-content');
        if (!comparisonContent) return;

        comparisonContent.innerHTML = '';

        // Get all unique modules
        const allModules = new Set();
        this.parsedData.forEach(fileData => {
            Object.keys(fileData.data).forEach(module => allModules.add(module));
        });

        // Sort modules to ensure consistent order
        const sortedModules = Array.from(allModules).sort();

        // Create comparison table for each module
        sortedModules.forEach(moduleName => {
            const moduleBlock = this.createModuleBlock(moduleName);
            comparisonContent.appendChild(moduleBlock);
        });
    }

    /**
     * Create a module block for comparison
     */
    createModuleBlock(moduleName) {
        const moduleBlock = document.createElement('div');
        moduleBlock.className = 'module-block';

        // Module header
        const moduleHeader = document.createElement('div');
        moduleHeader.className = 'module-header';
        moduleHeader.textContent = moduleName;
        moduleBlock.appendChild(moduleHeader);

        // Comparison table
        const table = document.createElement('table');
        table.className = 'comparison-table';

        // Create header row
        const headerRow = this.createTableHeader();
        table.appendChild(headerRow);

        // Add summary rows first
        this.addSummaryRows(table, moduleName);

        // Add field rows
        this.addFieldRows(table, moduleName);

        // Add component table rows
        this.addComponentTableRows(table, moduleName);

        moduleBlock.appendChild(table);
        return moduleBlock;
    }

    /**
     * Create table header
     */
    createTableHeader() {
        const headerRow = document.createElement('tr');

        // Field name header
        const fieldHeader = document.createElement('th');
        fieldHeader.textContent = 'Field';
        fieldHeader.className = 'field-name';
        headerRow.appendChild(fieldHeader);

        // File name headers
        this.parsedData.forEach(fileData => {
            const th = document.createElement('th');
            th.textContent = fileData.filename;
            headerRow.appendChild(th);
        });

        return headerRow;
    }

    /**
     * Add summary rows to the table
     */
    addSummaryRows(table, moduleName) {
        // Get all unique summary fields
        const allSummaryFields = new Set();
        this.parsedData.forEach(fileData => {
            const moduleData = fileData.data[moduleName];
            if (moduleData && moduleData.summary) {
                Object.keys(moduleData.summary).forEach(field => allSummaryFields.add(field));
            }
        });

        // Add each summary field as a row
        allSummaryFields.forEach(fieldName => {
            const row = this.createComparisonRow(fieldName, moduleName, 'summary');
            table.appendChild(row);
        });
    }

    /**
     * Add field rows to the table
     */
    addFieldRows(table, moduleName) {
        // Get all unique fields (excluding summary fields)
        const allFields = new Set();
        this.parsedData.forEach(fileData => {
            const moduleData = fileData.data[moduleName];
            if (moduleData && moduleData.fields) {
                Object.keys(moduleData.fields).forEach(field => {
                    // Skip summary fields as they're handled separately
                    if (!field.toLowerCase().includes('total') &&
                        !field.toLowerCase().includes('sum') &&
                        !field.toLowerCase().includes('percentage')) {
                        allFields.add(field);
                    }
                });
            }
        });

        // Sort fields for consistent display
        const sortedFields = Array.from(allFields).sort();

        // Add each field as a row
        sortedFields.forEach(fieldName => {
            const row = this.createComparisonRow(fieldName, moduleName, 'field');
            table.appendChild(row);
        });
    }

    /**
     * Add component table rows
     */
    addComponentTableRows(table, moduleName) {
        // Get all unique components
        const allComponents = new Set();
        this.parsedData.forEach(fileData => {
            const moduleData = fileData.data[moduleName];
            if (moduleData && moduleData.table) {
                moduleData.table.forEach(component => {
                    allComponents.add(component.component);
                });
            }
        });

        if (allComponents.size === 0) return;

        // Add component rows
        allComponents.forEach(componentName => {
            // Add rows for each component property
            const properties = ['Material', 'Treatment', 'Qty/Set', 'Unit Cost(RMB)', 'Total Cost(RMB)'];

            properties.forEach(prop => {
                const row = this.createComponentRow(componentName, prop, moduleName);
                table.appendChild(row);
            });
        });
    }

    /**
     * Create a comparison row
     */
    createComparisonRow(fieldName, moduleName, rowType) {
        const row = document.createElement('tr');
        if (rowType === 'summary') {
            row.className = 'summary-row';
        }

        // Field name cell
        const fieldCell = document.createElement('td');
        fieldCell.className = 'field-name';
        fieldCell.textContent = fieldName;
        row.appendChild(fieldCell);

        // Data cells
        const values = [];
        this.parsedData.forEach(fileData => {
            const cell = document.createElement('td');
            const moduleData = fileData.data[moduleName];

            let value = '';
            if (moduleData) {
                if (rowType === 'summary' && moduleData.summary) {
                    value = moduleData.summary[fieldName] || '';
                } else if (moduleData.fields) {
                    value = moduleData.fields[fieldName] || '';
                }
            }

            cell.textContent = value || '-';
            if (!value) {
                cell.className = 'no-data';
            }

            row.appendChild(cell);
            values.push(value);
        });

        // Apply min/max highlighting for numeric fields
        if (this.isNumericField(fieldName)) {
            this.highlightMinMax(row, values);
        }

        return row;
    }

    /**
     * Create a component row
     */
    createComponentRow(componentName, property, moduleName) {
        const row = document.createElement('tr');

        // Field name cell
        const fieldCell = document.createElement('td');
        fieldCell.className = 'field-name';
        fieldCell.textContent = `${componentName} ${property}`;
        row.appendChild(fieldCell);

        // Data cells
        const values = [];
        this.parsedData.forEach(fileData => {
            const cell = document.createElement('td');
            const moduleData = fileData.data[moduleName];

            let value = '';
            if (moduleData && moduleData.table) {
                const component = moduleData.table.find(c => c.component === componentName);
                if (component) {
                    switch (property) {
                        case 'Material':
                            value = component.material;
                            break;
                        case 'Treatment':
                            value = component.treatment;
                            break;
                        case 'Qty/Set':
                            value = component.qty;
                            break;
                        case 'Unit Cost(RMB)':
                            value = component.unitCost;
                            break;
                        case 'Total Cost(RMB)':
                            value = component.totalCost;
                            break;
                    }
                }
            }

            cell.textContent = value || '-';
            if (!value) {
                cell.className = 'no-data';
            }

            row.appendChild(cell);
            values.push(value);
        });

        // Apply min/max highlighting for numeric fields
        if (property.includes('Cost') || property.includes('Qty')) {
            this.highlightMinMax(row, values);
        }

        return row;
    }

    /**
     * Check if a field is numeric
     */
    isNumericField(fieldName) {
        const numericKeywords = [
            'cost', 'rate', 'hrs', 'hours', 'qty', 'quantity', 'pitch', 'size',
            'total', 'sum', 'percentage', 'price', 'amount', 'value', 'weight',
            'time', 'days', 'weeks', 'months'
        ];

        const lowerFieldName = fieldName.toLowerCase();
        return numericKeywords.some(keyword => lowerFieldName.includes(keyword));
    }

    /**
     * Highlight min/max values in a row
     */
    highlightMinMax(row, values) {
        // Parse numeric values
        const numericValues = values.map(v => {
            if (!v || v === '-') return null;

            // Remove common non-numeric characters
            const cleaned = v.toString().replace(/[,%\s]/g, '');
            const num = parseFloat(cleaned);

            return isNaN(num) ? null : num;
        }).filter(v => v !== null);

        // Need at least 2 values to compare
        if (numericValues.length < 2) return;

        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);

        // Don't highlight if all values are the same
        if (min === max) return;

        // Apply highlighting
        const cells = row.querySelectorAll('td:not(.field-name)');
        cells.forEach((cell, index) => {
            const value = values[index];
            if (!value || value === '-') return;

            const cleaned = value.toString().replace(/[,%\s]/g, '');
            const num = parseFloat(cleaned);

            if (isNaN(num)) return;

            if (num === min) {
                cell.classList.add('min');
            } else if (num === max) {
                cell.classList.add('max');
            }
        });
    }

    /**
     * Export comparison results to CSV
     */
    exportToCSV() {
        if (!this.parsedData || this.parsedData.length === 0) {
            alert('No data to export');
            return;
        }

        const csvContent = this.generateCSVContent();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `cost_comparison_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    /**
     * Generate CSV content for export
     */
    generateCSVContent() {
        let csvContent = '';

        // Get all unique modules
        const allModules = new Set();
        this.parsedData.forEach(fileData => {
            Object.keys(fileData.data).forEach(module => allModules.add(module));
        });

        const sortedModules = Array.from(allModules).sort();

        // Process each module
        sortedModules.forEach(moduleName => {
            csvContent += `\n# ${moduleName}\n`;

            // Header row
            csvContent += 'Field,' + this.parsedData.map(f => f.filename).join(',') + '\n';

            // Summary rows
            const allSummaryFields = new Set();
            this.parsedData.forEach(fileData => {
                const moduleData = fileData.data[moduleName];
                if (moduleData && moduleData.summary) {
                    Object.keys(moduleData.summary).forEach(field => allSummaryFields.add(field));
                }
            });

            allSummaryFields.forEach(fieldName => {
                const row = [fieldName];
                this.parsedData.forEach(fileData => {
                    const moduleData = fileData.data[moduleName];
                    const value = (moduleData && moduleData.summary) ? moduleData.summary[fieldName] || '' : '';
                    row.push(value);
                });
                csvContent += row.join(',') + '\n';
            });

            // Field rows
            const allFields = new Set();
            this.parsedData.forEach(fileData => {
                const moduleData = fileData.data[moduleName];
                if (moduleData && moduleData.fields) {
                    Object.keys(moduleData.fields).forEach(field => {
                        if (!field.toLowerCase().includes('total') &&
                            !field.toLowerCase().includes('sum') &&
                            !field.toLowerCase().includes('percentage')) {
                            allFields.add(field);
                        }
                    });
                }
            });

            const sortedFields = Array.from(allFields).sort();
            sortedFields.forEach(fieldName => {
                const row = [fieldName];
                this.parsedData.forEach(fileData => {
                    const moduleData = fileData.data[moduleName];
                    const value = (moduleData && moduleData.fields) ? moduleData.fields[fieldName] || '' : '';
                    row.push(value);
                });
                csvContent += row.join(',') + '\n';
            });
        });

        return csvContent;
    }

    /**
     * Clear all uploaded files and reset the comparison
     */
    clearAll() {
        this.uploadedFiles = [];
        this.parsedData = [];
        this.updateFileList();
        this.updateCompareButtonVisibility();
        this.hideStatus();

        // Hide comparison section
        const comparisonSection = document.getElementById('comparison-section');
        if (comparisonSection) {
            comparisonSection.style.display = 'none';
        }
    }
}

// Initialize the cost comparison tool when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const costComparison = new CostComparison();

    // Make methods globally accessible for HTML buttons
    window.costComparison = costComparison;
    window.exportCSV = () => costComparison.exportToCSV();
    window.clearAll = () => costComparison.clearAll();
});