import { Component, inject, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import gsap from 'gsap';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements AfterViewInit {
  authService = inject(AuthService);
  router = inject(Router);

  user = this.authService.currentUser;
  
  ngAfterViewInit() {
    // Animaciones de entrada con GSAP
    const tl = gsap.timeline();
    
    // Animación de la barra superior
    tl.from('.topbar', { y: -20, opacity: 0, duration: 0.5, ease: 'power2.out' });

    // Animación del sidebar/bottom nav
    if (window.innerWidth > 768) {
      gsap.from('.sidebar', { x: -50, opacity: 0, duration: 0.6, ease: 'power2.out' });
    } else {
      // En móvil, animamos desde abajo
      gsap.fromTo('.sidebar', 
        { y: 70 }, 
        { y: 0, duration: 0.6, ease: 'power2.out', clearProps: 'all' }
      );
      gsap.fromTo('.menu a', 
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: 'back.out(1.7)', delay: 0.3, clearProps: 'all' }
      );
    }
  }

  logout() {
    this.authService.logout();
  }
}
