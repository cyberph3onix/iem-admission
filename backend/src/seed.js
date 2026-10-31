// Seeds SAMPLE courses and one admin. Safe to re-run. Data is synthetic, not the official IEM catalogue.
const bcrypt = require('bcryptjs');
const config = require('./config');
const { connectDatabase } = require('./config/database');
const User = require('./models/User');
const Course = require('./models/Course');
const { ROLES } = require('./config/constants');

const COURSES = [
  ['B.Tech - Computer Science (Sample)', 'Sample program for the POC'],
  ['B.Tech - Electronics (Sample)', 'Sample program for the POC'],
  ['MBA (Sample)', 'Sample program for the POC'],
  ['MCA (Sample)', 'Sample program for the POC'],
];

(async () => {
  await connectDatabase(config.mongoUri);
  for (const [courseName, description] of COURSES) {
    await Course.updateOne({ courseName }, { $setOnInsert: { courseName, description, isActive: true } }, { upsert: true });
  }
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env');
  await User.updateOne(
    { email },
    { $setOnInsert: { name: process.env.ADMIN_NAME || 'Administrator', email, role: ROLES.ADMIN, passwordHash: await bcrypt.hash(password, 10) } },
    { upsert: true }
  );
  console.log(`Seeded ${COURSES.length} courses and admin <${email}>.`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
