require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const morgan = require('morgan');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Helpers: roles ----
function resolveRoleFromEmail(email) {
  if (!email) return 'guest';

  const domain = email.split('@')[1] || '';
  const financeEmails = (process.env.FINANCE_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.includes(email.toLowerCase())) return 'admin';
  if (financeEmails.includes(email.toLowerCase())) return 'finance';

  if (domain.toLowerCase().includes('ingenia')) {
    return 'employee';
  }

  return 'requester';
}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated' });
}

function requireRole(allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

// ---- Passport configuration ----
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
    },
    (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          (profile.emails && profile.emails[0] && profile.emails[0].value) || null;
        const role = resolveRoleFromEmail(email);

        const user = {
          id: profile.id,
          displayName: profile.displayName,
          email,
          role
        };
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// ---- Express middleware ----
app.use(morgan('dev'));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());

// ---- Static frontend ----
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// ---- Auth routes ----
app.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/failure'
  }),
  (req, res) => {
    res.redirect('/');
  }
);

app.get('/auth/failure', (req, res) => {
  res.status(401).send('Error al iniciar sesión con Google.');
});

app.post('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.status(200).json({ ok: true });
    });
  });
});

// ---- API routes ----
app.get('/api/me', (req, res) => {
  if (!req.user) {
    return res.status(200).json(null);
  }
  return res.json({
    displayName: req.user.displayName,
    email: req.user.email,
    role: req.user.role
  });
});

app.post('/api/po-requests', ensureAuthenticated, async (req, res) => {
  try {
    const payload = req.body;

    const created = await db.createPoRequest({
      user: {
        displayName: req.user.displayName,
        email: req.user.email,
        role: req.user.role
      },
      payload
    });

    res.status(201).json({ ok: true, id: created.id });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error creating PO request', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get(
  '/api/po-requests',
  ensureAuthenticated,
  requireRole(['admin', 'finance']),
  async (req, res) => {
    try {
      const rows = await db.listPoRequests();
      res.json(rows);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error listing PO requests', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

app.patch(
  '/api/po-requests/:id/status',
  ensureAuthenticated,
  requireRole(['admin', 'finance']),
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!status) {
      return res.status(400).json({ error: 'Missing status' });
    }

    try {
      const updated = await db.updatePoRequestStatus(id, status);
      if (!updated) {
        return res.status(404).json({ error: 'Request not found' });
      }
      return res.json(updated);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error updating PO request status', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ---- Root route (serve SPA/HTML) ----
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

db.init()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize database', err);
    process.exit(1);
  });

