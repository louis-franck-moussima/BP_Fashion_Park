import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Server
  },
  {
    path: 'product/:id',
    renderMode: RenderMode.Server
  },
  {
    path: ':root/product/:id',
    renderMode: RenderMode.Server
  },
  {
    path: ':root/:child/product/:id',
    renderMode: RenderMode.Server
  },
  {
    path: ':root/:child/:leaf/product/:id',
    renderMode: RenderMode.Server
  },
  {
    path: 'admin/login',
    renderMode: RenderMode.Server
  },
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
