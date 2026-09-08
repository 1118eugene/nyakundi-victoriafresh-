import mongoose from 'mongoose'

const otpSchema = new mongoose.Schema(
  {
    code: { type: String, default: '' },
    expiresAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
  },
  { _id: false },
)

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, required: true, trim: true, unique: true },
    customerName: { type: String, required: true, trim: true },
    googleId: { type: String, default: '', trim: true },
    county: { type: String, default: '', trim: true },
    town: { type: String, default: '', trim: true },
    addressLine: { type: String, default: '', trim: true },
    landmark: { type: String, default: '', trim: true },
    preferredPayment: { type: String, enum: ['mpesa', 'fuliza', 'both'], default: 'mpesa' },
    otp: { type: otpSchema, default: null },
    verifiedPhone: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id.toString()
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  },
)

const User = mongoose.model('User', userSchema)

export default User
