export const CATEGORIAS = [
  'Todas',
  'Tradicional',
  'Fitness & Low Carb',
  'Vegetariana & Vegana',
  'Executiva',
  'Gourmet',
  'Massas',
];

export const GOSTOS_SUGERIDOS = [
  'Caseiro',
  'Bem Temperado',
  'Leve',
  'Rico em Proteína',
  'Picante',
  'Cremoso',
  'Agridoce',
  'Defumado',
  'Gratinado',
  'Sem Lactose',
];

export const IMAGENS_GALERIA = [
  { label: 'Feijoada Completa', url: '/images/marmitas/feijoada.jpg' },
  { label: 'Frango Fitness', url: '/images/marmitas/fitness-frango.jpg' },
  { label: 'Salmão Gourmet', url: '/images/marmitas/salmao-gourmet.jpg' },
  { label: 'Bowl Vegano', url: '/images/marmitas/bowl-vegano.jpg' },
  { label: 'Strogonoff Cremoso', url: '/images/marmitas/strogonoff.jpg' },
  { label: 'Churrasco & Tropeiro', url: '/images/marmitas/churrasco-tropeiro.jpg' },
  { label: 'Lasanha Bolonhesa', url: '/images/marmitas/lasanha.jpg' },
  { label: 'Curry Tailandês', url: '/images/marmitas/curry-tailandes.jpg' },
];

export const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400'%3E%3Crect width='600' height='400' fill='%23FFF3E0'/%3E%3Ccircle cx='300' cy='200' r='125' fill='%23EA580C' opacity='0.14'/%3E%3Ccircle cx='300' cy='200' r='88' fill='%23FFFFFF' stroke='%23EA580C' stroke-width='4'/%3E%3Ctext x='300' y='208' text-anchor='middle' font-family='sans-serif' font-size='24' font-weight='bold' fill='%23EA580C'%3EMarmitexSocial%3C/text%3E%3C/svg%3E";

export function formatBRL(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function getEffectivePrice(marmita) {
  if (
    marmita.precoPromocional !== null &&
    marmita.precoPromocional !== undefined &&
    Number(marmita.precoPromocional) > 0 &&
    Number(marmita.precoPromocional) < Number(marmita.preco)
  ) {
    return Number(marmita.precoPromocional);
  }
  return Number(marmita.preco) || 0;
}

export function getDiscountPercent(marmita) {
  const base = Number(marmita.preco) || 0;
  const effective = getEffectivePrice(marmita);
  if (base <= 0 || effective >= base) return 0;
  return Math.round(((base - effective) / base) * 100);
}

export function parseGostoTags(gosto) {
  if (!gosto) return [];
  return String(gosto)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}
