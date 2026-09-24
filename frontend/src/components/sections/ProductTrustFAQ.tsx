import SectionHeader from '@/components/ui/SectionHeader';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { productTrustFaqs } from '@/data/productTrustFaqs';

const trustWords = ['Authenticity', 'Purity', 'Devotion', 'Support'];
const trustProofs = [
  ['Clear details', 'Names, photos, pricing and stock are visible before checkout.'],
  ['Devotional care', 'Items are presented for respectful puja, gifting and daily use.'],
  ['Order confidence', 'Cart, COD and payment choices stay clear before placing an order.'],
];

const ProductTrustFAQ = () => (
  <section className="storefront-band bg-background py-8 sm:py-10">
    <div className="storefront-shell max-w-6xl">
      <div className="mx-auto max-w-3xl text-center">
        <SectionHeader
          tag="PRODUCT TRUST"
          title="Questions before bringing devotion home"
          subtitle="A clear guide to authenticity, purity, product choice and safe ordering on BrajMart."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)] lg:items-stretch">
        <ScrollReveal>
          <div className="flex h-full flex-col rounded-lg border border-border bg-brand-soft p-5 shadow-sm sm:p-6">
            <h3 className="font-playfair text-2xl font-bold leading-tight text-foreground">
              Built around faith, clarity and care.
            </h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              BrajMart keeps devotional shopping simple: clear product details, respectful presentation, support before checkout and safe order choices.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {trustWords.map((item) => (
                <span key={item} className="rounded-full border border-gold/40 bg-white px-3 py-1 text-xs font-bold text-maroon">
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-6 divide-y divide-border/70 border-y border-border/70">
              {trustProofs.map(([title, text]) => (
                <div key={title} className="py-4">
                  <p className="text-sm font-bold text-foreground">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-5">
              <p className="rounded-lg bg-white/80 px-4 py-3 text-sm font-semibold leading-6 text-maroon">
                Need help choosing? BrajMart support can guide you before you place the order.
              </p>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="rounded-lg border border-border bg-card/60 p-2 shadow-sm sm:p-3">
            <Accordion type="single" collapsible className="space-y-2.5">
              {productTrustFaqs.map((faq, index) => (
                <AccordionItem
                  key={faq.question}
                  value={`product-trust-${index}`}
                  className="rounded-md border border-border bg-white px-4 shadow-[0_1px_3px_rgba(87,52,31,0.08)] data-[state=open]:border-gold/50 sm:px-5"
                >
                  <AccordionTrigger className="py-4 text-left text-sm font-bold leading-6 text-foreground hover:no-underline sm:py-5">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-sm leading-7 text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </ScrollReveal>
      </div>
    </div>
  </section>
);

export default ProductTrustFAQ;
