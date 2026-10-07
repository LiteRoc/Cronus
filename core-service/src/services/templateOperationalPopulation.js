const mongoose = require('mongoose');
function cohortFilter(templateId, facilityId, statuses = ['Active', 'Inactive']) {
  return {
    templateId: new mongoose.Types.ObjectId(templateId),
    facilityId: new mongoose.Types.ObjectId(facilityId),
    status: {
      $in: statuses
    },
    deletedAt: null,
    isArchived: {
      $ne: true
    }
  };
}
module.exports = {
  cohortFilter
};
