const adminUserInfo = document.getElementById('admin-user-info');
const adminAlert = document.getElementById('admin-alert');
const adminNotAllowed = document.getElementById('admin-not-allowed');
const adminContent = document.getElementById('admin-content');
const adminTableBody = document.getElementById('admin-requests-body');
const btnReload = document.getElementById('admin-btn-reload');
const btnLogout = document.getElementById('admin-btn-logout');
const btnHome = document.getElementById('admin-btn-home');

function showAlert(message, type = 'info') {
  adminAlert.textContent = message;
  adminAlert.className = `alert alert-${type}`;
  adminAlert.classList.remove('d-none');
  setTimeout(() => {
    adminAlert.classList.add('d-none');
  }, 3000);
}

async function ensureAdminUser() {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Error obteniendo usuario');
    const user = await res.json();

    if (!user) {
      window.location.href = '/';
      return null;
    }

    adminUserInfo.textContent = `${user.displayName} (${user.email}) - Rol: ${user.role}`;

    if (user.role !== 'admin' && user.role !== 'finance') {
      adminNotAllowed.classList.remove('d-none');
      adminContent.classList.add('d-none');
      return null;
    }

    adminNotAllowed.classList.add('d-none');
    adminContent.classList.remove('d-none');
    return user;
  } catch (err) {
    console.error(err);
    showAlert('No se pudo verificar el usuario.', 'danger');
    return null;
  }
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString();
}

function safeGet(obj, path, defaultValue = '') {
  try {
    const parts = path.split('.');
    let current = obj;
    for (const p of parts) {
      if (current == null) return defaultValue;
      current = current[p];
    }
    return current == null ? defaultValue : current;
  } catch {
    return defaultValue;
  }
}

function buildRow(req) {
  const tr = document.createElement('tr');

  const description =
    safeGet(req, 'payload.po_description') ||
    safeGet(req, 'payload.data.po_description') ||
    '';
  const total =
    safeGet(req, 'payload.total_order') ||
    safeGet(req, 'payload.data.total_order') ||
    '';

  tr.innerHTML = `
    <td>${req.id}</td>
    <td>${formatDate(req.created_at)}</td>
    <td>${req.user_name || ''}</td>
    <td>${req.user_email || ''}</td>
    <td>${req.user_role || ''}</td>
    <td>
      <span class="badge bg-${
        req.status === 'approved'
          ? 'success'
          : req.status === 'rejected'
          ? 'danger'
          : 'secondary'
      }">${req.status}</span>
    </td>
    <td>${description}</td>
    <td>${total}</td>
    <td>
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-outline-success" data-action="approve">Aprobar</button>
        <button class="btn btn-outline-danger" data-action="reject">Rechazar</button>
      </div>
    </td>
  `;

  tr.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      const status = action === 'approve' ? 'approved' : 'rejected';
      updateStatus(req.id, status);
    });
  });

  return tr;
}

async function loadRequests() {
  adminTableBody.innerHTML = '';
  try {
    const res = await fetch('/api/po-requests', { credentials: 'same-origin' });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || 'Error obteniendo órdenes');
    }
    const data = await res.json();
    data.forEach((req) => {
      adminTableBody.appendChild(buildRow(req));
    });
  } catch (err) {
    console.error(err);
    showAlert(err.message, 'danger');
  }
}

async function updateStatus(id, status) {
  try {
    const res = await fetch(`/api/po-requests/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || 'Error actualizando estado');
    }
    showAlert(`Orden ${id} actualizada a ${status}`, 'success');
    await loadRequests();
  } catch (err) {
    console.error(err);
    showAlert(err.message, 'danger');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await ensureAdminUser();
  if (!user) return;
  await loadRequests();
});

if (btnReload) {
  btnReload.addEventListener('click', loadRequests);
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

if (btnHome) {
  btnHome.addEventListener('click', () => {
    window.location.href = '/';
  });
}

