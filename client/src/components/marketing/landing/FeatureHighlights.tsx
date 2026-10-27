import { Container, RowList, SectionHeader } from "@/components/marketing/PublicKit";

const rows = [
  {
    title: "Purchases",
    text: "Landed cost on every bag and kg.",
  },
  {
    title: "Stock",
    text: "Always matches the yard.",
  },
  {
    title: "Sales and bills",
    text: "Numbered bills with your logo.",
  },
  {
    title: "Dues",
    text: "Who owes you, and whom you owe.",
  },
  {
    title: "Profit and reports",
    text: "Any period. Excel or PDF.",
  },
  {
    title: "Staff",
    text: "Their own login. Your choice of pages.",
  },
];

export function FeatureHighlights() {
  return (
    <section id="modules" aria-labelledby="modules-heading" className="py-20 sm:py-28">
      <Container className="grid gap-6">
        <div>
          <SectionHeader id="modules-heading" title="What it keeps" />
        </div>
        <RowList rows={rows} />
      </Container>
    </section>
  );
}
