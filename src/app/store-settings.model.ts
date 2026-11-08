export type StoreLanguage = 'en' | 'fr';

export interface StoreSettings {
  whatsappNumber: string;
  instagramUrl: string;
  contactEmail: string;
  businessAddress: string;
  deliveryInformation: string;
  currency: string;
  defaultLanguage: StoreLanguage;
  announcementText: string;
  updatedAt: number;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  whatsappNumber: '237657207318',
  instagramUrl: 'https://www.instagram.com/',
  contactEmail: 'hello@bpfashionpark.com',
  businessAddress: '',
  deliveryInformation: 'Contact us to confirm delivery options and costs.',
  currency: 'EUR',
  defaultLanguage: 'en',
  announcementText: 'New arrivals every week',
  updatedAt: 0,
};
