import express from 'express'

const router = express.Router()

router.get('/support', (_req, res) => {
  res.json({
    status: 'success',
    data: {
      businessName: 'Victoria Fresh Fish Kenya',
      supportPhone: '+254117224696',
      supportEmail: 'info@victoriafreshfish.ke',
    },
  })
})

export default router
