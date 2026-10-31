const mongoose = require('mongoose');

// Only metadata lives in MongoDB; file bytes live on disk under UPLOAD_DIR.
const documentSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    documentType: { type: String, required: true },
    originalName: { type: String, required: true }, // display only
    storedName: { type: String, required: true }, // random server-generated name
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    validationStatus: { type: String, enum: ['Accepted', 'Rejected'], default: 'Accepted' },
    validationMessage: String,
  },
  { timestamps: { createdAt: 'uploadedAt', updatedAt: false } }
);

// One document per category per application; re-uploading replaces it.
documentSchema.index({ application: 1, documentType: 1 }, { unique: true });

// Do not expose the on-disk name.
documentSchema.set('toJSON', {
  transform: (_d, ret) => {
    delete ret.storedName;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Document', documentSchema);
