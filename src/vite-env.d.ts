/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_RELATIONSHIP_WORKSPACE_ENABLED?: string;
  readonly VITE_PAYMENT_REVIEW_ENABLED?: string;
  readonly VITE_PORTONE_TEST_STORE_ID?: string;
  readonly VITE_PORTONE_TEST_CHANNEL_KEY?: string;
  readonly VITE_CUSTOMER_SERVICE_PHONE?: string;
  readonly VITE_MAIL_ORDER_REGISTRATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
