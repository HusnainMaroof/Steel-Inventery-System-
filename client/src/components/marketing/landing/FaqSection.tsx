import { Container, SectionHeader } from "@/components/marketing/PublicKit";

const faqs = [
  {
    question: "What is Tijartt?",
    answer:
      "Tijartt is inventory, billing and khata software for traders and depots. It records purchases, stock, sales bills, customer dues, supplier payments, expenses and profit in one place, so every number on the dashboard comes from the same records.",
  },
  {
    question: "Who is Tijartt for?",
    answer:
      "Traders and depots that buy and sell goods in bulk, such as steel, cement, wire, paint and tiles businesses. It suits an owner who wants to see stock, dues and profit without a paper register or a pile of spreadsheets.",
  },
  {
    question: "How does Tijartt keep stock correct?",
    answer:
      "Stock is not typed in by hand. Every purchase adds stock and every sale removes it, and any correction is saved as a recorded adjustment. The stock on screen is the total of those records, so it always matches what was bought and sold.",
  },
  {
    question: "Can I track customer dues (udhaar)?",
    answer:
      "Yes. Every sale makes a numbered bill. A payment you receive is set against the bill you choose, or against the oldest unpaid bills first, so you always see who owes you and how much. Payments to suppliers work the same way for what you owe.",
  },
  {
    question: "Can my staff use it?",
    answer:
      "Yes. The owner creates a separate login for each staff member and picks which pages they can open, for example sales and payments but not reports.",
  },
  {
    question: "Can I print bills and export reports?",
    answer: "Yes. Bills print with your business logo. Profit, stock, cash and dues reports cover any period you pick and export to Excel or PDF.",
  },
  {
    question: "Does it work on a phone?",
    answer: "Yes. Tijartt runs in the web browser on a computer or a phone. There is nothing to install.",
  },
  {
    question: "How do I get started?",
    answer:
      "The Tijartt team sets up each account. Contact us, pick a monthly, yearly or lifetime plan, and we create your business account and owner login.",
  },
] as const;

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="py-20 sm:py-28">
      <Container className="grid gap-6">
        <div>
          <SectionHeader id="faq-heading" title="Questions traders ask" />
        </div>
        <div className="grid gap-x-12 border-t border-line lg:grid-cols-2">
          {faqs.map((faq) => (
            <div key={faq.question} className="border-b border-line py-6">
              <h3 className="text-[19px] leading-[1.3] font-semibold tracking-[-0.015em] text-[#171717]">{faq.question}</h3>
              <p className="mt-2 text-[15px] leading-[1.6] text-[#171717]/70">{faq.answer}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
