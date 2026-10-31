const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sign = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

exports.register = async (req, res) => {
  const { name, email, password, contactNumber } = req.body || {};
  const errors = {};
  if (typeof name !== 'string' || !name.trim()) errors.name = 'Name is required.';
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) errors.email = 'A valid email is required.';
  if (typeof password !== 'string' || password.length < 8) errors.password = 'Password must be at least 8 characters.';
  if (contactNumber != null && !/^[0-9+\-\s]{7,15}$/.test(String(contactNumber))) {
    errors.contactNumber = 'Contact number is invalid.';
  }
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, message: 'Validation failed.', errors });
  }
  if (await User.exists({ email: email.trim().toLowerCase() })) {
    return res.status(409).json({ success: false, message: 'Email is already registered.' });
  }
  // role is ALWAYS applicant here - any role in the body is ignored.
  const user = await User.create({
    name,
    email,
    contactNumber,
    passwordHash: await bcrypt.hash(password, 10),
    role: ROLES.APPLICANT,
  });
  res.status(201).json({ success: true, data: { user, token: sign(user) } });
};

exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  const user =
    typeof email === 'string' && typeof password === 'string'
      ? await User.findOne({ email: email.trim().toLowerCase() })
      : null;
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }
  res.json({ success: true, data: { user, token: sign(user) } });
};

exports.me = (req, res) => res.json({ success: true, data: { user: req.user } });
