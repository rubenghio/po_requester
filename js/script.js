// --- CONFIGURACIÓN EMAILJS ---
(function () {
    // REEMPLAZA "TU_PUBLIC_KEY" con la de tu cuenta de EmailJS
    emailjs.init("HW5xhMtK0mptq2lvS");
})();

// --- LÓGICA DE LA TABLA ---
function addRow() {
    const tbody = document.getElementById('items-body');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" class="form-control item-desc" placeholder="Item #1" required></td>
        <td><input type="text" class="form-control item-desc" placeholder="Describa el servicio..." required></td>
        <td><input type="number" class="form-control item-qty" value="1" min="1" oninput="updateCalculations()"></td>
        <td><input type="number" class="form-control item-price" value="0" min="0" step="0.01" oninput="updateCalculations()"></td>
        <td class="pt-3"><span class="item-subtotal fw-bold">0.00</span></td>
        <td><button type="button" class="btn btn-outline-danger btn-sm" onclick="removeRow(this)">✕</button></td>
    `;
    tbody.appendChild(row);
    updateCalculations();
}

function removeRow(btn) {
    const rows = document.querySelectorAll('#items-body tr');
    if (rows.length > 1) {
        btn.closest('tr').remove();
        updateCalculations();
    } else {
        alert("La orden debe tener al menos una línea.");
    }
}

function updateCalculations() {
    let total = 0;
    let summaryText = "";
    const rows = document.querySelectorAll('#items-body tr');

    rows.forEach(row => {
        const desc = row.querySelector('.item-desc').value;
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const subtotal = qty * price;

        row.querySelector('.item-subtotal').innerText = subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 });
        total += subtotal;

        if (desc) {
            summaryText += `${desc} (Cant: ${qty} x Val: ${price}) = $${subtotal.toFixed(2)}\n`;
        }
    });

    document.getElementById('total-general').innerText = total.toLocaleString('en-US', { minimumFractionDigits: 2 });
    document.getElementById('items_summary').value = summaryText;
}

// Inicializar primera fila
addRow();

// --- ENVÍO DEL FORMULARIO ---
const btnSubmit = document.getElementById('btn-submit');

document.getElementById('oc-form').addEventListener('submit', function (event) {
    event.preventDefault();

    // Get Form data as JSon
    const jsonData = getFormDataAsJson(event);

    btnSubmit.innerText = 'Procesando Envío...';
    btnSubmit.disabled = true;

    // IDs de EmailJS (Cámbialos por los tuyos)
    const serviceID = 'service_vl1yfaq';
    const templateID = 'template_px6hfr8';

    emailjs.send(serviceID, templateID, {
        json_object: jsonData
    })
        .then(() => {
            btnSubmit.innerText = '¡Solicitud Enviada!';
            btnSubmit.classList.replace('btn-primary', 'btn-success');
            alert('La Orden de Compra ha sido enviada correctamente al equipo de Finanzas de Ingenia.');
            this.reset();
            document.getElementById('items-body').innerHTML = "";
            addRow();
        }, (err) => {
            btnSubmit.disabled = false;
            btnSubmit.innerText = 'Reintentar Envío';
            alert('Hubo un error al enviar: ' + JSON.stringify(err));
        });
});

function getFormDataAsJson(event) {
    // 2. Gather the form data using the FormData API
    const form = event.target;
    const formData = new FormData(form);

    // 3. Convert FormData to a plain JavaScript object
    // Object.fromEntries is a convenient way to do this
    const formObject = Object.fromEntries(formData.entries());

    // 4. Convert the JavaScript object to a JSON string
    const jsonString = JSON.stringify(formObject);

    // 5. Replace table rows to json array format (instead of String)
    const jsonObj = JSON.parse(jsonString);
    jsonObj.total_order = document.getElementById('total-general').innerText
    jsonObj.items_summary = tableToJson('items-table');

    // 6. New JSON with array list included
    return JSON.stringify(jsonObj);
}

function tableToJson(tableId) {
    const table = document.getElementById(tableId);
    const headers = [];
    const rows = [];

    // Get headers (assuming the first row is the header)
    for (const headerCell of table.rows[0].cells) {
        headers.push(headerCell.textContent.trim());
    }
    //Remove last column (X)
    headers.pop();

    // Iterate over rows (starting from the second row for data)
    for (let i = 1; i < table.rows.length; i++) {
        const row = table.rows[i];
        const obj = {};

        // Iterate over cells and match with headers (avoid last column)
        for (let j = 0; j < row.cells.length - 1; j++) {
            const cell = row.cells[j];
            // Get value from input fields or innerText
            const cellContent = cell.querySelector('input') ? cell.querySelector('input').value : cell.innerText.trim();
            obj[headers[j]] = cellContent;
        }
        rows.push(obj);
    }

    // Convert the array of objects to a JSON string
    return rows;
}

