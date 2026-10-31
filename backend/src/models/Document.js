const mongoose = require('mongoose');

// Metadata plus the file bytes (max 2 MB, well under MongoDB's 16 MB document limit).
const documentSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    documentType: { type: String, required: true },
    originalName: { type: String, required: true }, // display only
    data: { type: Buffer, required: true, select: false }, // never loaded or serialised unless asked for
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    validationStatus: { type: String, enum: ['Accepted', 'Rejected'], default: 'Accepted' },
    validationMessage: String,
  },
  { timestamps: { createdAt: 'uploadedAt', updatedAt: false } }
);

// One document per category per application; re-uploading replaces it.
documentSchema.index({ application: 1, documentType: 1 }, { unique: true });

// Never expose the file bytes in JSON.
documentSchema.set('toJSON', {
  transform: (_d, ret) => {
    delete ret.data;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Document', documentSchema);
