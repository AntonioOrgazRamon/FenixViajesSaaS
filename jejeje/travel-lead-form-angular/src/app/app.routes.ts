import { Routes } from '@angular/router';
import { LeadCaptureComponent } from './lead-capture/lead-capture.component';

export const routes: Routes = [
  { path: '', component: LeadCaptureComponent },
  { path: '**', redirectTo: '' },
];
