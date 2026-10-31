const { STATUS } = require('../config/constants');

// Admin-driven transitions. The applicant's Draft -> Submitted goes only through the submit endpoint.
const ADMIN_TRANSITIONS = {
  [STATUS.SUBMITTED]: [STATUS.UNDER_REVIEW],
  [STATUS.UNDER_REVIEW]: [STATUS.SELECTED, STATUS.REJECTED],
};

function nextAdminStatuses(current) {
  return ADMIN_TRANSITIONS[current] || [];
}

function canAdminTransition(from, to) {
  return nextAdminStatuses(from).includes(to);
}

module.exports = { ADMIN_TRANSITIONS, nextAdminStatuses, canAdminTransition };
