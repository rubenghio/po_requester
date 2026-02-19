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
        const desc = row.querySelectorAll('.item-desc')[0].value;
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
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('items-body')) {
        addRow();
    }
});

// --- AUTENTICACIÓN Y ENVÍO DEL FORMULARIO ---
const btnSubmit = document.getElementById('btn-submit');
const form = document.getElementById('oc-form');
const authMessage = document.getElementById('auth-message');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const userInfo = document.getElementById('user-info');

async function fetchCurrentUser() {
    try {
        const res = await fetch('/api/me', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Error obteniendo usuario');
        const user = await res.json();

        if (!user) {
            userInfo.textContent = '';
            authMessage.classList.remove('d-none');
            form.classList.add('d-none');
            btnLogin.classList.remove('d-none');
            btnLogout.classList.add('d-none');
        } else {
            userInfo.textContent = `${user.displayName} (${user.email}) - Rol: ${user.role}`;
            authMessage.classList.add('d-none');
            form.classList.remove('d-none');
            btnLogin.classList.add('d-none');
            btnLogout.classList.remove('d-none');

            const nameInput = document.getElementById('user_name');
            const emailInput = document.getElementById('user_email');
            if (nameInput && !nameInput.value) {
                nameInput.value = user.displayName || '';
            }
            if (emailInput && !emailInput.value) {
                emailInput.value = user.email || '';
            }
        }
    } catch (err) {
        console.error(err);
        authMessage.classList.remove('d-none');
        form.classList.add('d-none');
        btnLogin.classList.remove('d-none');
        btnLogout.classList.add('d-none');
    }
}

if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        window.location.href = '/auth/google';
    });
}

if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        try {
            await fetch('/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin'
            });
        } catch (e) {
            console.error(e);
        } finally {
            window.location.href = '/';
        }
    });
}

if (form) {
    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        if (!btnSubmit) return;

        btnSubmit.innerText = 'Procesando Envío...';
        btnSubmit.disabled = true;

        try {
            const jsonData = getFormDataAsJson(event);
            const res = await fetch('/api/po-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: jsonData
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody.error || 'Error enviando la solicitud');
            }

            btnSubmit.innerText = '¡Solicitud Enviada!';
            btnSubmit.classList.replace('btn-primary', 'btn-success');
            alert('La Orden de Compra ha sido enviada correctamente.');
            this.reset();
            document.getElementById('items-body').innerHTML = "";
            addRow();
        } catch (err) {
            console.error(err);
            btnSubmit.disabled = false;
            btnSubmit.innerText = 'Reintentar Envío';
            alert('Hubo un error al enviar: ' + err.message);
        }
    });
}

function getFormDataAsJson(event) {
    const form = event.target;
    const formData = new FormData(form);
    const formObject = Object.fromEntries(formData.entries());
    const jsonString = JSON.stringify(formObject);
    const jsonObj = JSON.parse(jsonString);
    jsonObj.total_order = document.getElementById('total-general').innerText;
    jsonObj.items_summary = tableToJson('items-table');
    return JSON.stringify(jsonObj);
}

function tableToJson(tableId) {
    const table = document.getElementById(tableId);
    const headers = [];
    const rows = [];

    for (const headerCell of table.rows[0].cells) {
        headers.push(headerCell.textContent.trim());
    }
    headers.pop();

    for (let i = 1; i < table.rows.length; i++) {
        const row = table.rows[i];
        const obj = {};

        for (let j = 0; j < row.cells.length - 1; j++) {
            const cell = row.cells[j];
            const cellContent = cell.querySelector('input') ? cell.querySelector('input').value : cell.innerText.trim();
            obj[headers[j]] = cellContent;
        }
        rows.push(obj);
    }

    return rows;
}

document.addEventListener('DOMContentLoaded', fetchCurrentUser);

