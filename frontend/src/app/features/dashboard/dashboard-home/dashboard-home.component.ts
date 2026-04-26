import { Component, inject, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import gsap from 'gsap';

@Component({
  selector: 'app-dashboard-home',
  imports: [CommonModule],
  templateUrl: './dashboard-home.component.html',
  styleUrl: './dashboard-home.component.css'
})
export class DashboardHomeComponent implements AfterViewInit {
  authService = inject(AuthService);
  user = this.authService.currentUser;

  ngAfterViewInit() {
    const tl = gsap.timeline();
    
    // Animación del título
    tl.from('h1', { x: -20, opacity: 0, duration: 0.5, ease: 'power2.out' })
      // Animación de la tarjeta de bienvenida
      .from('.welcome-card', { y: 30, opacity: 0, duration: 0.6, ease: 'power3.out' }, '-=0.2')
      // Animación de las tarjetas del grid (staggered)
      .from('.bento-grid .card', { 
        y: 30, 
        opacity: 0, 
        duration: 0.6, 
        stagger: 0.15, 
        ease: 'power3.out' 
      }, '-=0.4');
  }
}
