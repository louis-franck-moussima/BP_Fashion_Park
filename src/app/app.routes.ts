import { Routes } from '@angular/router';
import { ProductDetailComponent } from './product-detail.component';
import { HomeRouteComponent } from './home-route.component';
import { AdminLoginComponent } from './admin-login.component';
import { AdminForgotPasswordComponent } from './admin-forgot-password.component';
import { CategoryPageComponent } from './category-page.component';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { ContactPageComponent } from './contact-page.component';
import { ownerGuard } from './admin.guard';

export const routes: Routes = [
  { path: '', component: HomeRouteComponent },
  { path: 'admin/login', component: AdminLoginComponent },
  { path: 'admin/forgot-password', component: AdminForgotPasswordComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [ownerGuard] },
  { path: 'contact', component: ContactPageComponent },
  { path: 'product/:id', component: ProductDetailComponent },
  { path: ':root/product/:id', component: ProductDetailComponent },
  { path: ':root/:child/product/:id', component: ProductDetailComponent },
  { path: ':root/:child/:leaf/product/:id', component: ProductDetailComponent },
  { path: '**', component: CategoryPageComponent }
];
