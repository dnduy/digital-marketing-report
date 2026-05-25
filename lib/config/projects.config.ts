export interface FacebookPage {
  id: string;
  name: string;
  token_env_key: string;
}

export interface GoogleMapPlace {
  id: string;
  name: string;
}

export interface WebsiteData {
  domain: string;
  wp_api_url?: string;
  ga4_property_id?: string;
  gsc_url?: string;
}

export interface AdsAccount {
  google_ads_id?: string;
  meta_ads_id?: string;
}

export interface ProjectConfig {
  id: string;
  name: string;
  telegram_chat_id_env_key: string;
  google_sheet_id: string;
  sources: {
    websites: WebsiteData[];
    facebook_pages: FacebookPage[];
    google_maps_places: GoogleMapPlace[];
    ads_accounts?: AdsAccount;
  };
}

export const projects: ProjectConfig[] = [
  {
    id: 'chillax',
    name: 'Hệ thống Chillax & Hoi An Chic',
    telegram_chat_id_env_key: 'TELEGRAM_CHAT_ID_CHILLAX',
    google_sheet_id: 'YOUR_SHEET_ID_HERE',
    sources: {
      websites: [
        {
          domain: 'chillax.com.vn',
          wp_api_url: 'https://chillax.com.vn/wp-json/wp/v2/posts',
          ga4_property_id: '123456789',
          gsc_url: 'https://chillax.com.vn/',
        },
        {
          domain: 'hoianchic.com',
          wp_api_url: 'https://hoianchic.com/wp-json/wp/v2/posts',
          ga4_property_id: '987654321',
          gsc_url: 'https://hoianchic.com/',
        },
      ],
      facebook_pages: [
        {
          id: '100000000000001',
          name: 'Chillax Eatery',
          token_env_key: 'META_TOKEN_CHIC',
        },
        {
          id: '100000000000002',
          name: 'Hoi An Chic Hotel',
          token_env_key: 'META_TOKEN_HOIAN',
        },
      ],
      google_maps_places: [
        { id: 'ChIJxxxxxxxxxxxxxxxx', name: 'Chillax Eatery Hoi An' },
        { id: 'ChIJyyyyyyyyyyyyyyyy', name: 'Hoi An Chic Hotel' },
      ],
    },
  },
  // Thêm project khác ở đây
];
