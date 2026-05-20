import { envCommon } from './environment.common';

export const environment = {
  production: true,
  ...envCommon,
  debugLogPayload: false,
};
