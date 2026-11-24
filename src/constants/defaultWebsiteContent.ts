import { StoreSettings, WebsiteContentConfig } from '../types';

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: 'DoraCake',
  fullName: 'DoraCake Bakery & Pastry',
  address: 'Jl. Kalibaru Barat',
  operationalHours: 'Setiap hari 07.00–21.00 WIB',
  whatsappNumber: '+62 857-7368-0571',
  contactInfo: 'WhatsApp Admin: +62 857-7368-0571 · Jl. Kalibaru Barat',
  minFreeShipping: 100000,
  defaultShippingCost: 15000,
  shippingRules:
    'Gratis ongkir untuk minimal pembelian Rp100.000 sesuai ketentuan area layanan. Ongkir di bawah minimum mengikuti jarak dan ketentuan admin.',
  pickupDeliveryStartHour: '08:00',
  pickupDeliveryEndHour: '18:00',
  cancellationPolicy:
    'Pembatalan pesanan hanya dapat dilakukan maksimal H-1 sebelum tanggal pengambilan atau pengiriman.',
  paymentInfoText:
    'Transfer Bank & QRIS resmi DoraCake setelah pesanan dikonfirmasi oleh admin toko via WhatsApp.',
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_WEBSITE_CONTENT: WebsiteContentConfig = {
  // 1. Identitas Toko
  storeName: 'DoraCake',
  brandName: 'DoraCake Bakery & Pastry',
  tagline: 'Homemade Cake & Pastry',
  logoUrl: '/src/assets/images/doracake_brand_emblem_1795461521363.jpg',
  primaryColor: '#3B2316',
  secondaryColor: '#FBF6EE',
  accentColor: '#C89D54',
  fontFamily: 'Playfair Display',

  // 2. Header Website
  logoSize: 'md',
  headerBgColor: '#FFFDF9',
  headerTextColor: '#2C1810',
  navOrder: ['search', 'tracking', 'cart', 'admin'],
  showSearch: true,
  searchPlaceholder: 'Cari roti cokelat, croissant, birthday cake...',
  showTracking: true,
  trackingLabel: 'Lacak Pesanan',
  showCart: true,
  cartLabel: 'Keranjang',
  showAdminButton: true,
  adminButtonLabel: 'Portal Admin',

  // 3. Hero Section
  heroTitle: 'Hai Cakeers!',
  heroDescription:
    'DoraCake menghadirkan beragam varian cake homemade yang dibuat dengan penuh cinta, menggunakan sistem pre-order untuk menjaga kesegaran, kualitas, dan kebersihan setiap produk yang kami sajikan.\n\nBukan sekadar cake, kami ingin menghadirkan kebahagiaan dalam setiap gigitan. 💗\n\nNantikan varian produk spesial dari DoraCake yang akan hadir di berbagai momen dan event istimewa. Akan selalu ada kejutan manis untuk menemani hari-harimu!',
  heroImageUrl: '/src/assets/images/doracake_hero_banner_1795461521972.jpg',
  heroBgColor: '#2C1810',
  heroBgImageUrl: '',
  heroPromoLabel: '✨ Stay tuned, Cakeers!',
  heroCtaText: 'Lihat Menu',
  heroCtaEnabled: true,
  heroCardKicker: 'Suara Cakeers',
  heroCardTitle: 'Berikan Saran & Kritik Ataupun Penilaian Kalian Ke Admin Ya',
  heroCardSubtitle:
    'Masukan dari Cakeers sangat berarti untuk menjaga kualitas rasa dan pelayanan DoraCake.',
  heroCardCtaText: 'Kirim Masukan',
  heroElements: {
    showPromoLabel: true,
    showDescription: true,
    showBadges: true,
    showCta: true,
    showBannerCard: true,
  },
  heroElementOrder: ['title', 'description', 'promoLabel', 'badges', 'cta'],

  // 4. Informasi Promosi
  freeShippingBadgeText: 'Gratis Ongkir Min. Rp100.000',
  orderSpeedBadgeText: 'Pesan Hari Ini, Siap Hari Ini',
  qualityBadgeText: 'Garansi Kualitas & Rasa',
  promoBannerEnabled: false,
  promoBannerText: 'Promo Spesial Pre-Order Hari Ini — Dibuat Segar Setiap Pagi',
  promoPeriodText: 'Berlaku Setiap Hari 07.00–21.00 WIB',

  // 5. Katalog Produk
  catalogKicker: 'Menu Segar Setiap Hari',
  catalogTitle: 'Katalog Lengkap Roti & Kue',
  catalogDescription: 'Pilihan roti, pastry, dan cake homemade segar hari ini.',
  tabAllLabel: 'Semua Menu',
  tabFavoriteLabel: 'Menu Favorit',
  showFavoriteTab: true,
  cardColumns: 3,
  defaultSort: 'recommended',
  showProductCategory: true,
  showProductDescription: true,
  showProductAvailability: true,
  showPromoStrikePrice: true,

  // 6. Bagian Informasi Tambahan
  extraSections: [],

  // 7. Footer
  footerStoreName: 'DoraCake Bakery & Pastry',
  footerAddress: 'Jl. Kalibaru Barat',
  footerHours: 'Setiap Hari 07.00–21.00 WIB',
  footerWhatsapp: '+62 857-7368-0571',
  footerServiceTitle: 'Layanan Pelanggan',
  footerPaymentTitle: 'Metode Pembayaran',
  footerPaymentText:
    'Transfer Bank & QRIS resmi DoraCake setelah pesanan dikonfirmasi oleh admin toko via WhatsApp.',
  footerCopyright: '© 2026 DoraCake Indonesia. All rights reserved.',
  socialLinks: {
    instagram: '',
    tiktok: '',
    facebook: '',
  },

  // 8. Pengaturan Tampilan
  pageBgColor: '#F6EFE4',
  buttonBgColor: '#3B2316',
  buttonTextColor: '#FBF6EE',
  textColor: '#2C1810',
  cardRadius: 'xl',
  fontSizeScale: 'md',
  sectionSpacing: 'normal',

  updatedAt: new Date().toISOString(),
};
