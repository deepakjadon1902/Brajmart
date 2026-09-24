import SectionHeader from '@/components/ui/SectionHeader';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { productTrustFaqs } from '@/data/productTrustFaqs';

const trustWords = ['Authenticity', 'Purity', 'Devotion', 'Support'];

const ProductTrustFAQ = () => (
  <section className="storefront-band bg-background">
    <div className="storefront-shell">
      <SectionHeader
        tag="PRODUCT TRUST"
        title="Questions before bringing devotion home"
        subtitle="A clear guide to authenticity, purity, product choice and safe ordering on BrajMart."
      />

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <ScrollReveal>
          <div className="rounded-lg border border-border bg-brand-soft p-5">
            <h3 className="font-playfair text-2xl font-bold leading-tight text-foreground">
              Built around faith, clarity and care.
            </h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              BrajMart keeps devotional shopping simple: clear product details, respectful presentation, support before checkout and safe order choices.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {trustWords.map((item) => (
                <span key={item} className="rounded-full border border-gold/40 bg-white px-3 py-1 text-xs font-bold text-maroon">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <Accordion type="single" collapsible className="space-y-3">
            {productTrustFaqs.map((faq, index) => (
              <AccordionItem
                key={faq.question}
                value={`product-trust-${index}`}
                className="rounded-lg border border-border bg-card px-4 shadow-sm data-[state=open]:border-gold/50"
              >
                <AccordionTrigger className="text-left text-sm font-bold leading-6 text-foreground hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-7 text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollReveal>
      </div>
    </div>
  </section>
);

export default ProductTrustFAQ;

