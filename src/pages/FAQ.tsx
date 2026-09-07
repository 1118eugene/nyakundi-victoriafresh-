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
        { title: 'Which payment methods are available?', items: ['M-Pesa via a secure STK prompt'] },
        { title: 'How do you keep fish fresh?', text: 'Orders are hygienically cleaned, packaged carefully, and coordinated for delivery with handling instructions recorded at checkout.' },
        { title: 'Where do you deliver?', text: 'We currently serve Nairobi, nearby Kiambu areas, and arrange larger orders throughout Kenya. See the Delivery page for the current area list.' },
      ]}
      ctaLabel="Ask our team"
      ctaTo="/contact"
      imageSrc="/images/products/pexels-tilapia.jpg"
      imageAlt="Fresh tilapia ready to be prepared"
    />
  )
}
