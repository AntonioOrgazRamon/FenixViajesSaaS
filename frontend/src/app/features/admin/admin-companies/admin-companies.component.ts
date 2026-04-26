import { Component, inject, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import gsap from 'gsap';

interface Company {
  id: number;
  name: string;
  slug: string;
  status: string;
}

interface User {
  id: number;
  email: string;
  fullName: string;
  active: boolean;
  role: string;
  lastLoginAt: string;
}

@Component({
  selector: 'app-admin-companies',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-companies.component.html',
  styleUrls: ['./admin-companies.component.css']
})
export class AdminCompaniesComponent implements OnInit, AfterViewInit {
  http = inject(HttpClient);
  authService = inject(AuthService);

  companies: Company[] = [];
  selectedCompanyUsers: User[] = [];
  selectedCompanyId: number | null = null;
  loading = false;
  loadingUsers = false;

  ngOnInit() {
    this.loadCompanies();
  }

  ngAfterViewInit() {
    gsap.from('.admin-container h2', { x: -20, opacity: 0, duration: 0.5, ease: 'power2.out' });
    gsap.from('.admin-container .subtitle', { x: -20, opacity: 0, duration: 0.5, ease: 'power2.out', delay: 0.1 });
  }

  loadCompanies() {
    this.loading = true;
    this.http.get<Company[]>('http://localhost:8080/api/companies').subscribe({
      next: (data) => {
        this.companies = data;
        this.loading = false;
        setTimeout(() => {
          gsap.from('.company-card', { 
            y: 30, 
            opacity: 0, 
            duration: 0.5, 
            stagger: 0.1, 
            ease: 'power3.out' 
          });
        }, 50);
      },
      error: (err) => {
        console.error('Error loading companies', err);
        this.loading = false;
      }
    });
  }

  loadUsers(companyId: number) {
    if (this.selectedCompanyId === companyId) {
      this.selectedCompanyId = null;
      this.selectedCompanyUsers = [];
      return;
    }

    this.selectedCompanyId = companyId;
    this.loadingUsers = true;
    this.http.get<User[]>(`http://localhost:8080/api/companies/${companyId}/users`).subscribe({
      next: (data) => {
        this.selectedCompanyUsers = data;
        this.loadingUsers = false;
        setTimeout(() => {
          gsap.from('.user-item', { 
            x: -20, 
            opacity: 0, 
            duration: 0.4, 
            stagger: 0.05, 
            ease: 'power2.out' 
          });
        }, 50);
      },
      error: (err) => {
        console.error('Error loading users', err);
        this.loadingUsers = false;
      }
    });
  }
}
