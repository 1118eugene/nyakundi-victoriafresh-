import mongoose from 'mongoose'

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    category: { type: String, required: true, trim: true },
    species: { type: String, required: true, trim: true },
    preparation: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    active: { type: Boolean, default: true },
    inStock: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
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

const Product = mongoose.model('Product', productSchema)

export default Product
