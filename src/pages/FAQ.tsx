import InfoPage from '../components/InfoPage'

export default function FAQ() {
  return (
    <InfoPage
      kicker="Need to know"
      title="Frequently asked questions"
      intro="A few useful answers before you place your Victoria Fresh Fish Kenya order."
      sections={[
        { title: 'Where does the fish come from?', text: 'Our fish is sourced directly from Lake Victoria and supplied from our base at Gikomba Market, Nairobi.' },
        { title: 'Do you accept bulk orders?', text: 'Yes. We serve households and businesses, and accept bulk and wholesale orders throughout Kenya.' },
        { title: 'How do I place an order?', text: 'Browse the shop, add products to your cart, enter your delivery details, and submit the checkout request. You can also contact us on WhatsApp.' },
        { title: 'How do I pay?', items: ['Cash on delivery', 'M-Pesa after delivery (an STK prompt can be requested from the private order-tracking page after delivery)'] },
        { title: 'When is my order confirmed?', text: 'Your order is recorded first. Our team reviews it and updates its fulfilment status; payment is collected after delivery using the method selected at checkout.' },
        { title: 'Can I change or cancel an order?', text: 'Contact the team as soon as possible with your order number. Changes and cancellation depend on the order’s current fulfilment status. Paid orders require a separate refund review.' },
        { title: 'How can I follow my delivery?', text: 'Use the private tracking link provided after checkout. It shows the latest order and payment status. When the delivery team shares a live location, it is temporary and expires automatically.' },
        { title: 'How do you keep fish fresh?', text: 'Orders are hygienically cleaned, packaged carefully, and coordinated for delivery with handling instructions recorded at checkout.' },
        { title: 'Where do you deliver?', text: 'We serve listed Nairobi and nearby Kiambu areas and can discuss bulk arrangements elsewhere in Kenya. Delivery availability and timing should be confirmed with our team before placing a large order.' },
      ]}
      ctaLabel="Ask our team"
      ctaTo="/contact"
      imageSrc="/images/products/pexels-tilapia.jpg"
      imageAlt="Fresh tilapia ready to be prepared"
    />
  )
}
