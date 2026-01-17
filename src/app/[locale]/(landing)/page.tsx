import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';

import { Landing } from '@/shared/types/blocks/landing';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // 1. 直接加载语言包，不调用 getApprovedTestimonials (避免 DATABASE_URL 错误)
  const t = await getTranslations('landing');

  // 2. 构建页面对象，全部使用静态 JSON 数据或设为 undefined
  const page: Landing = {
    hero: {
      ...t.raw('hero'),
      image: undefined,        // 隐藏导致误会的后台截图
      image_invert: undefined,
      show_avatars: false,    // 隐藏虚假社交头像
    },
    
    // 明确设为 undefined 阻止 UI 渲染，避免触发数据库查询
    logos: undefined,
    introduce: undefined,
    benefits: undefined,
    usage: undefined,
    features: t.raw('features'),
    stats: undefined,
    testimonials: undefined, // 彻底禁用评价区块
    
    subscribe: t.raw('subscribe'),
    faq: t.raw('faq'),
    cta: t.raw('cta'),
  };

  // 3. 加载页面组件
  const Page = await getThemePage('landing');

  return <Page locale={locale} page={page} />;
}
