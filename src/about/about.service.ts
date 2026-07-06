import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ABOUT_KEY = 'about:page';

const DEFAULT = {
  heroImage: '/assets/images/rizz_master_color_sandals/image01.jpg',
  storyParagraphs: [
    'RIZZ was founded in 2018 in a workshop in Chittagong\'s leather district — the same streets where Bangladeshi leather has been cut, stitched, and exported for over a century.',
    'We sell directly. We make everything ourselves. We stand behind every piece with a one-year warranty.',
    'Today, RIZZ makes footwear, belts, and wallets from genuine leather, with Cash on Delivery across Bangladesh and international shipping to Europe, USA, and the Middle East.',
  ],
  values: [
    { title: 'Genuine Leather. Always.', body: 'Every piece uses real leather — full-grain, vegetable-tanned, suede, or embossed calfskin.' },
    { title: 'Made by Hand.', body: 'Our craftsmen cut, stitch, and finish each piece individually.' },
    { title: 'Direct to You.', body: 'We sell directly to the customer, with no middlemen.' },
    { title: 'Made to Last.', body: 'Properly cared for, our pieces improve with age. We back that with a one-year craftsmanship warranty.' },
  ],
  timeline: [
    { year: '2018', event: 'Founded in a small workshop in Chittagong\'s leather district.' },
    { year: '2020', event: 'Launched first retail collection — 3 styles, 80 pairs. Sold out in 6 weeks.' },
    { year: '2022', event: 'Expanded to full footwear, belts, and wallets. Began COD delivery nationwide.' },
    { year: '2024', event: 'Started international shipping to UAE, UK, and USA.' },
    { year: '2025', event: 'Launched the RIZZ digital store.' },
  ],
  quoteText: 'Every pair that leaves our workshop carries a piece of Chittagong with it.',
  quoteAuthor: 'The Rizz Atelier',
  faq: [
    { q: 'Where are RIZZ products made?', a: 'All RIZZ products are handcrafted in Chittagong, Bangladesh — in our own workshop by our own craftsmen.' },
    { q: 'Is the leather genuine?', a: 'Yes. We use only genuine leather — full-grain, vegetable-tanned, suede, or embossed calfskin. No synthetic or bonded leather.' },
    { q: 'Do you offer a warranty?', a: 'Yes. All products come with a one-year craftsmanship warranty covering stitching, hardware, and structural defects.' },
    { q: 'Can I visit the workshop?', a: 'We welcome visits by appointment. Contact us via WhatsApp or email to arrange a visit to our Chittagong atelier.' },
  ],
};

@Injectable()
export class AboutService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const setting = await this.prisma.setting.findUnique({ where: { key: ABOUT_KEY } });
    return setting?.value ?? DEFAULT;
  }

  async upsert(data: Record<string, any>) {
    return this.prisma.setting.upsert({
      where: { key: ABOUT_KEY },
      update: { value: data },
      create: { key: ABOUT_KEY, value: data },
    });
  }
}
