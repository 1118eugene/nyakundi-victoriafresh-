import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    unit: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
    image: { type: String, default: '' },
  },
  { _id: false },
)

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    trackingToken: { type: String, required: true, unique: true, select: false },
    inventoryReserved: { type: Boolean, default: false },
    customer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
    },
    delivery: {
      county: { type: String, required: true, trim: true },
      town: { type: String, required: true, trim: true },
      addressLine: { type: String, required: true, trim: true },
      landmark: { type: String, default: '', trim: true },
      notes: { type: String, default: '', trim: true },
    },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'KES' },
    status: {
      type: String,
      enum: ['awaiting_payment', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'awaiting_payment',
    },
    paymentMethod: {
      type: String,
      enum: ['mpesa'],
      default: 'mpesa',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'initiated', 'paid', 'failed'],
      default: 'pending',
    },
    mpesa: {
      phone: { type: String, default: '' },
      merchantRequestID: { type: String, default: '' },
      checkoutRequestID: { type: String, default: '' },
      receiptNumber: { type: String, default: '' },
      resultCode: { type: Number, default: null },
      resultDescription: { type: String, default: '' },
      callbackPayload: { type: Object, default: null },
      requestedAt: { type: Date, default: null },
      paidAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id.toString()
        delete ret._id
        delete ret.__v
        delete ret.trackingToken
        return ret
      },
    },
  },
)

const Order = mongoose.model('Order', orderSchema)

export default Order
